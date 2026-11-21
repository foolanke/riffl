// Recording a take (SPEC 1.3, steps 12-17):
//   Space -> count-in -> record exactly one loop of mic audio -> stop on its own
//   -> find hits -> snap to the 16th grid -> new looping layer with the chosen drum.
//
// The transport keeps looping after the take, so the new layer plays
// from the next loop onward (SPEC 1.3).
//
// Recording over layers (step 16): existing layers play during the take,
// unless "mute layers while recording" is on. Sound from the speakers can
// leak into the mic; see the speaker check in processTake.
//
// Retake (step 17): records a take for one existing layer and replaces
// its hits. That layer is silent during its own retake.
//
// Camera confirmation (step 23, SPEC 1.4): hand positions are saved during
// the take; afterwards a mic hit is kept only if a hand was inside the
// take's object box around that moment. Runs after the take, so it never
// delays playback.
//
// Object-based takes (step 24): selecting an object sets the drum, and
// its box is the one checked by camera confirmation.
import * as Tone from 'tone'
import { addTakeLayer, findObject, getProject, replaceLayerHits } from '../project/projectStore.ts'
import type { Box, Layer, TrackedObject } from '../project/projectStore.ts'
import { isHandTrackingRunning, startRecordingHands, stopRecordingHands } from '../vision/handTracking.ts'
import type { HandFrame } from '../vision/handTracking.ts'
import { isHandInBox } from '../vision/objects.ts'
import { buildRecording, waitUntilAudioTime } from './audioTiming.ts'
import { playForTake } from './clock.ts'
import type { TakeTiming } from './clock.ts'
import type { DrumName } from './drums.ts'
import { decibelsToAmplitude, findHitsInSamples } from './hitDetection.ts'
import { getLagSeconds } from './lagCheck.ts'
import { getHitThresholdDb, startCapture, startMic, stopCapture } from './mic.ts'
import type { CapturedChunk } from './recorderWorklet.ts'
import { snapHitsToSteps, wrapStep } from './snapping.ts'

// Extra audio kept around the loop, so a hit played slightly early on
// beat 1 is not cut off. Hits arrive late by the measured lag, so the
// recording also runs on past the loop end by that lag plus a margin.
const PRE_ROLL_SECONDS = 0.15
const POST_ROLL_MARGIN_SECONDS = 0.2

// Speaker check: after lag correction, sound leaking from the speakers lands
// almost exactly on the step where the app played it. A hit that close to a
// step the app was playing must be this many times louder than the threshold
// (2x = +6 dB) to count. A real tap near the mic is much louder than leakage.
const SPEAKER_WINDOW_SECONDS = 0.03
const SPEAKER_LOUDNESS_FACTOR = 2
// How much audio after a hit's start is used to measure its loudness.
const HIT_PEAK_WINDOW_SECONDS = 0.01

// Camera confirmation: a hand must be in the box within this many ms of
// the mic hit (SPEC 1.4: roughly +-100ms). Covers camera frame spacing
// and small timing differences between the camera and the mic.
const HAND_WINDOW_MS = 100

export type RecordStatus = 'idle' | 'countIn' | 'recording' | 'processing'

export interface HitReport {
  timeMs: number // from the loop start, lag already subtracted
  step: number // nearest 16th step
  offsetMs: number // how early (-) or late (+) it was vs that step
  positionLabel: string // bar.beat.sixteenth, e.g. "1.2.1"
  ignoredAsSpeaker: boolean // true = probably the speakers, not a tap
  ignoredNoHand: boolean // true = camera saw no hand at the object
}

export interface TakeReport {
  drum: DrumName
  isRetake: boolean
  loopSeconds: number
  recordedSeconds: number
  hits: HitReport[]
  snappedSteps: number[]
}

export interface RecorderState {
  status: RecordStatus
  takeDrum: DrumName
  takeObjectId: string | null // object chosen for the next take (step 24)
  cameraConfirmOn: boolean // SPEC 1.4 safety toggle
  muteLayersWhileRecording: boolean
  retakeLayerId: string | null // set while a retake is running
  lastTake: TakeReport | null
  message: string
}

