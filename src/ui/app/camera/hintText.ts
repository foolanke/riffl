// What the hint pill at the bottom of the camera says (design.md 4.1).
import type { CameraLagCheckStatus } from '../../../audio/cameraLagCheck.ts'
import type { RecordStatus } from '../../../audio/recorder.ts'

const SETUP_HINT = 'Point the camera at an object, then press record'
const MELODY_HINT = 'Pinch your thumb to a finger to play'
const NO_TRACKING_HINT = 'Hand tracking unavailable. Melody needs the camera.'

interface HintState {
  recorderStatus: RecordStatus
  micCheckStatus: string
  cameraCheckStatus: CameraLagCheckStatus
  hasLayers: boolean
  melodyActive: boolean // the active card is a melody layer
  trackingOk: boolean
}

// null = no hint pill. A running calibration wins, then take progress, then
// the pinch hint on a melody card, then the setup hint until the first layer.
export function getHintText(state: HintState): string | null {
  const calibrationHint = getCalibrationHint(state.micCheckStatus, state.cameraCheckStatus)
  if (calibrationHint !== null) {
    return calibrationHint
  }
  if (state.recorderStatus === 'countIn') {
    return 'Count-in. Get ready.'
  }
  if (state.recorderStatus === 'recording') {
    return 'Recording. Play now.'
  }
  if (state.recorderStatus === 'processing') {
    return state.melodyActive ? 'Snapping notes...' : 'Finding hits...'
  }
  if (state.melodyActive) {
    return state.trackingOk ? MELODY_HINT : NO_TRACKING_HINT
  }
  return state.hasLayers ? null : SETUP_HINT
}

// What the pill says while a lag check runs, or null if none is running.
function getCalibrationHint(micStatus: string, cameraStatus: string): string | null {
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
