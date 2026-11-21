// Pinch detection (SPEC 3.4, step 26): thumb tip touching a fingertip.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
//
// - Distances are divided by the hand's size, so it works the same with
//   the hand near or far from the camera.
// - Separate press and release thresholds (hysteresis), so a note doesn't
//   flicker on and off when the fingers hover at the edge.
// - One pinch per hand. If several fingers are close, the closest wins.
//   Once pinched, that finger stays the note until it is released.
import type { FingerName } from './melodyGuide.ts'
import type { HandPoint, HandSide } from './handTracking.ts'

// In hand sizes (wrist to the base of the middle finger). Touching
// fingertips measure roughly 0.15-0.3; an open hand is around 1.
// Tune these with the readout under the camera view.
export const PINCH_PRESS_DISTANCE = 0.35
export const PINCH_RELEASE_DISTANCE = 0.5

const WRIST = 0
const MIDDLE_FINGER_BASE = 9
const THUMB_TIP = 4
const FINGERTIP_LANDMARKS: { finger: FingerName; landmark: number }[] = [
  { finger: 'index', landmark: 8 },
  { finger: 'middle', landmark: 12 },
  { finger: 'ring', landmark: 16 },
  { finger: 'pinky', landmark: 20 },
]

export type PinchDistances = Record<FingerName, number>

// The finger each hand is pinching right now, or null.
const activeFinger: Record<HandSide, FingerName | null> = { left: null, right: null }

// Thumb-to-fingertip distance for each finger, in hand sizes.
export function getPinchDistances(points: HandPoint[], aspect: number): PinchDistances {
  const handSize = Math.max(0.0001, getDistance(points[WRIST], points[MIDDLE_FINGER_BASE], aspect))
  const thumb = points[THUMB_TIP]
  const distances: PinchDistances = { index: 0, middle: 0, ring: 0, pinky: 0 }
  for (const fingertip of FINGERTIP_LANDMARKS) {
    distances[fingertip.finger] = getDistance(thumb, points[fingertip.landmark], aspect) / handSize
  }
  return distances
}

// Updates one hand's pinch from this frame's distances. Returns the
// finger being pinched after this frame, or null.
export function updatePinch(side: HandSide, distances: PinchDistances): FingerName | null {
  const current = activeFinger[side]
  if (current !== null) {
    if (distances[current] <= PINCH_RELEASE_DISTANCE) {
      return current // still held
    }
    activeFinger[side] = null
  }

  // Not pinching: start on the closest finger under the press threshold.
  let closest: FingerName | null = null
  for (const fingertip of FINGERTIP_LANDMARKS) {
    const distance = distances[fingertip.finger]
    if (distance < PINCH_PRESS_DISTANCE && (closest === null || distance < distances[closest])) {
      closest = fingertip.finger
    }
  }
  activeFinger[side] = closest
  return closest
}

// The hand is gone, so it is not pinching anything.
export function resetPinch(side: HandSide): void {
  activeFinger[side] = null
}

// Distance in units of image width. y is scaled by the aspect ratio
// because x and y are fractions of different lengths (width vs height).
// z is already on roughly the same scale as x.
function getDistance(a: HandPoint, b: HandPoint, aspect: number): number {
  const dx = a.x - b.x
  const dy = (a.y - b.y) / aspect
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