let state: RecorderState = {
  status: 'idle',
  takeDrum: 'kick',
  takeObjectId: null,
  cameraConfirmOn: true,
  muteLayersWhileRecording: false,
  retakeLayerId: null,
  lastTake: null,
  message: '',
}
const listeners = new Set<() => void>()

// The exact one-loop recording, for "Play recording".
let lastTakeAudio: Float32Array | null = null

// Which layers the layer player must keep quiet, and until when (audio clock).
let silenceUntilTime = 0
let silenceAllLayers = false
let silenceLayerId: string | null = null

function setState(changes: Partial<RecorderState>): void {
  state = { ...state, ...changes }
  for (const listener of listeners) {
    listener()
  }
}

export function getRecorderState(): RecorderState {
  return state
}

export function subscribeToRecorder(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

// Picking a drum by hand means the take is no longer tied to an object.
export function setTakeDrum(drum: DrumName): void {
  setState({ takeDrum: drum, takeObjectId: null })
}

// Step 24: selecting an object sets the drum for the take. null = none.
export function selectObjectForTake(objectId: string | null): void {
  const object = findObject(objectId)
  if (object) {
    setState({ takeObjectId: object.id, takeDrum: object.drum })
  } else {
    setState({ takeObjectId: null })
  }
}

export function setCameraConfirmOn(on: boolean): void {
  setState({ cameraConfirmOn: on })
}

export function setMuteLayersWhileRecording(mute: boolean): void {
  setState({ muteLayersWhileRecording: mute })
}

// Asked by the layer player for every hit it is about to play.
export function isLayerSilencedAt(layerId: string, time: number): boolean {
  if (time >= silenceUntilTime) {
    return false
  }
  return silenceAllLayers || layerId === silenceLayerId
}

// ---- Recording ----

// New take, or a retake of one layer if retakeLayerId is given.
export async function recordTake(retakeLayerId?: string): Promise<void> {
  if (state.status !== 'idle') {
    return
  }

  let drum = state.takeDrum
  let retakeLayer: Layer | null = null
  let object: TrackedObject | null = findObject(state.takeObjectId)
  if (retakeLayerId !== undefined) {
    retakeLayer = findLayer(retakeLayerId)
    if (!retakeLayer) {
      return
    }
    drum = retakeLayer.drum
    object = findObject(retakeLayer.objectId)
  } else if (object) {
    drum = object.drum // the object's drum may have been changed since selecting it
  }

  // Which box camera confirmation checks, or why it's skipped (mic only).
  let confirmBox: Box | null = null
  let confirmSkippedReason = ''
  if (state.cameraConfirmOn) {
    if (!object) {
      confirmSkippedReason = 'no object chosen for this take'
    } else if (!isHandTrackingRunning()) {
      confirmSkippedReason = 'camera is off'
    } else {
      confirmBox = object.box
    }
  }

  // Read once so the whole take uses the same values.
  const lagSeconds = getLagSeconds()
  const postRollSeconds = Math.max(0, lagSeconds) + POST_ROLL_MARGIN_SECONDS

  try {
    await startMic()
    setState({
      status: 'countIn',
      message: '',
      retakeLayerId: retakeLayer ? retakeLayer.id : null,
    })

    // Silence layers from now until the end of the recorded loop.
    silenceAllLayers = state.muteLayersWhileRecording
    silenceLayerId = retakeLayer ? retakeLayer.id : null
    silenceUntilTime = Infinity

    startCapture()
    startRecordingHands()
    const timing = playForTake()
    const loopEndTime = timing.loopStartTime + timing.loopSeconds
    silenceUntilTime = loopEndTime
    const speakerSteps = getStepsPlayedBySpeakers(timing)

    await waitUntilAudioTime(timing.loopStartTime)
    setState({ status: 'recording' })

    await waitUntilAudioTime(loopEndTime + postRollSeconds)
    setState({ status: 'processing' })

    const chunks = stopCapture()
    const handFrames = stopRecordingHands()
    // Safety: if tracking stalled and saved nothing, don't throw away every hit.
    if (confirmBox && handFrames.length === 0) {
      confirmBox = null
      confirmSkippedReason = 'no camera frames were saved'
    }
    const report = processTake(chunks, timing, drum, lagSeconds, postRollSeconds, speakerSteps, confirmBox, handFrames)
    report.isRetake = retakeLayer !== null

    // Commit the result (undoable).
    let message = ''
    if (report.snappedSteps.length === 0) {
      message = retakeLayer ? 'No hits found, so the old layer was kept.' : 'No hits found, so no layer was added.'
    } else if (retakeLayer) {
      replaceLayerHits(retakeLayer.id, report.snappedSteps)
    } else {
      const layer: Layer = { id: crypto.randomUUID(), drum: drum, hits: report.snappedSteps, muted: false }
      if (object) {
        layer.objectId = object.id
      }
      addTakeLayer(layer)
    }
    if (confirmSkippedReason) {
      message = (message + ' Camera confirmation skipped (' + confirmSkippedReason + '), mic only.').trim()
    }
    setState({ status: 'idle', lastTake: report, retakeLayerId: null, message: message })
  } catch (error) {
    console.error(error)
    stopCapture()
    stopRecordingHands()
    silenceUntilTime = 0
    setState({ status: 'idle', retakeLayerId: null, message: 'Recording failed: ' + String(error) })
  }
}

function findLayer(layerId: string): Layer | null {
  for (const layer of getProject().layers) {
    if (layer.id === layerId) {
      return layer
    }
  }
  return null
}

// Steps in the loop where the app itself makes a sound during this take:
// unmuted, unsilenced layers, plus metronome clicks if the metronome is on.
function getStepsPlayedBySpeakers(timing: TakeTiming): Set<number> {
  const project = getProject()
  const steps = new Set<number>()
  for (const layer of project.layers) {
    const silenced = silenceAllLayers || layer.id === silenceLayerId
    if (layer.muted || silenced) {
      continue
    }
    for (const step of layer.hits) {
      if (step < timing.stepsInLoop) {
        steps.add(step)
      }
    }
  }
  if (project.settings.metronomeOn) {
    for (let step = 0; step < timing.stepsInLoop; step += timing.stepsPerClick) {
      steps.add(step)
    }
  }
  return steps
}

function processTake(
  chunks: CapturedChunk[],
  timing: TakeTiming,
  drum: DrumName,
  lagSeconds: number,
  postRollSeconds: number,
  speakerSteps: Set<number>,
  confirmBox: Box | null,
  handFrames: HandFrame[],
): TakeReport {
  const sampleRate = Tone.getContext().sampleRate
  // Converts audio-clock seconds to performance.now() ms (the camera's
  // clock). Measured once; the two clocks don't drift apart within a take.
  const audioToPerformanceMs = performance.now() - Tone.getContext().currentTime * 1000

  // Cut out the loop plus the pre/post roll, by exact frame number.
  const windowStartFrame = Math.round((timing.loopStartTime - PRE_ROLL_SECONDS) * sampleRate)
  const windowFrameCount = Math.round(
    (PRE_ROLL_SECONDS + timing.loopSeconds + postRollSeconds) * sampleRate,
  )
  const windowSamples = buildRecording(chunks, windowStartFrame, windowFrameCount)

  const loopStartIndex = Math.round(timing.loopStartTime * sampleRate) - windowStartFrame
  const loopFrameCount = Math.round(timing.loopSeconds * sampleRate)
  // The raw take for playback is the loop as it arrived at the mic, so it
  // is shifted by the lag to line up with what was actually played.
  const lagFrames = Math.round(lagSeconds * sampleRate)
  const takeStart = Math.max(0, loopStartIndex + lagFrames)
  lastTakeAudio = windowSamples.slice(takeStart, takeStart + loopFrameCount)

  // Find hits (step 13).
  const threshold = decibelsToAmplitude(getHitThresholdDb())
  const hitIndices = findHitsInSamples(windowSamples, sampleRate, threshold)

  // Keep only hits that belong to this loop: from half a step before the
  // start up to half a step before the end. Anything else would snap
  // to a step outside the loop.
  const halfStep = timing.stepSeconds / 2
  const keptHitTimes: number[] = []
  const hitReports: HitReport[] = []
  for (const hitIndex of hitIndices) {
    // Subtract the measured lag (step 15) so the hit sits where it was played.
    const hitTime = (hitIndex - loopStartIndex) / sampleRate - lagSeconds
    if (hitTime < -halfStep || hitTime >= timing.loopSeconds - halfStep) {
      continue
    }

    const nearestStep = Math.round(hitTime / timing.stepSeconds)
    const wrappedStep = wrapStep(nearestStep, timing.stepsInLoop)
    const offsetSeconds = hitTime - nearestStep * timing.stepSeconds

    // Speaker check (step 16).
    const nearSpeakerSound =
      speakerSteps.has(wrappedStep) && Math.abs(offsetSeconds) <= SPEAKER_WINDOW_SECONDS
    const hitPeak = getPeakAfter(windowSamples, hitIndex, Math.round(HIT_PEAK_WINDOW_SECONDS * sampleRate))
    const ignoredAsSpeaker = nearSpeakerSound && hitPeak < threshold * SPEAKER_LOUDNESS_FACTOR

    // Camera confirmation (step 23). Uses the moment the mic heard the hit
    // (no lag subtracted): that is closest to when the hand touched the object.
    let ignoredNoHand = false
    if (confirmBox) {
      const micHeardMs = audioToPerformanceMs + ((windowStartFrame + hitIndex) / sampleRate) * 1000
      ignoredNoHand = !wasHandInBoxNear(handFrames, confirmBox, micHeardMs)
    }

    if (!ignoredAsSpeaker && !ignoredNoHand) {
      keptHitTimes.push(hitTime)
    }
    hitReports.push({
      timeMs: hitTime * 1000,
      step: wrappedStep,
      offsetMs: offsetSeconds * 1000,
      positionLabel: getPositionLabel(wrappedStep, timing.stepsPerBar),
      ignoredAsSpeaker: ignoredAsSpeaker,
      ignoredNoHand: ignoredNoHand,
    })
  }

  // Snap (step 14).
  const snappedSteps = snapHitsToSteps(keptHitTimes, timing.stepSeconds, timing.stepsInLoop)

  return {
    drum: drum,
    isRetake: false,
    loopSeconds: timing.loopSeconds,
    recordedSeconds: lastTakeAudio.length / sampleRate,
    hits: hitReports,
    snappedSteps: snappedSteps,
  }
}

// True if any saved camera frame within HAND_WINDOW_MS of the time shows a hand in the box.
function wasHandInBoxNear(frames: HandFrame[], box: Box, timeMs: number): boolean {
  for (const frame of frames) {
    if (Math.abs(frame.time - timeMs) <= HAND_WINDOW_MS && isHandInBox(frame, box)) {
      return true
    }
  }
  return false
}

// Loudest absolute sample in [start, start + length).
function getPeakAfter(samples: Float32Array, start: number, length: number): number {
  let peak = 0
  const end = Math.min(samples.length, start + length)
  for (let i = start; i < end; i++) {
    const amplitude = Math.abs(samples[i])
    if (amplitude > peak) {
      peak = amplitude
    }
  }
  return peak
}

// "bar.beat.sixteenth", all 1-based. Beats are quarter notes (4 steps).
function getPositionLabel(step: number, stepsPerBar: number): string {
  const bar = Math.floor(step / stepsPerBar) + 1
  const stepInBar = step % stepsPerBar
  const beat = Math.floor(stepInBar / 4) + 1
  const sixteenth = (stepInBar % 4) + 1
  return bar + '.' + beat + '.' + sixteenth
}

// ---- Playback of the raw take (step 12 test) ----

export function playLastTake(): void {
  if (!lastTakeAudio) {
    return
  }
  const buffer = Tone.ToneAudioBuffer.fromArray(lastTakeAudio)
  const player = new Tone.Player(buffer).toDestination()
  player.onstop = function () {
    player.dispose()
  }
  player.start()
}
