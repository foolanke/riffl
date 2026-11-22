// Melody guide over the camera (SPEC 3.9, design.md 10 Q8, styled in the
// design's tokens): the octave row borders (the human asked for octaves
// stacked top to bottom on this page instead of SPEC 3.2's columns: top
// C6, middle C5, bottom C4), the tracked finger joints, the note name on
// each fingertip for the row that hand is in, and the notes playing right
// now shown large. The instrument is in the HUD strip.
//
// Drawn on a canvas every screen frame from the engine (hand tracking and
// liveMelody), so React never re-renders per frame (SPEC 0.1).
import { useEffect, useRef } from 'react'
import * as Tone from 'tone'
import {
  getHeldNotes,
  getLastFlatPinchDistances,
  getLastPinchBlocks,
  getLastPinchDistances,
} from '../../../audio/liveMelody.ts'
import { formatPitch } from '../../../audio/instruments.ts'
import { getLatestHandFrame, getTrackingTimings } from '../../../vision/handTracking.ts'
import type { HandPoint, HandSide } from '../../../vision/handTracking.ts'
import {
  COLUMN_COUNT,
  getGuideHands,
  getRowBorder,
  setColumnPoint,
  setOctaveLayout,
  setRowArea,
} from '../../../vision/melodyGuide.ts'
import { getImageFit, imageToPanel } from './imageFit.ts'
import type { ImageFit } from './imageFit.ts'

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

// Tuning aid: open /?pinchdebug to see each finger's thumb distance (in
// hand sizes, "3D / flat picture") above its note label. Hidden otherwise; not part of the design.
const SHOW_PINCH_DEBUG = new URLSearchParams(window.location.search).has('pinchdebug')

export function MelodyGuide() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(function () {
    // Octaves stacked in three rows: top C6, middle C5, bottom C4 (with a
    // key set, each row starts on the key's root nearest that C).
    setOctaveLayout('rows')
    // Decide a hand's row where the pinch happens (the thumb tip), not
    // at the palm, so the note matches the row the fingers touch in.
    setColumnPoint('thumb')
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

  // Tell the engine which part of the (cropped) camera image the rows
  // cover: exactly the visible panel, top to bottom, so the three bands on
  // screen are the real hitboxes.
  const areaTop = (0 - fit.offsetY) / fit.height
  const areaBottom = (layoutHeight - fit.offsetY) / fit.height
  setRowArea(areaTop, areaBottom)

  // Row borders, at the same places the engine switches octaves.
  context.fillStyle = COLOR_FG
  for (let row = 1; row < COLUMN_COUNT; row++) {
    const y = Math.round(fit.offsetY + getRowBorder(row) * fit.height)
    context.fillRect(0, y, layoutWidth, 1)
  }

  const frame = getLatestHandFrame()
  const hands = getGuideHands(frame)

  for (const hand of hands) {
    drawJoints(context, hand.points, fit)
  }

  context.font = FONT_LABEL
  context.letterSpacing = '1.44px'
  for (const hand of hands) {
    const heldNotes = getHeldNotes(hand.side)
    // Which hand the app thinks this is, so a mix-up is easy to spot, plus
    // the accidental its tilt is playing (right = sharp, left = flat).
    const palm = imageToPanel(hand.palm, fit)
    let handLabel = hand.side === 'left' ? 'LEFT' : 'RIGHT'
    if (hand.accidental === 1) {
      handLabel += ' ♯'
    } else if (hand.accidental === -1) {
      handLabel += ' ♭'
    }
    if (SHOW_PINCH_DEBUG) {
      handLabel += ' ' + hand.tiltDegrees.toFixed(0) + '°'
    }
    // Inverted while sharp or flat, so the change is easy to see.
    const tilted = hand.accidental !== 0
    drawPill(context, handLabel, palm.x, palm.y, tilted ? COLOR_FG : COLOR_OVERLAY, tilted ? COLOR_BG : COLOR_FG_MUTED, 4)

    for (const finger of hand.fingers) {
      // Just above the fingertip, so the label doesn't cover the finger.
      // The pinched finger is inverted (white pill, black text).
      const tip = imageToPanel(finger.tip, fit)
      let isPinched = false
      for (const note of heldNotes) {
        if (note.finger === finger.finger) {
          isPinched = true
        }
      }
      drawPill(
        context,
        formatPitch(finger.pitch),
        tip.x,
        tip.y - 20,
        isPinched ? COLOR_FG : COLOR_OVERLAY,
        isPinched ? COLOR_BG : COLOR_FG,
        4,
      )
      const distances = SHOW_PINCH_DEBUG ? getLastPinchDistances(hand.side) : null
      const flatDistances = SHOW_PINCH_DEBUG ? getLastFlatPinchDistances(hand.side) : null
      if (distances !== null) {
        let text = distances[finger.finger].toFixed(2)
        if (flatDistances !== null) {
          text += ' / ' + flatDistances[finger.finger].toFixed(2)
        }
        // Why it didn't play, if something blocked it (ACROSS / DEPTH / EXTRA).
        const blocks = getLastPinchBlocks(hand.side)
        if (blocks !== null && blocks[finger.finger] !== '') {
          text += ' ' + blocks[finger.finger].toUpperCase()
        }
        drawPill(context, text, tip.x, tip.y - 46, COLOR_OVERLAY, COLOR_FG_MUTED, 4)
      }
    }
  }

  // The notes playing now, large, top centre (SPEC 3.9). Left hand's note
  // first, like on screen.
  const playing: string[] = []
  for (const side of SIDES) {
    for (const note of getHeldNotes(side)) {
      playing.push(formatPitch(note.pitch))
    }
  }
  if (playing.length > 0) {
    context.font = FONT_NOW_PLAYING
    context.letterSpacing = '1.44px'
    drawPill(context, playing.join('  '), layoutWidth / 2, 15 + 36, COLOR_OVERLAY, COLOR_FG, 8, 72)
  }
  if (SHOW_PINCH_DEBUG) {
    drawTimingReadout(context, layoutWidth)
  }
  context.letterSpacing = '0px'
}

// Where the pinch-to-sound time goes (/?pinchdebug): camera frame rate,
// model time per frame, how frames reach us, and the audio output delay
// reported by the browser (Bluetooth speakers add a lot here).
function drawTimingReadout(context: CanvasRenderingContext2D, layoutWidth: number) {
  const timings = getTrackingTimings()
  const audio = Tone.getContext().rawContext as AudioContext
  const audioMs = ((audio.baseLatency || 0) + (audio.outputLatency || 0)) * 1000
  const text =
    'CAMERA ' + timings.fps + ' FPS · TRACKING ' + timings.detectMs.toFixed(0) + ' MS · ' +
    (timings.source === 'stream' ? 'FAST FRAMES' : 'VIDEO FRAMES') + ' · AUDIO OUT ' + audioMs.toFixed(0) + ' MS'
  context.font = FONT_LABEL
  drawPill(context, text, layoutWidth / 2, 110, COLOR_OVERLAY, COLOR_FG_MUTED, 4)
}

// Thin bones and small joint dots for one hand.
function drawJoints(context: CanvasRenderingContext2D, points: HandPoint[], fit: ImageFit) {
  const screenPoints: { x: number; y: number }[] = []
  for (const point of points) {
    screenPoints.push(imageToPanel(point, fit))
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
