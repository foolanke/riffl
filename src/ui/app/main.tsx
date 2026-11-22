// Starts the designed riffl page (served at /).
// The old test page has its own entry: test.html -> src/main.tsx.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setHitEchoGuard } from '../../audio/hitDetection.ts'
import { setAccuratePinch } from '../../audio/liveMelody.ts'
import { getRecorderState, setConfirmBoxMargin, subscribeToRecorder } from '../../audio/recorder.ts'
import type { TakeReport } from '../../audio/recorder.ts'
import { initAutoSave } from '../../project/saveLoad.ts'
import { setFastFrames } from '../../vision/handTracking.ts'
import { setAccidentalsEnabled } from '../../vision/melodyGuide.ts'
import { RifflApp } from './RifflApp.tsx'
import './styles/tokens.css'
import './styles/app.css'

// The UI is sized for a 1920 x 1080 screen. On smaller screens everything
// scales down in proportion (never up), using whichever side is tighter.
const REFERENCE_WIDTH = 1920
const REFERENCE_HEIGHT = 1080

function updateUiScale() {
  const scale = Math.min(1, window.innerWidth / REFERENCE_WIDTH, window.innerHeight / REFERENCE_HEIGHT)
  document.documentElement.style.setProperty('--ui-scale', String(scale))
}
updateUiScale()
window.addEventListener('resize', updateUiScale)

// Load the auto-saved project (if any) before anything reads it.
// Both pages share it, so layers made on one show up on the other.
initAutoSave()

// The designed page uses the more robust pinch detection (3D distances,
// smoothing, overlap rejection; see vision/pinchAccurate.ts).
setAccuratePinch(true)

// Track each camera frame the moment it arrives, not when it is shown
// (about one frame sooner from pinch to sound; see vision/handTracking.ts).
setFastFrames(true)

// Wrist tilt plays accidentals: right = sharp, left = flat, upright =
// natural (overrides SPEC 3.3 on this page; see vision/melodyGuide.ts).
setAccidentalsEnabled(true)

// Drum takes: ignore the ringing right after a tap (it was adding a second
// note on the next 16th), and check the camera against a box with some room
// around the object (tight click-added boxes were dropping real hits).
setHitEchoGuard(true)
setConfirmBoxMargin(0.25)

// Tuning aid: open /?takedebug and every drum take prints why each hit was
// kept or dropped in the browser console.
if (new URLSearchParams(window.location.search).has('takedebug')) {
  let lastReport: TakeReport | null = null
  subscribeToRecorder(function () {
    const report = getRecorderState().lastTake
    if (report && report !== lastReport) {
      lastReport = report
      printTakeReport(report)
    }
  })
}

function printTakeReport(report: TakeReport) {
  console.log(
    'Drum take: lag ' + report.lagMs.toFixed(0) + ' ms, threshold ' + report.thresholdDb.toFixed(0) +
      ' dB, camera check ' + (report.cameraChecked ? 'on' : 'off (mic only)') +
      ', kept steps ' + JSON.stringify(report.snappedSteps),
  )
  const rows = []
  for (const hit of report.hits) {
    let result = 'kept'
    if (hit.ignoredAsSpeaker) {
      result = 'dropped: speakers'
    } else if (hit.ignoredNoHand) {
      result = 'dropped: no hand in box'
    }
    rows.push({
      position: hit.positionLabel,
      step: hit.step,
      'off by ms': Math.round(hit.offsetMs),
      'loudness dB': Math.round(hit.peakDb),
      result: result,
    })
  }
  console.table(rows)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RifflApp />
  </StrictMode>,
)
