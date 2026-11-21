// Camera feed with hand dots on top (SPEC steps 19-20).
// The engine owns the <video>; this panel just shows it and draws dots.
import { useEffect, useRef, useState } from 'react'
import { startCamera } from '../vision/camera.ts'
import { getLatestHandFrame, getTrackingFps, startHandTracking } from '../vision/handTracking.ts'

const DISPLAY_WIDTH = 640
const DISPLAY_HEIGHT = 360

export function CameraPanel() {
  const [status, setStatus] = useState('Camera off.')
  const [cameraOn, setCameraOn] = useState(false)
  const videoHolderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLSpanElement>(null)

  async function handleEnableClick() {
    setStatus('Asking for camera...')
    try {
      const video = await startCamera()
      showVideo(video)
      setCameraOn(true)
      setStatus('Loading hand tracking...')
      await startHandTracking(video)
      setStatus('Camera on, tracking hands.')
    } catch (error) {
      console.error(error)
      setStatus('Camera problem: ' + String(error))
    }
  }

  function showVideo(video: HTMLVideoElement) {
    const holder = videoHolderRef.current
    if (holder && video.parentElement !== holder) {
      video.style.width = '100%'
      video.style.height = '100%'
      // 'fill' keeps the dots lined up with the hand even if the camera
      // isn't 16:9 (the picture may stretch slightly instead).
      video.style.objectFit = 'fill'
      holder.appendChild(video)
    }
  }

  // Draw the dots every screen frame. Reads engine data directly
  // instead of React state so it doesn't re-render 60 times a second.
  useEffect(
    function () {
      if (!cameraOn) {
        return
      }
      let frameId = 0
      function draw() {
        const canvas = canvasRef.current
        const context = canvas ? canvas.getContext('2d') : null
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height)
          const frame = getLatestHandFrame()
          for (const hand of frame.hands) {
            for (const point of hand) {
              context.beginPath()
              context.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2)
              context.fillStyle = 'lime'
              context.fill()
            }
          }
        }
        if (fpsRef.current) {
          fpsRef.current.textContent = String(getTrackingFps())
        }
        frameId = requestAnimationFrame(draw)
      }
      frameId = requestAnimationFrame(draw)
      return function () {
        cancelAnimationFrame(frameId)
      }
    },
    [cameraOn],
  )

  return (
    <fieldset>
      <legend>Camera</legend>
      <button onClick={handleEnableClick} disabled={cameraOn}>
        Enable camera
      </button>{' '}
      <span>{status}</span>
      <p>
        Hand tracking: <span ref={fpsRef}>0</span> frames per second
      </p>
      {/* Mirrored so it feels like a mirror. Video and dots flip together. */}
      <div
        style={{
          position: 'relative',
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          transform: 'scaleX(-1)',
          background: 'black',
          display: cameraOn ? 'block' : 'none',
        }}
      >
        <div ref={videoHolderRef} style={{ width: '100%', height: '100%' }} />
        <canvas
          ref={canvasRef}
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
      </div>
    </fieldset>
  )
}
