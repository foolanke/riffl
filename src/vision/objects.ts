// Object boxes and hand-in-box checks (SPEC 1.2, 1.4, steps 21-23).
// Everything here is in camera-image coordinates (0..1, not mirrored).
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
import type { Box, TrackedObject } from '../project/projectStore.ts'
import type { HandFrame, HandPoint } from './handTracking.ts'

// Boxes smaller than this (fraction of the image) are treated as a click, not a drag.
export const MIN_BOX_SIZE = 0.02

export function isPointInBox(point: HandPoint, box: Box): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  )
}

// True if any tracked point of any hand is inside the box.
// Any point counts (not just fingertips), because a tap can be made with
// the palm or a fist, and the camera sees the table at an angle.
export function isHandInBox(frame: HandFrame, box: Box): boolean {
  for (const hand of frame.hands) {
    for (const point of hand) {
      if (isPointInBox(point, box)) {
        return true
      }
    }
  }
  return false
}

// Builds a box from two drag corners, in any direction, clipped to the image.
export function makeBoxFromCorners(a: HandPoint, b: HandPoint): Box {
  const left = clamp01(Math.min(a.x, b.x))
  const right = clamp01(Math.max(a.x, b.x))
  const top = clamp01(Math.min(a.y, b.y))
  const bottom = clamp01(Math.max(a.y, b.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// The top-most (last drawn) object under a point, or null.
export function findObjectAtPoint(objects: TrackedObject[], point: HandPoint): TrackedObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (isPointInBox(point, objects[i].box)) {
      return objects[i]
    }
  }
  return null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
