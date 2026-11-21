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

let micStream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let sampleBuffer: Float32Array<ArrayBuffer> = new Float32Array(0)
let lastReadTime = 0
let latestPeak = 0

let sensitivity = 40 // 0..100, see hitDetection.ts
const detector = createHitDetector()
const hitListeners = new Set<() => void>()

function getAudioContext(): AudioContext {
  return Tone.getContext().rawContext as unknown as AudioContext
}

// Asks for mic permission and starts listening. Call after startAudio().
export async function startMic(): Promise<void> {
  if (micStream) {
    return
  }
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const audioContext = getAudioContext()
  const source = audioContext.createMediaStreamSource(micStream)
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048 // ~43ms of audio at 48kHz, longer than one screen frame
  sampleBuffer = new Float32Array(analyser.fftSize)
  source.connect(analyser)

  // Route the analyser into a silent gain so the audio graph keeps it running,
  // without the mic ever reaching the speakers.
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0
  analyser.connect(silentGain)
  silentGain.connect(audioContext.destination)

  lastReadTime = audioContext.currentTime
  requestAnimationFrame(checkMicFrame)
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
