// Starts the designed riffl page (served at /).
// The old test page has its own entry: test.html -> src/main.tsx.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setAccuratePinch } from '../../audio/liveMelody.ts'
import { initAutoSave } from '../../project/saveLoad.ts'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RifflApp />
  </StrictMode>,
)
