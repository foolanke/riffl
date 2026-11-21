// Camera feed with hand dots and object boxes (SPEC steps 19-22, 24).
// The engine owns the <video>; this panel just shows it and draws on top.
//
// Object boxes (step 21): pick a drum, then drag a box around the object
// on the video. Click a box to choose it for the next take (step 24).
// A box lights up while a hand is inside it (step 22).
//
// Melody guide (step 25, SPEC 3.2, 3.3, 3.9): the 3 note columns, and the
// note name on each fingertip for the column that hand is in.
// Live notes (step 26, SPEC 3.4, 3.6): the playing notes shown large, the
// pinched fingertip highlighted, and a pinch-distance readout for tuning.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent } from 'react'
import { DRUMS, getDrumLabel } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import { getHeldNote, getLastPinchDistances, setLiveMelodyOn } from '../audio/liveMelody.ts'
import { getRecorderState, selectObjectForTake, subscribeToRecorder } from '../audio/recorder.ts'
import { addObject, deleteObject, getProject, setObjectDrum } from '../project/projectStore.ts'
import type { Box } from '../project/projectStore.ts'
import { startCamera } from '../vision/camera.ts'
import { getLatestHandFrame, getTrackingFps, startHandTracking } from '../vision/handTracking.ts'
import type { HandFrame, HandPoint, HandSide } from '../vision/handTracking.ts'
import { COLUMN_COUNT, getColumnRangeLabel, getGuideHands } from '../vision/melodyGuide.ts'
import { MIN_BOX_SIZE, findObjectAtPoint, isHandInBox, makeBoxFromCorners } from '../vision/objects.ts'
import { PINCH_PRESS_DISTANCE, PINCH_RELEASE_DISTANCE } from '../vision/pinch.ts'
import { useProject } from './hooks.ts'

const DISPLAY_WIDTH = 640
const DISPLAY_HEIGHT = 360

