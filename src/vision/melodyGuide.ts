// Melody screen layout (SPEC 3.2, 3.3, step 25): which column each hand
// is in, and which note each fingertip plays there.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
//
// Columns are defined on the MIRRORED screen (what the user sees), so
// everything here uses screen x = 1 - camera x. Hand points stay in camera
// coordinates like the rest of vision/.
import type { HandFrame, HandPoint, HandSide } from './handTracking.ts'
import { applyAccidental } from '../audio/instruments.ts'
import type { Accidental } from '../audio/instruments.ts'

// SPEC 3.2: left C4-C5, middle C5-C6, right C6-C7 (screen left to right).
export const COLUMN_COUNT = 3
const COLUMN_START_OCTAVES = [4, 5, 6]

// Dead zone (SPEC 3.2): a hand only moves to the next column once it is
// this far past the border (fraction of screen width). About 4% of a
// 640px view is ~25px, enough to stop jitter at the line without making
// the switch feel sticky.
const DEAD_ZONE = 0.04

// Optional column layout for the designed page (additive). The test page
// never calls the setters below, so it keeps the defaults: columns split
// the full camera width and a hand's position is its palm.
//
// Column area: the part of the mirrored screen (0-1 of the camera image)
// that the three columns divide equally. The designed page crops the
// camera to fill its panel and draws one piano octave per column, so it
// sets this to the piano overlay's span. Outside the area a hand counts
// as being in the nearest edge column.
let columnAreaLeft = 0
let columnAreaRight = 1

// Which point decides a hand's column. 'thumb' is the thumb tip: every
// pinch happens there, so the note plays in the column the user sees the
// fingers touch in, even when the palm is on the other side of a border.
export type ColumnPoint = 'palm' | 'thumb'
let columnPoint: ColumnPoint = 'palm'
const THUMB_TIP = 4

export function setColumnArea(left: number, right: number): void {
  if (right - left > 0.0001) {
    columnAreaLeft = left
    columnAreaRight = right
  }
}

export function setColumnPoint(point: ColumnPoint): void {
  columnPoint = point
}

// ---- Octave rows (designed page only, additive) ----
// The human asked for the octaves to be stacked instead of side by side:
// the screen is cut into three horizontal bands, top = C6, middle = C5,
// bottom = C4, so moving a hand up and down changes the octave. Same dead
// zone and the same deciding point (thumb tip or palm) as the columns.
// The test page never calls this and keeps SPEC 3.2's columns.
export type OctaveLayout = 'columns' | 'rows'
let octaveLayout: OctaveLayout = 'columns'
// The part of the camera image (0-1, top to bottom) the three rows divide:
// the designed page sets it to the visible part of its cropped camera.
let rowAreaTop = 0
let rowAreaBottom = 1

export function setOctaveLayout(layout: OctaveLayout): void {
  if (layout !== octaveLayout) {
    octaveLayout = layout
    currentColumn.left = null // the old zone means nothing in the new layout
    currentColumn.right = null
  }
}

export function setRowArea(top: number, bottom: number): void {
  if (bottom - top > 0.0001) {
    rowAreaTop = top
    rowAreaBottom = bottom
  }
}

// Where the border above `row` sits (0-1 of the camera image, top to
// bottom). Border 0 is the area's top edge, COLUMN_COUNT its bottom.
export function getRowBorder(row: number): number {
  return rowAreaTop + (row / COLUMN_COUNT) * (rowAreaBottom - rowAreaTop)
}

// The octave a row plays: row 0 (top) is the highest.
export function getRowOctave(row: number): number {
  return COLUMN_START_OCTAVES[COLUMN_COUNT - 1 - row]
}

// Where the border before `column` sits on the mirrored screen (0-1 of the
// camera image). Border 0 is the area's left edge, COLUMN_COUNT its right.
export function getColumnBorder(column: number): number {
  return columnAreaLeft + (column / COLUMN_COUNT) * (columnAreaRight - columnAreaLeft)
}

// ---- Accidentals from wrist tilt (designed page only, additive) ----
// The human overrode SPEC 3.3 (white keys only) for the designed page: a
// hand tilted right plays sharps, tilted left plays flats, upright plays
// naturals. Off by default, so the test page keeps white keys only.
//
// Tilt = angle of the line from the wrist to the base of the middle finger,
// away from straight up, on the MIRRORED screen (what the user sees):
// positive = the top of the hand leans right. This line barely moves when
// fingers pinch, so pinching doesn't change the accidental.
// Hysteresis like the column dead zone: a hand has to tilt past ENTER to
// switch to sharp/flat, and come back inside EXIT to be natural again.
// The human asked for the outward lean to be lighter: the left hand's flat
// (lean left) and the right hand's sharp (lean right) need only 12 degrees,
// while the inward lean (left hand sharp, right hand flat) stays at 22.
// EXIT is a few degrees under ENTER so a wobbling hand doesn't flicker.
const TILT_OUTWARD_ENTER_DEGREES = 12
const TILT_OUTWARD_EXIT_DEGREES = 6
const TILT_INWARD_ENTER_DEGREES = 22
const TILT_INWARD_EXIT_DEGREES = 14
const WRIST = 0
const MIDDLE_FINGER_BASE = 9

