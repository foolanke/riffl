// Melody guide over the camera (SPEC 3.9, design.md 10 Q8, styled in the
// design's tokens): the column borders, the tracked finger joints, the note
// name on each fingertip for the column that hand is in, and the notes
// playing right now shown large. The instrument is in the HUD strip and the
// column ranges are the piano overlay's octave labels.
//
// Drawn on a canvas every screen frame from the engine (hand tracking and
// liveMelody), so React never re-renders per frame (SPEC 0.1).
import { useEffect, useRef } from 'react'
import { getHeldNote } from '../../audio/liveMelody.ts'
import { getCameraVideo } from '../../vision/camera.ts'
import { getLatestHandFrame } from '../../vision/handTracking.ts'
import type { HandPoint, HandSide } from '../../vision/handTracking.ts'
import { COLUMN_COUNT, getGuideHands } from '../../vision/melodyGuide.ts'

// Token values (tokens.css). A canvas can't read CSS variables cheaply.
const COLOR_FG = '#ffffff'
const COLOR_BG = '#000000'
const COLOR_FG_MUTED = '#d9d9d9'
const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.6)'
const FONT_LABEL = '500 12px "Space Grotesk", system-ui, sans-serif'
const FONT_NOW_PLAYING = '500 48px "Space Grotesk", system-ui, sans-serif'

// MediaPipe hand joints that are connected by a bone.
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm edge
]

const SIDES: HandSide[] = ['left', 'right']

// How the camera image sits in the panel: mirrored, and scaled to cover it
// (object-fit: cover), so part of the image may be cut off.
interface ImageFit {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export function MelodyGuide() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(function () {
    let frameId = 0
    function draw() {
      const canvas = canvasRef.current
      if (canvas) {
        drawGuide(canvas)
      }
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return <canvas className="melody-guide" ref={canvasRef} />
}

function drawGuide(canvas: HTMLCanvasElement) {
  // Draw in layout pixels (what the CSS uses), but keep the bitmap sharp at
  // the real screen size, which page zoom and devicePixelRatio change.
  const layoutWidth = canvas.clientWidth
  const layoutHeight = canvas.clientHeight
  if (layoutWidth === 0 || layoutHeight === 0) {
    return
  }
  const rect = canvas.getBoundingClientRect()
  const pixelScale = (rect.width / layoutWidth) * window.devicePixelRatio
  const bitmapWidth = Math.round(layoutWidth * pixelScale)
  const bitmapHeight = Math.round(layoutHeight * pixelScale)
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0)
  context.clearRect(0, 0, layoutWidth, layoutHeight)

  const fit = getImageFit(layoutWidth, layoutHeight)

  // Column borders, at the same places the engine switches columns.
  context.fillStyle = COLOR_FG
  for (let column = 1; column < COLUMN_COUNT; column++) {
    const x = Math.round(fit.offsetX + (column / COLUMN_COUNT) * fit.width)
    context.fillRect(x, 0, 1, layoutHeight)
  }

  const frame = getLatestHandFrame()
  const hands = getGuideHands(frame)

  for (const hand of hands) {
    drawJoints(context, hand.points, fit)
  }

  context.font = FONT_LABEL
  context.letterSpacing = '1.44px'
  for (const hand of hands) {
    const held = getHeldNote(hand.side)
    // Which hand the app thinks this is, so a mix-up is easy to spot.
    const palm = toScreen(hand.palm, fit)
    drawPill(context, hand.side === 'left' ? 'LEFT' : 'RIGHT', palm.x, palm.y, COLOR_OVERLAY, COLOR_FG_MUTED, 4)

    for (const finger of hand.fingers) {
      // Just above the fingertip, so the label doesn't cover the finger.
      // The pinched finger is inverted (white pill, black text).
      const tip = toScreen(finger.tip, fit)
      const isPinched = held !== null && held.finger === finger.finger
      drawPill(
        context,
        finger.pitch,
        tip.x,
        tip.y - 20,
        isPinched ? COLOR_FG : COLOR_OVERLAY,
        isPinched ? COLOR_BG : COLOR_FG,
        4,
      )
    }
  }

  // The notes playing now, large, top centre (SPEC 3.9). Left hand's note
  // first, like on screen.
  const playing: string[] = []
  for (const side of SIDES) {
    const held = getHeldNote(side)
    if (held !== null) {
      playing.push(held.pitch)
    }
  }
  if (playing.length > 0) {
    context.font = FONT_NOW_PLAYING
    context.letterSpacing = '1.44px'
    drawPill(context, playing.join('  '), layoutWidth / 2, 15 + 36, COLOR_OVERLAY, COLOR_FG, 8, 72)
  }
  context.letterSpacing = '0px'
}

// Thin bones and small joint dots for one hand.
function drawJoints(context: CanvasRenderingContext2D, points: HandPoint[], fit: ImageFit) {
  const screenPoints: { x: number; y: number }[] = []
  for (const point of points) {
    screenPoints.push(toScreen(point, fit))
  }
  context.strokeStyle = COLOR_FG
  context.globalAlpha = 0.5
  context.lineWidth = 1
  context.beginPath()
  for (const [from, to] of BONES) {
    if (screenPoints[from] && screenPoints[to]) {
      context.moveTo(screenPoints[from].x, screenPoints[from].y)
      context.lineTo(screenPoints[to].x, screenPoints[to].y)
    }
  }
  context.stroke()
  context.globalAlpha = 1

  context.fillStyle = COLOR_FG
  for (const point of screenPoints) {
    context.beginPath()
    context.arc(point.x, point.y, 2, 0, Math.PI * 2)
    context.fill()
  }
}

// Text on a rounded pill, centred on (centerX, centerY).
// padX 8 / height 23 matches the object tag (design.md 5.17).
function drawPill(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  background: string,
  color: string,
  radius: number,
  height: number = 23,
) {
  const padX = height > 23 ? 16 : 8
  const width = context.measureText(text).width + padX * 2
  context.fillStyle = background
  context.beginPath()
  context.roundRect(centerX - width / 2, centerY - height / 2, width, height, radius)
  context.fill()
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, centerX, centerY + 1)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
}

function getImageFit(panelWidth: number, panelHeight: number): ImageFit {
  const video = getCameraVideo()
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return { offsetX: 0, offsetY: 0, width: panelWidth, height: panelHeight }
  }
  const scale = Math.max(panelWidth / video.videoWidth, panelHeight / video.videoHeight)
  const width = video.videoWidth * scale
  const height = video.videoHeight * scale
  return { offsetX: (panelWidth - width) / 2, offsetY: (panelHeight - height) / 2, width: width, height: height }
}

// A camera-image point (0-1) on the mirrored, cover-fitted screen.
function toScreen(point: HandPoint, fit: ImageFit): { x: number; y: number } {
  return { x: fit.offsetX + (1 - point.x) * fit.width, y: fit.offsetY + point.y * fit.height }
}
