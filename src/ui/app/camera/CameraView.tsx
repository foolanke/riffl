// Camera panel (design.md 3.1, 3.2): the live mirrored webcam with the HUD
// strip on top, and the hint pill at the bottom. While a melody layer is
// active: the melody guide and the piano overlay (design.md 4.3). While a
// drum layer is active: the object markers (design.md 4.2), passed in.
// The engine owns the <video> (vision/camera.ts); this just shows it.
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { getCameraVideo } from '../../../vision/camera.ts'
import { HintPill } from './HintPill.tsx'
import { HudStrip } from './HudStrip.tsx'
import { MelodyGuide } from './MelodyGuide.tsx'
import { PianoOverlay } from './PianoOverlay.tsx'

interface CameraViewProps {
  hudLabel: string // "SETUP / CAMERA" or "LAYER 01 / SNARE"
  hintText: string | null // null = no hint pill
  cameraOk: boolean
  melodyActive: boolean // show the melody guide and piano overlay
  objectMarkers?: ReactNode // drum layer: object boxes (ObjectMarkers.tsx)
}

export function CameraView(props: CameraViewProps) {
  const videoHolderRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    const holder = videoHolderRef.current
    const video = getCameraVideo()
    if (holder && video && video.parentElement !== holder) {
      // Clear any inline sizing so the stylesheet controls it (cover, mirrored holder).
      video.removeAttribute('style')
      holder.appendChild(video)
    }
  }, [])

  // Stacking order, bottom to top (design.md 3.2): video, guide, HUD,
  // object markers, piano overlay, hint pill.
  return (
    <div className="camera">
      <div className="camera-video" ref={videoHolderRef} />
      {props.cameraOk ? null : (
        <div className="camera-message">
          <span className="text-label color-muted">Camera unavailable. Drum takes still work with the mic.</span>
        </div>
      )}
      {props.melodyActive && props.cameraOk ? <MelodyGuide /> : null}
      <HudStrip label={props.hudLabel} />
      {props.objectMarkers}
      {props.melodyActive ? <PianoOverlay /> : null}
      {props.hintText !== null ? <HintPill text={props.hintText} raised={props.melodyActive} /> : null}
    </div>
  )
}