let accidentalsOn = false
const currentAccidental: Record<HandSide, Accidental> = { left: 0, right: 0 }

export function setAccidentalsEnabled(on: boolean): void {
  accidentalsOn = on
  currentAccidental.left = 0
  currentAccidental.right = 0
}

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
  pitch: string // e.g. "G4", or "F#4" / "Bb4" with an accidental
  natural: string // the white key under the finger, e.g. "F4"
}

export interface GuideHand {
  side: HandSide
  // Octave zone. Columns: 0 = left column, 2 = right (screen).
  // Rows (designed page): 0 = top row, 2 = bottom row.
  column: number
  octave: number // the octave the zone plays (C of the zone), e.g. 5
  palm: HandPoint // camera coordinates
  fingers: GuideFinger[]
  points: HandPoint[] // all 21 tracked points, for pinch detection
  tiltDegrees: number // + leans right on screen, - leans left
  accidental: Accidental // from the tilt; always 0 unless accidentals are on
  worldPoints?: HandPoint[] // the same points in meters (see HandFrame.world)
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

    const tiltDegrees = getTiltDegrees(points, frame.aspect)
    const accidental = accidentalsOn ? updateAccidental(side, tiltDegrees) : 0
    const palm = getPalmCenter(points)
    const zonePoint = columnPoint === 'thumb' ? points[THUMB_TIP] : palm
    let column = 0
    let octave = 4
    if (octaveLayout === 'rows') {
      // Image y isn't mirrored: 0 is the top of the picture, as on screen.
      const areaY = (zonePoint.y - rowAreaTop) / (rowAreaBottom - rowAreaTop)
      column = updateColumnInArea(side, areaY)
      octave = getRowOctave(column)
    } else {
      column = updateColumn(side, 1 - zonePoint.x)
      octave = COLUMN_START_OCTAVES[column]
    }
    guideHands.push({
      side: side,
      column: column,
      octave: octave,
      palm: palm,
      fingers: getFingers(points, side, octave, accidental),
      points: points,
      tiltDegrees: tiltDegrees,
      accidental: accidental,
      worldPoints: frame.world ? frame.world[i] : undefined,
    })
  }

  // A hand that left the picture starts fresh when it comes back.
  if (!seen.left) {
    currentColumn.left = null
    currentAccidental.left = 0
  }
  if (!seen.right) {
    currentColumn.right = null
    currentAccidental.right = 0
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
  // Measure inside the column area (the full width unless the page set one),
  // so the dead zone is a fraction of the area too.
  const areaX = (screenX - columnAreaLeft) / (columnAreaRight - columnAreaLeft)
  return updateColumnInArea(side, areaX)
}

// Works for rows too: position 0-1 along the area (top to bottom), and
// "left/right" then mean "up/down".
function updateColumnInArea(side: HandSide, screenX: number): number {
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

function getFingers(points: HandPoint[], side: HandSide, zoneOctave: number, accidental: Accidental): GuideFinger[] {
  const fingers: GuideFinger[] = []
  for (const fingertip of FINGERTIPS) {
    const note = FINGER_NOTES[side][fingertip.finger]
    const octave = zoneOctave + note.octaveOffset
    const natural = note.letter + octave
    fingers.push({
      finger: fingertip.finger,
      tip: points[fingertip.landmark],
      pitch: applyAccidental(natural, accidental),
      natural: natural,
    })
  }
  return fingers
}

// Wrist-to-knuckle angle from straight up on the mirrored screen, in
// degrees. Image y grows downward and x is mirrored, hence the minus signs;
// y is scaled to width units so the angle is true on screen.
function getTiltDegrees(points: HandPoint[], aspect: number): number {
  const wrist = points[WRIST]
  const knuckle = points[MIDDLE_FINGER_BASE]
  const right = -(knuckle.x - wrist.x)
  const up = -(knuckle.y - wrist.y) / aspect
  return (Math.atan2(right, up) * 180) / Math.PI
}

function updateAccidental(side: HandSide, tiltDegrees: number): Accidental {
  // Sharp is a lean right: outward for the right hand, inward for the left.
  const sharpEnter = side === 'right' ? TILT_OUTWARD_ENTER_DEGREES : TILT_INWARD_ENTER_DEGREES
  const sharpExit = side === 'right' ? TILT_OUTWARD_EXIT_DEGREES : TILT_INWARD_EXIT_DEGREES
  // Flat is a lean left: outward for the left hand, inward for the right.
  const flatEnter = side === 'left' ? TILT_OUTWARD_ENTER_DEGREES : TILT_INWARD_ENTER_DEGREES
  const flatExit = side === 'left' ? TILT_OUTWARD_EXIT_DEGREES : TILT_INWARD_EXIT_DEGREES

  const current = currentAccidental[side]
  let next: Accidental = current
  if (current === 0) {
    if (tiltDegrees > sharpEnter) {
      next = 1
    } else if (tiltDegrees < -flatEnter) {
      next = -1
    }
  } else if (current === 1 && tiltDegrees < sharpExit) {
    next = tiltDegrees < -flatEnter ? -1 : 0
  } else if (current === -1 && tiltDegrees > -flatExit) {
    next = tiltDegrees > sharpEnter ? 1 : 0
  }
  currentAccidental[side] = next
  return next
}