export function CameraPanel() {
  const [status, setStatus] = useState('Camera off.')
  const [cameraOn, setCameraOn] = useState(false)
  const [newObjectDrum, setNewObjectDrum] = useState<DrumName>('kick')
  const [showMelodyGuide, setShowMelodyGuide] = useState(true)
  // The draw loop reads this ref, so toggling doesn't restart the loop.
  const showMelodyGuideRef = useRef(true)
  showMelodyGuideRef.current = showMelodyGuide
  const objects = useProject().objects
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const videoHolderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLSpanElement>(null)
  const pinchReadoutRef = useRef<HTMLSpanElement>(null)
  // The box being dragged, in camera-image coordinates. A ref so the draw
  // loop sees it without re-rendering on every mouse move.
  const dragRef = useRef<{ start: HandPoint; current: HandPoint } | null>(null)

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
      // 'fill' keeps the dots and boxes lined up with the picture even if the
      // camera isn't 16:9 (the picture may stretch slightly instead).
      video.style.objectFit = 'fill'
      holder.appendChild(video)
    }
  }

  // ---- Mouse: drag to make a box, click to choose one ----

  // The video is mirrored on screen, so screen x is flipped back to camera x.
  function toImagePoint(event: PointerEvent<HTMLCanvasElement>): HandPoint {
    const rect = event.currentTarget.getBoundingClientRect()
    const screenX = (event.clientX - rect.left) / rect.width
    const screenY = (event.clientY - rect.top) / rect.height
    return { x: 1 - screenX, y: screenY }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toImagePoint(event)
    dragRef.current = { start: point, current: point }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      dragRef.current.current = toImagePoint(event)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) {
      return
    }
    const box = makeBoxFromCorners(drag.start, toImagePoint(event))
    if (box.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE) {
      const id = crypto.randomUUID()
      addObject({ id: id, drum: newObjectDrum, box: box })
      selectObjectForTake(id) // the object just set up is the one you'll play next
    } else {
      // A click: choose the box under the mouse, or none.
      const clicked = findObjectAtPoint(getProject().objects, drag.start)
      selectObjectForTake(clicked ? clicked.id : null)
    }
  }

  function handleDeleteObject(objectId: string) {
    if (getRecorderState().takeObjectId === objectId) {
      selectObjectForTake(null)
    }
    deleteObject(objectId)
  }

  function handleObjectDrumChange(objectId: string, drum: DrumName) {
    setObjectDrum(objectId, drum)
    // Keep the take's drum in step with the chosen object.
    if (getRecorderState().takeObjectId === objectId) {
      selectObjectForTake(objectId)
    }
  }

  // Draw boxes and dots every screen frame. Reads engine data directly
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
          drawOverlay(context, canvas.width, canvas.height, dragRef.current, showMelodyGuideRef.current)
        }
        if (fpsRef.current) {
          fpsRef.current.textContent = String(getTrackingFps())
        }
        if (pinchReadoutRef.current) {
          pinchReadoutRef.current.textContent = getPinchReadout()
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
      <p>
        <label>
          Drum for new object:{' '}
          <select
            value={newObjectDrum}
            onChange={(event) => {
              setNewObjectDrum(event.target.value as DrumName)
              event.target.blur() // so Space records instead of opening the list
            }}
          >
            {DRUMS.map((drum) => (
              <option key={drum.name} value={drum.name}>
                {drum.label}
              </option>
            ))}
          </select>
        </label>{' '}
        then drag a box around the object on the video. Click a box to use it for the next take.
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={showMelodyGuide}
            onChange={(event) => {
              setShowMelodyGuide(event.target.checked)
              setLiveMelodyOn(event.target.checked)
              event.target.blur()
            }}
          />{' '}
          Melody: guide and live notes (pinch thumb to a finger to play)
        </label>
      </p>
      <p>
        Pinch distance (press below {PINCH_PRESS_DISTANCE}, release above {PINCH_RELEASE_DISTANCE}):{' '}
        <span ref={pinchReadoutRef} style={{ fontFamily: 'monospace' }} />
      </p>
      <div
        style={{
          position: 'relative',
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          background: 'black',
          display: cameraOn ? 'block' : 'none',
        }}
      >
        {/* Only the video is mirrored (feels like a mirror). The canvas is not,
            so its text reads normally; drawing flips x itself. */}
        <div ref={videoHolderRef} style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
        <canvas
          ref={canvasRef}
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ position: 'absolute', left: 0, top: 0, cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null
          }}
        />
      </div>

      {objects.length === 0 ? <p>No objects yet.</p> : null}
      <ol>
        {objects.map((object) => (
          <li key={object.id}>
            <select
              value={object.drum}
              onChange={(event) => {
                handleObjectDrumChange(object.id, event.target.value as DrumName)
                event.target.blur()
              }}
            >
              {DRUMS.map((drum) => (
                <option key={drum.name} value={drum.name}>
                  {drum.label}
                </option>
              ))}
            </select>{' '}
            {recorder.takeObjectId === object.id ? (
              <strong>[next take]</strong>
            ) : (
              <button onClick={() => selectObjectForTake(object.id)}>Use for next take</button>
            )}{' '}
            <button onClick={() => handleDeleteObject(object.id)} disabled={recorder.status !== 'idle'}>
              Delete
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  )
}

// ---- Drawing (camera-image coordinates -> mirrored screen) ----

function drawOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  drag: { start: HandPoint; current: HandPoint } | null,
  showMelodyGuide: boolean,
) {
  context.clearRect(0, 0, width, height)
  const frame = getLatestHandFrame()

  if (showMelodyGuide) {
    drawMelodyGuide(context, width, height, frame)
  }
  const selectedId = getRecorderState().takeObjectId

  for (const object of getProject().objects) {
    const handInside = isHandInBox(frame, object.box)
    const isSelected = object.id === selectedId
    const rect = toScreenRect(object.box, width, height)

    // Lit up while a hand is inside (step 22).
    if (handInside) {
      context.fillStyle = 'rgba(255, 220, 0, 0.45)'
      context.fillRect(rect.left, rect.top, rect.width, rect.height)
    }
    context.strokeStyle = handInside ? 'yellow' : 'white'
    context.lineWidth = isSelected ? 4 : 2
    context.strokeRect(rect.left, rect.top, rect.width, rect.height)

    const label = getDrumLabel(object.drum) + (isSelected ? ' (next take)' : '')
    context.font = '16px sans-serif'
    const labelWidth = context.measureText(label).width + 8
    context.fillStyle = 'rgba(0, 0, 0, 0.7)'
    context.fillRect(rect.left, rect.top, labelWidth, 22)
    context.fillStyle = 'white'
    context.fillText(label, rect.left + 4, rect.top + 16)
  }

  // The box being dragged.
  if (drag) {
    const rect = toScreenRect(makeBoxFromCorners(drag.start, drag.current), width, height)
    context.setLineDash([6, 4])
    context.strokeStyle = 'cyan'
    context.lineWidth = 2
    context.strokeRect(rect.left, rect.top, rect.width, rect.height)
    context.setLineDash([])
  }

  // Hand dots.
  context.fillStyle = 'lime'
  for (const hand of frame.hands) {
    for (const point of hand) {
      context.beginPath()
      context.arc((1 - point.x) * width, point.y * height, 4, 0, Math.PI * 2)
      context.fill()
    }
  }
}

