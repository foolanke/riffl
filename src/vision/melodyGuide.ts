// Melody screen layout (SPEC 3.2, 3.3, step 25): which column each hand
// is in, and which note each fingertip plays there.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
//
// Columns are defined on the MIRRORED screen (what the user sees), so
// everything here uses screen x = 1 - camera x. Hand points stay in camera
// coordinates like the rest of vision/.
import type { HandFrame, HandPoint, HandSide } from './handTracking.ts'

// SPEC 3.2: left C4-C5, middle C5-C6, right C6-C7 (screen left to right).
export const COLUMN_COUNT = 3
const COLUMN_START_OCTAVES = [4, 5, 6]

// Dead zone (SPEC 3.2): a hand only moves to the next column once it is
// this far past the border (fraction of screen width). About 4% of a
// 640px view is ~25px, enough to stop jitter at the line without making
// the switch feel sticky.
const DEAD_ZONE = 0.04

export type FingerName = 'index' | 'middle' | 'ring' | 'pinky'

// MediaPipe landmark numbers for each fingertip.
const FINGERTIPS: { finger: FingerName; landmark: number }[] = [
  { finger: 'index', landmark: 8 },
  { finger: 'middle', landmark: 12 },
  { finger: 'ring', landmark: 16 },
  { finger: 'pinky', landmark: 20 },
]

// SPEC 3.3. Letter and octave offset within the column (C of the column = 0).
// Notes rise left to right across both hands, like a piano:
// left pinky C, ring D, middle E, index F | right index G, middle A, ring B, pinky C (+1 octave).
const FINGER_NOTES: Record<HandSide, Record<FingerName, { letter: string; octaveOffset: number }>> = {
  left: {
    pinky: { letter: 'C', octaveOffset: 0 },
    ring: { letter: 'D', octaveOffset: 0 },
    middle: { letter: 'E', octaveOffset: 0 },
    index: { letter: 'F', octaveOffset: 0 },
  },
  right: {
    index: { letter: 'G', octaveOffset: 0 },
    middle: { letter: 'A', octaveOffset: 0 },
    ring: { letter: 'B', octaveOffset: 0 },
    pinky: { letter: 'C', octaveOffset: 1 },
  },
}

export interface GuideFinger {
  finger: FingerName
  tip: HandPoint // camera coordinates
  pitch: string // e.g. "G4"
}

export interface GuideHand {
  side: HandSide
  column: number // 0 = left column, 2 = right column (screen)
  palm: HandPoint // camera coordinates
  fingers: GuideFinger[]
}

// Column each hand was in on the last frame, for the dead zone.
// null = that hand was not seen, so it picks its column fresh.
const currentColumn: Record<HandSide, number | null> = { left: null, right: null }

// Only recompute when a new camera frame arrives; the screen draws more
// often than the camera delivers frames.
let lastFrameTime = -1
let lastGuideHands: GuideHand[] = []

export function getGuideHands(frame: HandFrame): GuideHand[] {
  if (frame.time === lastFrameTime) {
    return lastGuideHands
  }
  lastFrameTime = frame.time

  const seen: Record<HandSide, boolean> = { left: false, right: false }
  const guideHands: GuideHand[] = []
  for (let i = 0; i < frame.hands.length; i++) {
    const points = frame.hands[i]
    const side = frame.sides[i]
    if (side === undefined || seen[side]) {
      continue // one hand per side
    }
    seen[side] = true

    const palm = getPalmCenter(points)
    const column = updateColumn(side, 1 - palm.x)
    guideHands.push({ side: side, column: column, palm: palm, fingers: getFingers(points, side, column) })
  }

  // A hand that left the picture starts fresh when it comes back.
  if (!seen.left) {
    currentColumn.left = null
  }
  if (!seen.right) {
    currentColumn.right = null
  }

  lastGuideHands = guideHands
  return guideHands
}

// The column's range for the on-screen labels, e.g. "C4 - C5".
export function getColumnRangeLabel(column: number): string {
  const octave = COLUMN_START_OCTAVES[column]
  return 'C' + octave + ' - C' + (octave + 1)
}

// The hand's position is its palm, not a fingertip, so pinching doesn't
// move it across a border. Wrist (0) and the base of each finger (5, 9, 13, 17).
function getPalmCenter(points: HandPoint[]): HandPoint {
  const palmLandmarks = [0, 5, 9, 13, 17]
  let sumX = 0
  let sumY = 0
  for (const index of palmLandmarks) {
    sumX += points[index].x
    sumY += points[index].y
  }
  return { x: sumX / palmLandmarks.length, y: sumY / palmLandmarks.length }
}

// screenX: 0 = left edge of the mirrored screen, 1 = right edge.
function updateColumn(side: HandSide, screenX: number): number {
  const rawColumn = Math.min(COLUMN_COUNT - 1, Math.max(0, Math.floor(screenX * COLUMN_COUNT)))
  const previous = currentColumn[side]
  let column = rawColumn
  if (previous !== null && rawColumn !== previous) {
    const columnWidth = 1 / COLUMN_COUNT
    const leftBorder = previous * columnWidth
    const rightBorder = (previous + 1) * columnWidth
    // Stay put unless clearly across the border it is moving over.
    const clearlyRight = rawColumn > previous && screenX > rightBorder + DEAD_ZONE
    const clearlyLeft = rawColumn < previous && screenX < leftBorder - DEAD_ZONE
    if (!clearlyRight && !clearlyLeft) {
      column = previous
    }
  }
  currentColumn[side] = column
  return column
}

function getFingers(points: HandPoint[], side: HandSide, column: number): GuideFinger[] {
  const fingers: GuideFinger[] = []
  for (const fingertip of FINGERTIPS) {
    const note = FINGER_NOTES[side][fingertip.finger]
    const octave = COLUMN_START_OCTAVES[column] + note.octaveOffset
    fingers.push({ finger: fingertip.finger, tip: points[fingertip.landmark], pitch: note.letter + octave })
  }
  return fingers
}
