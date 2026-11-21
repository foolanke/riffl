// Browsers keep audio (and the camera prompt) locked until the user clicks,
// so the page opens on this overlay. START unlocks audio, loads the sounds
// and opens the camera, then the main page appears.
import { useState } from 'react'
import { startAudio } from '../../audio/audioEngine.ts'
import { startCamera } from '../../vision/camera.ts'
import { startHandTracking } from '../../vision/handTracking.ts'
import { BrandBadge } from './BrandBadge.tsx'

interface StartOverlayProps {
  // cameraOk = false if the camera couldn't be opened (the app still works, mic only).
  // trackingOk = false if hand tracking couldn't load (no melody, drums still work).
  onStarted: (cameraOk: boolean, trackingOk: boolean) => void
}

export function StartOverlay(props: StartOverlayProps) {
  const [status, setStatus] = useState('')
  const [starting, setStarting] = useState(false)

  async function handleStartClick() {
    setStarting(true)
    setStatus('Loading sounds...')
    try {
      await startAudio()
    } catch (error) {
      console.error(error)
      setStatus('Could not start audio: ' + String(error))
      setStarting(false)
      return
    }

    setStatus('Opening camera...')
    let video: HTMLVideoElement | null = null
    try {
      video = await startCamera()
    } catch (error) {
      // Not fatal: drum takes work with the mic alone.
      console.error(error)
    }

    let trackingOk = false
    if (video) {
      setStatus('Loading hand tracking...')
      try {
        await startHandTracking(video)
        trackingOk = true
      } catch (error) {
        // Not fatal: drums still work, only melody needs hands.
        console.error(error)
      }
    }
    props.onStarted(video !== null, trackingOk)
  }

  return (
    <div className="start-overlay">
      <div className="start-overlay-content">
        <BrandBadge audioStarted={false} />
        <button
          className="button-filled button-download text-item"
          type="button"
          onClick={handleStartClick}
          disabled={starting}
        >
          Start
        </button>
        <p className="start-overlay-status text-label color-muted">{status}</p>
      </div>
      <a className="test-page-link text-label" href="/test.html">
        Test page
      </a>
    </div>
  )
}