// Column borders and ranges, then each hand's side and fingertip notes.
// Drawn under the hand dots so the dots stay visible.
function drawMelodyGuide(context: CanvasRenderingContext2D, width: number, height: number, frame: HandFrame) {
  const columnWidth = width / COLUMN_COUNT

  context.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  context.lineWidth = 2
  for (let column = 1; column < COLUMN_COUNT; column++) {
    context.beginPath()
    context.moveTo(column * columnWidth, 0)
    context.lineTo(column * columnWidth, height)
    context.stroke()
  }

  context.font = 'bold 16px sans-serif'
  context.textAlign = 'center'
  for (let column = 0; column < COLUMN_COUNT; column++) {
    drawLabel(context, getColumnRangeLabel(column), (column + 0.5) * columnWidth, height - 14, 'white')
  }

  for (const hand of getGuideHands(frame)) {
    const heldNote = getHeldNote(hand.side)
    // Which hand the app thinks this is, so a mix-up is easy to spot.
    context.font = 'bold 14px sans-serif'
    const sideText = hand.side === 'left' ? 'LEFT hand' : 'RIGHT hand'
    drawLabel(context, sideText, (1 - hand.palm.x) * width, hand.palm.y * height, 'cyan')

    context.font = 'bold 15px sans-serif'
    for (const finger of hand.fingers) {
      // Just above the fingertip, so the label doesn't cover the finger.
      // The pinched finger turns green.
      const isPinched = heldNote !== null && heldNote.finger === finger.finger
      const color = isPinched ? 'lime' : 'yellow'
      drawLabel(context, finger.pitch, (1 - finger.tip.x) * width, finger.tip.y * height - 18, color)
    }
  }

  // The notes playing right now, large (SPEC 3.9). Left hand's note on
  // the left, right hand's on the right, like on screen.
  const playing: string[] = []
  for (const side of ['left', 'right'] as HandSide[]) {
    const heldNote = getHeldNote(side)
    if (heldNote !== null) {
      playing.push(heldNote.pitch)
    }
  }
  if (playing.length > 0) {
    context.font = 'bold 48px sans-serif'
    drawLabel(context, playing.join('  '), width / 2, 40, 'lime', 56)
  }
  context.textAlign = 'left'
}

// "L index 0.92 middle 1.10 ... | R ..." for tuning the pinch thresholds.
function getPinchReadout(): string {
  const parts: string[] = []
  for (const side of ['left', 'right'] as HandSide[]) {
    const distances = getLastPinchDistances(side)
    const name = side === 'left' ? 'L' : 'R'
    if (distances === null) {
      parts.push(name + ' -')
    } else {
      parts.push(
        `${name} index ${distances.index.toFixed(2)} middle ${distances.middle.toFixed(2)} ` +
          `ring ${distances.ring.toFixed(2)} pinky ${distances.pinky.toFixed(2)}`,
      )
    }
  }
  return parts.join(' | ')
}

// Centered text on a dark background so it reads over any video.
// boxHeight should be a little more than the font size.
function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  color: string,
  boxHeight: number = 20,
) {
  const textWidth = context.measureText(text).width
  context.fillStyle = 'rgba(0, 0, 0, 0.7)'
  context.fillRect(centerX - textWidth / 2 - 4, centerY - boxHeight / 2, textWidth + 8, boxHeight)
  context.fillStyle = color
  context.textBaseline = 'middle'
  context.fillText(text, centerX, centerY)
  context.textBaseline = 'alphabetic'
}

// A box in camera coordinates as a rectangle on the mirrored screen.
function toScreenRect(box: Box, width: number, height: number) {
  return {
    left: (1 - box.x - box.width) * width,
    top: box.y * height,
    width: box.width * width,
    height: box.height * height,
  }
}
