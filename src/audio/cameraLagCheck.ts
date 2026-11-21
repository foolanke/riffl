// Camera lag check (SPEC 3.8, step 28): measures how late pinches are seen.
// Hand tracking has its own delay (camera exposure, frame delivery,
// tracking), separate from the mic delay (SPEC 2.5). Pinching along to
// clicks measures it together with the speaker delay, which is exactly
// what needs subtracting from every recorded melody note.
//
// Same method as the mic lag check (lagCheck.ts): 4 clicks to listen,
// then pinch on 16 clicks; delays are matched to clicks, stray pinches
// dropped, the rest averaged. Live sound can't be made earlier; this only
// corrects recorded melody layers (step 29).
//
// Saved per laptop in the browser (not in the project), so it is done once.
import * as Tone from 'tone'
import { isHandTrackingRunning } from '../vision/handTracking.ts'
import { performanceMsToAudioTime, waitUntilAudioTime } from './audioTiming.ts'
import { playClick, stop as stopTransport } from './clock.ts'
import { summarizeDelays } from './lagCheck.ts'
import { startPinchCapture, stopPinchCapture } from './liveMelody.ts'
import { getRecorderState } from './recorder.ts'

// 100 BPM = 600ms between clicks: room for a camera lag of a few hundred
// ms without mixing up which click a pinch belongs to.
const CALIBRATION_BPM = 100
const LEAD_IN_CLICKS = 4 // "listen" bar, not measured
const MEASURED_CLICKS = 16
// A pinch counts for a click if it is seen between 100ms early and 500ms late.
const EARLIEST_DELAY_SECONDS = -0.1
const LATEST_DELAY_SECONDS = 0.5
// Wider than the mic check (50ms): camera frames are 16-33ms apart, so
// pinch times are naturally less exact than mic taps.
const OUTLIER_SECONDS = 0.08
const MIN_GOOD_PINCHES = 8

const STORAGE_KEY = 'sounds.cameraLagMs'

export type CameraLagCheckStatus = 'idle' | 'listen' | 'pinch' | 'processing'

export interface CameraLagCheckState {
  status: CameraLagCheckStatus
  savedLagMs: number | null // null = never calibrated
  previousLagMs: number | null // the run before the latest, to compare runs
  pinchesUsed: number
  spreadMs: number
  message: string
}

let state: CameraLagCheckState = {
  status: 'idle',
  savedLagMs: loadSavedLagMs(),
  previousLagMs: null,
  pinchesUsed: 0,
  spreadMs: 0,
  message: '',
}
const listeners = new Set<() => void>()

function setState(changes: Partial<CameraLagCheckState>): void {
  state = { ...state, ...changes }
  for (const listener of listeners) {
    listener()
  }
}

export function getCameraLagCheckState(): CameraLagCheckState {
  return state
}

export function subscribeToCameraLagCheck(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

// What melody takes (step 29) subtract from every note. 0 until calibrated.
export function getCameraLagSeconds(): number {
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

export async function runCameraLagCheck(): Promise<void> {
  if (state.status !== 'idle') {
    return
  }
  if (!isHandTrackingRunning()) {
    setState({ message: 'Turn on the camera first (Camera: Enable camera).' })
    return
  }
  if (getRecorderState().status !== 'idle') {
    setState({ message: 'Wait for the take to finish first.' })
    return
  }

  // Pinch times are converted to the audio clock as they arrive.
  const pinchTimes: number[] = []
  try {
    stopTransport()
    setState({ status: 'listen', message: '' })

    // Schedule all clicks up front on the audio clock.
    const beatSeconds = 60 / CALIBRATION_BPM
    const totalClicks = LEAD_IN_CLICKS + MEASURED_CLICKS
    const firstClickTime = Tone.now() + 0.3
    for (let i = 0; i < totalClicks; i++) {
      playClick(firstClickTime + i * beatSeconds, i % 4 === 0)
    }

    startPinchCapture(function (frameTimeMs) {
      pinchTimes.push(performanceMsToAudioTime(frameTimeMs))
    })
    const firstMeasuredClick = firstClickTime + LEAD_IN_CLICKS * beatSeconds
    const lastClick = firstClickTime + (totalClicks - 1) * beatSeconds

    await waitUntilAudioTime(firstMeasuredClick - beatSeconds / 2)
    setState({ status: 'pinch' })

    await waitUntilAudioTime(lastClick + LATEST_DELAY_SECONDS + 0.1)
    setState({ status: 'processing' })
    stopPinchCapture()

    // Match each pinch to its click: one pinch per click, the first one wins.
    const delays: number[] = []
    const usedClicks = new Set<number>()
    for (const pinchTime of pinchTimes) {
      const clickNumber = Math.floor(
        (pinchTime - firstMeasuredClick - EARLIEST_DELAY_SECONDS) / beatSeconds,
      )
      if (clickNumber < 0 || clickNumber >= MEASURED_CLICKS || usedClicks.has(clickNumber)) {
        continue
      }
      usedClicks.add(clickNumber)
      delays.push(pinchTime - (firstMeasuredClick + clickNumber * beatSeconds))
    }

    finishCheck(delays)
  } catch (error) {
    console.error(error)
    stopPinchCapture()
    setState({ status: 'idle', message: 'Camera lag check failed: ' + String(error) })
  }
}

function finishCheck(delays: number[]): void {
  const summary = summarizeDelays(delays, OUTLIER_SECONDS)
  if (summary.goodCount < MIN_GOOD_PINCHES) {
    setState({
      status: 'idle',
      message: `Only ${summary.goodCount} clear pinches seen (need ${MIN_GOOD_PINCHES}). Keep one hand in view, open it fully between pinches, and pinch on every click.`,
    })
    return
  }

  const lagMs = Math.round(summary.averageSeconds * 1000)
  saveLagMs(lagMs)
  setState({
    status: 'idle',
    previousLagMs: state.savedLagMs,
    savedLagMs: lagMs,
    pinchesUsed: summary.goodCount,
    spreadMs: Math.round(summary.spreadSeconds * 1000),
    message: '',
  })
}
