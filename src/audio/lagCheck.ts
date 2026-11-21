// Lag check (SPEC 2.5): measures how late taps arrive in the recording.
// Taps arrive late because of output delay (speaker -> your ear) plus
// input delay (mic -> browser). Tapping along to clicks measures both
// together, which is exactly what needs subtracting from every hit.
//
// Saved per laptop in the browser (not in the project), so it is done once.
import * as Tone from 'tone'
import { buildRecording, waitUntilAudioTime } from './audioTiming.ts'
import { playClick, stop as stopTransport } from './clock.ts'
import { decibelsToAmplitude, findHitsInSamples } from './hitDetection.ts'
import { getHitThresholdDb, startCapture, startMic, stopCapture } from './mic.ts'

// A slower tempo gives room to measure big lags (e.g. Bluetooth) without
// mixing up which click a tap belongs to: 100 BPM = 600ms between clicks.
const CALIBRATION_BPM = 100
const LEAD_IN_CLICKS = 4 // "listen" bar, not measured
const MEASURED_CLICKS = 16
// A tap counts for a click if it lands between 100ms early and 500ms late.
const EARLIEST_DELAY_SECONDS = -0.1
const LATEST_DELAY_SECONDS = 0.5
// Taps further than this from the median are treated as mistakes.
const OUTLIER_SECONDS = 0.05
const MIN_GOOD_TAPS = 8

const STORAGE_KEY = 'sounds.lagMs'

export type LagCheckStatus = 'idle' | 'listen' | 'tap' | 'processing'

export interface LagCheckState {
  status: LagCheckStatus
  savedLagMs: number | null // null = never calibrated
  previousLagMs: number | null // the run before the latest, to compare runs
  tapsUsed: number
  spreadMs: number
  message: string
}

let state: LagCheckState = {
  status: 'idle',
  savedLagMs: loadSavedLagMs(),
  previousLagMs: null,
  tapsUsed: 0,
  spreadMs: 0,
  message: '',
}
const listeners = new Set<() => void>()

function setState(changes: Partial<LagCheckState>): void {
  state = { ...state, ...changes }
  for (const listener of listeners) {
    listener()
  }
}

export function getLagCheckState(): LagCheckState {
  return state
}

export function subscribeToLagCheck(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

// What the recorder subtracts from every hit. 0 until calibrated.
export function getLagSeconds(): number {
  return state.savedLagMs === null ? 0 : state.savedLagMs / 1000
}

// ---- Saving (browser storage can be unavailable, so never crash on it) ----

function loadSavedLagMs(): number | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY)
    if (text === null) {
      return null
    }
    const value = Number(text)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function saveLagMs(lagMs: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(lagMs))
  } catch {
    // Still works for this session even if it can't be saved.
  }
}

// ---- The check ----

export async function runLagCheck(): Promise<void> {
  if (state.status !== 'idle') {
    return
  }
  try {
    await startMic()
    stopTransport()
    setState({ status: 'listen', message: '' })

    // Schedule all clicks up front on the audio clock.
    const beatSeconds = 60 / CALIBRATION_BPM
    const totalClicks = LEAD_IN_CLICKS + MEASURED_CLICKS
    const firstClickTime = Tone.now() + 0.3
    for (let i = 0; i < totalClicks; i++) {
      playClick(firstClickTime + i * beatSeconds, i % 4 === 0)
    }

    startCapture()
    const firstMeasuredClick = firstClickTime + LEAD_IN_CLICKS * beatSeconds
    const lastClick = firstClickTime + (totalClicks - 1) * beatSeconds

    await waitUntilAudioTime(firstMeasuredClick - beatSeconds / 2)
    setState({ status: 'tap' })

    await waitUntilAudioTime(lastClick + LATEST_DELAY_SECONDS + 0.1)
    setState({ status: 'processing' })
    const chunks = stopCapture()

    // Cut out the part of the recording that can contain measured taps.
    const sampleRate = Tone.getContext().sampleRate
    const windowStartTime = firstMeasuredClick + EARLIEST_DELAY_SECONDS
    const windowEndTime = lastClick + LATEST_DELAY_SECONDS
    const windowStartFrame = Math.round(windowStartTime * sampleRate)
    const windowFrameCount = Math.round((windowEndTime - windowStartTime) * sampleRate)
    const samples = buildRecording(chunks, windowStartFrame, windowFrameCount)

    const threshold = decibelsToAmplitude(getHitThresholdDb())
    const hitIndices = findHitsInSamples(samples, sampleRate, threshold)

    // Match each tap to its click: one tap per click, the first one wins.
    const delays: number[] = []
    const usedClicks = new Set<number>()
    for (const hitIndex of hitIndices) {
      const hitTime = windowStartTime + hitIndex / sampleRate
      const clickNumber = Math.floor(
        (hitTime - firstMeasuredClick - EARLIEST_DELAY_SECONDS) / beatSeconds,
      )
      if (clickNumber < 0 || clickNumber >= MEASURED_CLICKS || usedClicks.has(clickNumber)) {
        continue
      }
      usedClicks.add(clickNumber)
      delays.push(hitTime - (firstMeasuredClick + clickNumber * beatSeconds))
    }

    finishCheck(delays)
  } catch (error) {
    console.error(error)
    stopCapture()
    setState({ status: 'idle', message: 'Lag check failed: ' + String(error) })
  }
}

// Average the delays, ignoring stray taps, and save the result.
function finishCheck(delays: number[]): void {
  const median = getMedian(delays)
  const goodDelays: number[] = []
  for (const delay of delays) {
    if (Math.abs(delay - median) <= OUTLIER_SECONDS) {
      goodDelays.push(delay)
    }
  }

  if (goodDelays.length < MIN_GOOD_TAPS) {
    setState({
      status: 'idle',
      message: `Only ${goodDelays.length} clear taps heard (need ${MIN_GOOD_TAPS}). Tap firmly on every click, or raise the mic sensitivity, then try again.`,
    })
    return
  }

  let sum = 0
  for (const delay of goodDelays) {
    sum += delay
  }
  const average = sum / goodDelays.length

  let squaredSum = 0
  for (const delay of goodDelays) {
    squaredSum += (delay - average) * (delay - average)
  }
  const spread = Math.sqrt(squaredSum / goodDelays.length)

  const lagMs = Math.round(average * 1000)
  saveLagMs(lagMs)
  setState({
    status: 'idle',
    previousLagMs: state.savedLagMs,
    savedLagMs: lagMs,
    tapsUsed: goodDelays.length,
    spreadMs: Math.round(spread * 1000),
    message: '',
  })
}

function getMedian(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort(function (a, b) {
    return a - b
  })
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle]
  }
  return (sorted[middle - 1] + sorted[middle]) / 2
}
