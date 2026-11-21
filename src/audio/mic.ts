// Microphone input: level meter and live hit detection (SPEC steps 10-11).
//
// Mic settings (SPEC step 10):
// - echo cancellation ON: helps keep the app's own drums out of the mic
// - noise suppression OFF: it would smear or remove the sharp tap transients
// - auto gain OFF: it would keep changing the level, breaking a fixed threshold
//
// The mic is never connected to the speakers (no feedback).
import * as Tone from 'tone'
import {
  checkBlockForHit,
  createHitDetector,
  decibelsToAmplitude,
  sensitivityToThresholdDb,
} from './hitDetection.ts'
import { RECORDER_PROCESSOR_NAME, createRecorderWorkletUrl } from './recorderWorklet.ts'
import type { CapturedChunk } from './recorderWorklet.ts'

let micStream: MediaStream | null = null
let micStarting: Promise<void> | null = null
// While a take is being captured, raw mic chunks are collected here.
let capturedChunks: CapturedChunk[] | null = null
let analyser: AnalyserNode | null = null
let sampleBuffer: Float32Array<ArrayBuffer> = new Float32Array(0)
let lastReadTime = 0
let latestPeak = 0

// 0..100, see hitDetection.ts. Saved per laptop (depends on the room and mic,
// not the project), so it is not part of the project file.
const SENSITIVITY_STORAGE_KEY = 'sounds.micSensitivity'
const DEFAULT_SENSITIVITY = 40
let sensitivity = loadSavedSensitivity()
const detector = createHitDetector()
const hitListeners = new Set<() => void>()

function getAudioContext(): AudioContext {
  return Tone.getContext().rawContext as unknown as AudioContext
}

// Asks for mic permission and starts listening. Call after startAudio().
// Safe to call many times; only the first call does the work.
export function startMic(): Promise<void> {
  if (!micStarting) {
    micStarting = openMic()
    // If it failed (e.g. permission denied), allow trying again.
    micStarting.catch(function () {
      micStarting = null
    })
  }
  return micStarting
}

async function openMic(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const audioContext = getAudioContext()
  const source = audioContext.createMediaStreamSource(stream)

  // Recorder worklet: raw samples with exact frame numbers, for takes.
  await Tone.getContext().addAudioWorkletModule(createRecorderWorkletUrl())
  const recorderNode = Tone.getContext().createAudioWorkletNode(RECORDER_PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1, // mix to mono
    channelCountMode: 'explicit',
  })
  recorderNode.port.onmessage = function (event: MessageEvent<CapturedChunk>) {
    if (capturedChunks) {
      capturedChunks.push(event.data)
    }
  }
  source.connect(recorderNode)
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048 // ~43ms of audio at 48kHz, longer than one screen frame
  sampleBuffer = new Float32Array(analyser.fftSize)
  source.connect(analyser)

  // Route the analyser into a silent gain so the audio graph keeps it running,
  // without the mic ever reaching the speakers.
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0
  analyser.connect(silentGain)
  recorderNode.connect(silentGain)
  silentGain.connect(audioContext.destination)

  micStream = stream
  lastReadTime = audioContext.currentTime
  requestAnimationFrame(checkMicFrame)
}

// ---- Raw capture for takes ----

export function startCapture(): void {
  capturedChunks = []
}

// Stops collecting and returns everything captured since startCapture().
export function stopCapture(): CapturedChunk[] {
  const chunks = capturedChunks === null ? [] : capturedChunks
  capturedChunks = null
  return chunks
}

// Runs every screen frame. Looks only at the audio that arrived since the
// last frame, so each moment of sound is checked once.
function checkMicFrame(): void {
  if (!analyser) {
    return
  }
  const audioContext = getAudioContext()
  const now = audioContext.currentTime
  let newSampleCount = Math.round((now - lastReadTime) * audioContext.sampleRate)

  if (newSampleCount > 0) {
    lastReadTime = now
    newSampleCount = Math.min(newSampleCount, sampleBuffer.length)
    analyser.getFloatTimeDomainData(sampleBuffer)

    let peak = 0
    for (let i = sampleBuffer.length - newSampleCount; i < sampleBuffer.length; i++) {
      const amplitude = Math.abs(sampleBuffer[i])
      if (amplitude > peak) {
        peak = amplitude
      }
    }
    latestPeak = peak

    const blockSeconds = newSampleCount / audioContext.sampleRate
    const threshold = decibelsToAmplitude(getHitThresholdDb())
    if (checkBlockForHit(detector, peak, blockSeconds, now, threshold)) {
      for (const listener of hitListeners) {
        listener()
      }
    }
  }

  requestAnimationFrame(checkMicFrame)
}

// ---- For the screen ----

export function isMicOn(): boolean {
  return micStream !== null
}

// Loudest sample in the most recent frame, 0..1.
export function getMicPeak(): number {
  return latestPeak
}

export function getSensitivity(): number {
  return sensitivity
}

export function setSensitivity(value: number): void {
  sensitivity = Math.min(100, Math.max(0, value))
  try {
    window.localStorage.setItem(SENSITIVITY_STORAGE_KEY, String(sensitivity))
  } catch {
    // Still works for this session even if it can't be saved.
  }
}

function loadSavedSensitivity(): number {
  try {
    const text = window.localStorage.getItem(SENSITIVITY_STORAGE_KEY)
    const value = Number(text)
    if (text !== null && Number.isFinite(value) && value >= 0 && value <= 100) {
      return value
    }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_SENSITIVITY
}

export function getHitThresholdDb(): number {
  return sensitivityToThresholdDb(sensitivity)
}

// Called on every live hit.
export function onLiveHit(listener: () => void): () => void {
  hitListeners.add(listener)
  return function unsubscribe() {
    hitListeners.delete(listener)
  }
}
