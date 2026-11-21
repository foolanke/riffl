// Recording a take (SPEC 1.3, steps 12-14):
//   Space -> count-in -> record exactly one loop of mic audio -> stop on its own
//   -> find hits -> snap to the 16th grid -> new looping layer with the chosen drum.
//
// The transport keeps looping after the take, so the new layer plays
// from the next loop onward (SPEC 1.3).
import * as Tone from 'tone'
import { addLayers } from '../project/projectStore.ts'
import { playForTake } from './clock.ts'
import type { TakeTiming } from './clock.ts'
import type { DrumName } from './drums.ts'
import { decibelsToAmplitude, findHitsInSamples } from './hitDetection.ts'
import { getHitThresholdDb, startCapture, startMic, stopCapture } from './mic.ts'
import type { CapturedChunk } from './recorderWorklet.ts'
import { snapHitsToSteps, wrapStep } from './snapping.ts'

// Extra audio kept around the loop, so a hit played slightly early on
// beat 1, or one arriving late through the mic, is not cut off.
const PRE_ROLL_SECONDS = 0.15
const POST_ROLL_SECONDS = 0.2

export type RecordStatus = 'idle' | 'countIn' | 'recording' | 'processing'

export interface HitReport {
  timeMs: number // from the loop start
  step: number // nearest 16th step it snapped to
  offsetMs: number // how early (-) or late (+) it was vs that step
  positionLabel: string // bar.beat.sixteenth, e.g. "1.2.1"
}

export interface TakeReport {
  drum: DrumName
  loopSeconds: number
  recordedSeconds: number
  hits: HitReport[]
  snappedSteps: number[]
}

export interface RecorderState {
  status: RecordStatus
  takeDrum: DrumName
  lastTake: TakeReport | null
  errorText: string
}

let state: RecorderState = {
  status: 'idle',
  takeDrum: 'kick',
  lastTake: null,
  errorText: '',
}
const listeners = new Set<() => void>()

// The exact one-loop recording, for "Play recording".
let lastTakeAudio: Float32Array | null = null

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

export function setTakeDrum(drum: DrumName): void {
  setState({ takeDrum: drum })
}

// ---- Recording ----

export async function recordTake(): Promise<void> {
  if (state.status !== 'idle') {
    return
  }
  const drum = state.takeDrum
  try {
    await startMic()
    setState({ status: 'countIn', errorText: '' })

    startCapture()
    const timing = playForTake()

    await waitUntilAudioTime(timing.loopStartTime)
    setState({ status: 'recording' })

    const loopEndTime = timing.loopStartTime + timing.loopSeconds
    await waitUntilAudioTime(loopEndTime + POST_ROLL_SECONDS)
    setState({ status: 'processing' })

    const chunks = stopCapture()
    const report = processTake(chunks, timing, drum)
    setState({ status: 'idle', lastTake: report })
  } catch (error) {
    console.error(error)
    stopCapture()
    setState({ status: 'idle', errorText: 'Recording failed: ' + String(error) })
  }
}

function processTake(chunks: CapturedChunk[], timing: TakeTiming, drum: DrumName): TakeReport {
  const sampleRate = Tone.getContext().sampleRate

  // Cut out the loop plus the pre/post roll, by exact frame number.
  const windowStartFrame = Math.round((timing.loopStartTime - PRE_ROLL_SECONDS) * sampleRate)
  const windowFrameCount = Math.round(
    (PRE_ROLL_SECONDS + timing.loopSeconds + POST_ROLL_SECONDS) * sampleRate,
  )
  const windowSamples = extractSamples(chunks, windowStartFrame, windowFrameCount)

  const loopStartIndex = Math.round(timing.loopStartTime * sampleRate) - windowStartFrame
  const loopFrameCount = Math.round(timing.loopSeconds * sampleRate)
  lastTakeAudio = windowSamples.slice(loopStartIndex, loopStartIndex + loopFrameCount)

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
    // Lag compensation (step 15) will be subtracted here.
    const hitTime = (hitIndex - loopStartIndex) / sampleRate
    if (hitTime < -halfStep || hitTime >= timing.loopSeconds - halfStep) {
      continue
    }
    keptHitTimes.push(hitTime)

    const nearestStep = Math.round(hitTime / timing.stepSeconds)
    hitReports.push({
      timeMs: hitTime * 1000,
      step: wrapStep(nearestStep, timing.stepsInLoop),
      offsetMs: (hitTime - nearestStep * timing.stepSeconds) * 1000,
      positionLabel: getPositionLabel(wrapStep(nearestStep, timing.stepsInLoop), timing.stepsPerBar),
    })
  }

  // Snap and add the new layer (step 14).
  const snappedSteps = snapHitsToSteps(keptHitTimes, timing.stepSeconds, timing.stepsInLoop)
  if (snappedSteps.length > 0) {
    addLayers([{ id: crypto.randomUUID(), drum: drum, hits: snappedSteps, muted: false }])
  }

  return {
    drum: drum,
    loopSeconds: timing.loopSeconds,
    recordedSeconds: lastTakeAudio.length / sampleRate,
    hits: hitReports,
    snappedSteps: snappedSteps,
  }
}

// Builds one continuous recording from the worklet's chunks.
function extractSamples(chunks: CapturedChunk[], startFrame: number, frameCount: number): Float32Array {
  const output = new Float32Array(frameCount)
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.samples.length; i++) {
      const outputIndex = chunk.startFrame + i - startFrame
      if (outputIndex >= 0 && outputIndex < frameCount) {
        output[outputIndex] = chunk.samples[i]
      }
    }
  }
  return output
}

// "bar.beat.sixteenth", all 1-based. Beats are quarter notes (4 steps).
function getPositionLabel(step: number, stepsPerBar: number): string {
  const bar = Math.floor(step / stepsPerBar) + 1
  const stepInBar = step % stepsPerBar
  const beat = Math.floor(stepInBar / 4) + 1
  const sixteenth = (stepInBar % 4) + 1
  return bar + '.' + beat + '.' + sixteenth
}

function waitUntilAudioTime(audioTime: number): Promise<void> {
  return new Promise(function (resolve) {
    function check() {
      if (Tone.getContext().currentTime >= audioTime) {
        resolve()
      } else {
        setTimeout(check, 20)
      }
    }
    check()
  })
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
