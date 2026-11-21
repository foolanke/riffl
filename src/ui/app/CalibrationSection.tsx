// Calibration (SPEC 2.5 mic lag check, SPEC 3.8 camera lag check).
// Both checks already exist in the engine (audio/lagCheck.ts,
// audio/cameraLagCheck.ts); this section runs them and shows the saved result.
// The design has no calibration screen yet (design.md 10, Q7), so each check
// is a row in the style of the metronome strip (5.4) with a chip button.
import { useState, useSyncExternalStore } from 'react'
import { getCameraLagCheckState, runCameraLagCheck, subscribeToCameraLagCheck } from '../../audio/cameraLagCheck.ts'
import { getLagCheckState, runLagCheck, subscribeToLagCheck } from '../../audio/lagCheck.ts'
import { getRecorderState, subscribeToRecorder } from '../../audio/recorder.ts'
import { getCameraVideo } from '../../vision/camera.ts'
import { startHandTracking } from '../../vision/handTracking.ts'

interface CalibrationSectionProps {
  cameraOk: boolean
}

export function CalibrationSection(props: CalibrationSectionProps) {
  const micCheck = useSyncExternalStore(subscribeToLagCheck, getLagCheckState)
  const cameraCheck = useSyncExternalStore(subscribeToCameraLagCheck, getCameraLagCheckState)
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [cameraError, setCameraError] = useState('')

  // Only one thing may use the clock and mic at a time.
  const somethingRunning =
    recorder.status !== 'idle' || micCheck.status !== 'idle' || cameraCheck.status !== 'idle' || loadingTracking

  async function handleCameraCheck() {
    setCameraError('')
    const video = getCameraVideo()
    if (!video) {
      setCameraError('Camera is off, so the camera lag check cannot run.')
      return
    }
    // Hand tracking is only loaded when first needed (it takes a few seconds).
    setLoadingTracking(true)
    try {
      await startHandTracking(video)
    } catch (error) {
      console.error(error)
      setCameraError('Hand tracking could not start: ' + String(error))
      setLoadingTracking(false)
      return
    }
    setLoadingTracking(false)
    await runCameraLagCheck()
  }

  return (
    <div className="section calibration">
      <div className="section-title text-label">Calibration</div>

      <CalibrationRow
        name="Mic lag"
        savedLagMs={micCheck.savedLagMs}
        running={micCheck.status !== 'idle'}
        disabled={somethingRunning}
        onRun={runLagCheck}
        detail={getRunDetail(micCheck.savedLagMs, micCheck.previousLagMs, micCheck.tapsUsed, micCheck.spreadMs, 'taps')}
        message={micCheck.message}
      />

      <CalibrationRow
        name="Camera lag"
        savedLagMs={cameraCheck.savedLagMs}
        running={cameraCheck.status !== 'idle' || loadingTracking}
        disabled={somethingRunning || !props.cameraOk}
        onRun={handleCameraCheck}
        detail={getRunDetail(
          cameraCheck.savedLagMs,
          cameraCheck.previousLagMs,
          cameraCheck.pinchesUsed,
          cameraCheck.spreadMs,
          'pinches',
        )}
        message={cameraError || cameraCheck.message}
      />
    </div>
  )
}

interface CalibrationRowProps {
  name: string
  savedLagMs: number | null
  running: boolean
  disabled: boolean
  onRun: () => void
  detail: string // result of the last run this session; '' = none
  message: string // problem from the last run; '' = none
}

function CalibrationRow(props: CalibrationRowProps) {
  let buttonLabel = props.savedLagMs === null ? 'Run' : 'Re-run'
  if (props.running) {
    buttonLabel = 'Running'
  }

  return (
    <div className="calibration-item">
      <div className="calibration-row">
        <span className="text-label">{props.name}</span>
        <div className="metronome-rule" />
        <span className="text-label color-muted">{props.savedLagMs === null ? 'Not set' : props.savedLagMs + ' ms'}</span>
        <button
          className="chip-button text-item"
          type="button"
          disabled={props.disabled}
          onClick={(event) => {
            props.onRun()
            event.currentTarget.blur() // so Space doesn't press this again
          }}
        >
          {buttonLabel}
        </button>
      </div>
      {props.detail ? <p className="calibration-note text-label color-muted">{props.detail}</p> : null}
      {props.message ? <p className="calibration-note text-label color-muted">{props.message}</p> : null}
    </div>
  )
}

// "16 taps, ±6 ms. Run before: 41 ms." Shown after a run, to compare runs.
function getRunDetail(
  savedLagMs: number | null,
  previousLagMs: number | null,
  used: number,
  spreadMs: number,
  unit: string,
): string {
  if (savedLagMs === null || used === 0) {
    return ''
  }
  let text = `${used} ${unit}, ±${spreadMs} ms.`
  if (previousLagMs !== null) {
    text += ` Run before: ${previousLagMs} ms.`
  }
  return text
}

// What the camera hint pill says while a check runs, or null if none is running.
export function getCalibrationHint(micStatus: string, cameraStatus: string): string | null {
  if (micStatus === 'listen' || cameraStatus === 'listen') {
    return 'Calibrating. Listen to the first 4 clicks.'
  }
  if (micStatus === 'tap') {
    return 'Tap the desk on every click.'
  }
  if (cameraStatus === 'pinch') {
    return 'Pinch thumb to index on every click. Open your hand in between.'
  }
  if (micStatus === 'processing' || cameraStatus === 'processing') {
    return 'Measuring...'
  }
  return null
}
