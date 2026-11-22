// More robust pinch detection for the designed page. Additive: the test
// page keeps pinch.ts.
//
// One note per hand by default (SPEC 3.4). Several fingers per hand at once
// is a checkbox in settings ("Multi-finger notes", the human asked for it
// as an option, saved per browser). Both modes run the exact same tuned
// detection below, so they feel the same (the human asked for single mode
// to use multi mode's settings). Single mode only picks which one of the
// pinched fingers sounds: the one that struck last (pickNewestStrike).
// liveMelody switches to this one when the designed page calls
// setAccuratePinch(true).
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
//
// What it does, and why (tuned from /?pinchdebug readings on the demo laptop):
// 1. The flat camera picture decides. MediaPipe's depth is its weakest
//    output (learned only from synthetic images) and breaks exactly when a
//    fingertip is hidden behind the thumb. Measured: real touches read
//    0.46 and 0.76 in 3D but 0.11 flat; false notes read 0.37-0.38 in 3D
//    but 0.38-0.46 flat. So a touch is judged on the flat distance, and the
//    3D distance only vetoes a finger that is very far away in depth.
//    Second way in: a touch that reads 0.25 in both is real too, so when
//    3D and flat both say "fairly close" (AGREE_DISTANCE) it also counts.
// 2. Hand size that survives tilting. Flat distances are divided by the
//    hand's size in the picture. Wrist-to-knuckle shrinks when the hand
//    points at the camera, so we also use the knuckle width and take the
//    larger, which keeps the numbers steady as the hand turns.
// 3. Contact with the thumb PAD, not just the thumb tip. When two fingers
//    pinch at once they can't both touch the thumb's tip point: one lands
//    on the tip, the other next to it on the pad. So each finger's distance
//    is to the closest point on the thumb's last segment near the tip.
// 4. Thumb lying across a finger is ignored: if the spot where the thumb
//    is clearly nearer the finger's middle joint than its tip, it is an
//    overlap, not a pinch. Skipped when the finger points at the camera:
//    then its tip and middle joint overlap in the picture and the check
//    blocked real pinches (a 0.24/0.17 touch was missed this way).
// 5. Relative test for extra fingers. A curled neighbour finger can rest
//    close to the thumb without touching. A finger that really touches is
//    about as close as the closest finger, so an extra finger only counts
//    when its distance is near the closest finger's.
// 6. No added delay on press: a pinch plays on the first frame it is seen.
// 7. Release relative to the touch. The index rests close to the thumb
//    even when relaxed, so a fixed release distance left it stuck on. A
//    held finger lets go once it is RELEASE_MARGIN further away than its
//    closest point in this pinch (or past RELEASE_DISTANCE), seen on 2
//    frames in a row so one bad frame can't cut a held note.
// 8. Fast repeats with one finger. A quick re-tap barely opens the
//    fingers, often for a single camera frame, so it never looks fully
//    released. While held, a small open (REPEAT_OPEN) followed by closing
//    again (REPEAT_CLOSE) counts as a new strike: the finger is reported
//    in `retriggered` and the note restarts on that frame.
import type { HandPoint, HandSide } from './handTracking.ts'
import type { FingerName } from './melodyGuide.ts'
import type { PinchDistances } from './pinch.ts'

// ---- Tuned values (from /?pinchdebug on the demo laptop, multi-finger
// mode). Both modes use them unchanged. ----

// Flat distances, in hand sizes in the picture. Readings (3D / flat):
// touches 0.20/0.11, 0.46/0.11, 0.76/0.11, 0.25/0.25; false notes
// 0.37/0.46, 0.38/0.38.
// Tightened from 0.2 / 0.3 (fingers curling near the thumb without touching
// played notes). Real touches read about 0.11 flat, so 0.15 still catches them.
const PRESS_DISTANCE = 0.15 // flat: counts as touching below this
const AGREE_DISTANCE = 0.26 // ...or when 3D and flat are both below this
const RELEASE_MARGIN = 0.15 // let go this far past the pinch's closest point
const RELEASE_DISTANCE = 0.4 // always let go past this
// 3D veto (in real hand sizes): further than this is clearly not touching.
// A real touch was measured at 0.76, so this stays well above that.
const DEPTH_VETO_DISTANCE = 0.95

// Thumb-across check: the middle joint must be this much closer than the
// tip, and the finger must look at least this long in the picture (hand
// sizes, tip to middle joint), or the check is skipped.
const ACROSS_RATIO = 0.7
const MIN_FLAT_FINGER_LENGTH = 0.3

// Extra fingers (not the closest one) must also be about as close as the
// closest finger: within closest * ratio + offset.
const EXTRA_PRESS_RATIO = 1.6
const EXTRA_PRESS_OFFSET = 0.08
// A held finger stays held while within this (looser) range of the closest.
// When the thumb slides on to the next finger in a fast run, the old one
// falls out of range and releases, so runs stay legato instead of blurring.
const HOLD_RATIO = 2.0
const HOLD_OFFSET = 0.12

const RELEASE_FRAMES = 2

// Re-strike while held: open at least this far past the closest point,
// then come back at least this far from the widest point (flat distances).
// Both sit above tracking jitter so a steady hold never re-strikes.
const REPEAT_OPEN = 0.07
const REPEAT_CLOSE = 0.05

const WRIST = 0
const INDEX_BASE = 5
const MIDDLE_FINGER_BASE = 9
const PINKY_BASE = 17
const THUMB_IP = 3
const THUMB_TIP = 4
// The thumb pad: from the tip this far toward the thumb's last joint.
const THUMB_PAD_REACH = 0.5
// Knuckle width (index base to pinky base) is about 0.8 of wrist-to-knuckle.
const KNUCKLE_WIDTH_TO_HAND_SIZE = 1.25

// Per finger: its tip and its middle joint (PIP).
const FINGERS: { finger: FingerName; tip: number; pip: number }[] = [
  { finger: 'index', tip: 8, pip: 6 },
  { finger: 'middle', tip: 12, pip: 10 },
  { finger: 'ring', tip: 16, pip: 14 },
  { finger: 'pinky', tip: 20, pip: 18 },
]

interface FingerState {
  held: boolean
  releaseFrames: number // frames in a row this finger looked released (while held)
  closestWhileHeld: number // smallest flat distance during this pinch (since the last strike)
  widestSinceClosest: number // largest flat distance since that smallest one
}

type HandState = Record<FingerName, FingerState>

function newFingerState(): FingerState {
  return { held: false, releaseFrames: 0, closestWhileHeld: Infinity, widestSinceClosest: 0 }
}

function newHandState(): HandState {
  return { index: newFingerState(), middle: newFingerState(), ring: newFingerState(), pinky: newFingerState() }
}

const hands: Record<HandSide, HandState> = { left: newHandState(), right: newHandState() }

// ---- Mode: one note per hand (default) or several ----

const MULTI_FINGER_STORAGE_KEY = 'sounds.multiFingerPinch'
let multiFinger = loadMultiFinger()
// Single mode: the finger holding each hand's note.
const singleFinger: Record<HandSide, FingerName | null> = { left: null, right: null }
const modeListeners = new Set<() => void>()

export function getMultiFingerPinch(): boolean {
  return multiFinger
}

// Callers stop held notes first (liveMelody.setMultiFingerNotes does).
export function setMultiFingerPinch(on: boolean): void {
  multiFinger = on
  resetAccuratePinch('left')
  resetAccuratePinch('right')
  try {
    window.localStorage.setItem(MULTI_FINGER_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Storage unavailable: the choice just lasts until reload.
  }
  for (const listener of modeListeners) {
    listener()
  }
}

export function subscribeToMultiFingerPinch(listener: () => void): () => void {
  modeListeners.add(listener)
  return function unsubscribe() {
    modeListeners.delete(listener)
  }
}

function loadMultiFinger(): boolean {
  try {
    return window.localStorage.getItem(MULTI_FINGER_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export interface AccuratePinchResult {
  fingers: FingerName[] // every finger pinched now, index first
  retriggered: FingerName[] // held fingers that struck again this frame (restart their note)
  distances: PinchDistances // 3D, in hand sizes (readout and depth veto)
  flatDistances: PinchDistances // in the flat camera picture: what decides
  // Why a finger that is close did NOT play, for the /?pinchdebug readout:
  // 'across' thumb lying across it, 'depth' far apart in 3D,
  // 'extra' another finger is much closer. '' = not blocked.
  blocked: Record<FingerName, BlockReason>
}

export type BlockReason = '' | 'across' | 'depth' | 'extra'

// One frame for one hand. worldPoints give the 3D distance when the
// tracker has them; otherwise the image points' rough depth is used.
export function updateAccuratePinch(
  side: HandSide,
  points: HandPoint[],
  worldPoints: HandPoint[] | undefined,
  aspect: number,
  _timeMs: number,
): AccuratePinchResult {
  const state = hands[side]

  // 3D, only for the depth veto and the readout.
  const useWorld = worldPoints !== undefined && worldPoints.length === 21
  const source = scalePoints(useWorld ? worldPoints : points, useWorld ? 1 : 1 / aspect)
  const handSize = Math.max(0.0001, getDistance(source[WRIST], source[MIDDLE_FINGER_BASE]))
  const padStart = source[THUMB_TIP]
  const padEnd = lerpPoint(source[THUMB_TIP], source[THUMB_IP], THUMB_PAD_REACH)

  // The flat picture: image x and y only (y in width units).
  const flat = flattenPoints(points, 1 / aspect)
  const flatHandSize = Math.max(
    0.0001,
    getDistance(flat[WRIST], flat[MIDDLE_FINGER_BASE]),
    getDistance(flat[INDEX_BASE], flat[PINKY_BASE]) * KNUCKLE_WIDTH_TO_HAND_SIZE,
  )
  const flatPadStart = flat[THUMB_TIP]
  const flatPadEnd = lerpPoint(flat[THUMB_TIP], flat[THUMB_IP], THUMB_PAD_REACH)

  const distances: PinchDistances = { index: 0, middle: 0, ring: 0, pinky: 0 }
  const flatDistances: PinchDistances = { index: 0, middle: 0, ring: 0, pinky: 0 }
  const touching: Record<FingerName, boolean> = { index: false, middle: false, ring: false, pinky: false }
  const blocked: Record<FingerName, BlockReason> = { index: '', middle: '', ring: '', pinky: '' }
  for (const finger of FINGERS) {
    const name = finger.finger
    const contact = closestPointOnSegment(source[finger.tip], padStart, padEnd)
    distances[name] = getDistance(contact, source[finger.tip]) / handSize

    const flatTip = flat[finger.tip]
    const flatContact = closestPointOnSegment(flatTip, flatPadStart, flatPadEnd)
    const toTip = getDistance(flatContact, flatTip)
    flatDistances[name] = toTip / flatHandSize
    const flatFingerLength = getDistance(flatTip, flat[finger.pip]) / flatHandSize
    const lyingAcross =
      flatFingerLength >= MIN_FLAT_FINGER_LENGTH && getDistance(flatContact, flat[finger.pip]) < toTip * ACROSS_RATIO

    const flatTouch = flatDistances[name] < PRESS_DISTANCE && distances[name] < DEPTH_VETO_DISTANCE
    const bothClose = flatDistances[name] < AGREE_DISTANCE && distances[name] < AGREE_DISTANCE
    touching[name] = (flatTouch || bothClose) && !lyingAcross
    if ((flatTouch || bothClose) && lyingAcross) {
      blocked[name] = 'across'
    } else if (flatDistances[name] < PRESS_DISTANCE && !flatTouch && !bothClose) {
      blocked[name] = 'depth'
    }
  }

  // The closest finger that is touching or still held. Its distance is
  // "what touching looks like" right now, for the relative tests.
  let closest: FingerName | null = null
  for (const finger of FINGERS) {
    const name = finger.finger
    const stillHeld = state[name].held && !looksReleased(state[name], flatDistances[name])
    if ((touching[name] || stillHeld) && (closest === null || flatDistances[name] < flatDistances[closest])) {
      closest = name
    }
  }
  const closestDistance = closest !== null ? flatDistances[closest] : Infinity

  const pinched: FingerName[] = []
  const retriggered: FingerName[] = []
  const pressed: FingerName[] = [] // started touching this frame
  for (const finger of FINGERS) {
    const name = finger.finger
    const fingerState = state[name]
    const distance = flatDistances[name]
    const isClosest = name === closest

    if (fingerState.held) {
      // Fast re-tap: opened a little, now closing again on a touch.
      const opened = fingerState.widestSinceClosest - fingerState.closestWhileHeld >= REPEAT_OPEN
      const closingAgain = distance <= fingerState.widestSinceClosest - REPEAT_CLOSE
      if (opened && closingAgain && touching[name]) {
        retriggered.push(name)
        fingerState.closestWhileHeld = distance
        fingerState.widestSinceClosest = distance
      } else if (distance < fingerState.closestWhileHeld) {
        fingerState.closestWhileHeld = distance
        fingerState.widestSinceClosest = distance
      } else {
        fingerState.widestSinceClosest = Math.max(fingerState.widestSinceClosest, distance)
      }
      const inRange = isClosest || distance <= closestDistance * HOLD_RATIO + HOLD_OFFSET
      if (!looksReleased(fingerState, distance) && inRange) {
        fingerState.releaseFrames = 0
      } else {
        fingerState.releaseFrames++
        if (fingerState.releaseFrames >= RELEASE_FRAMES) {
          fingerState.held = false
          fingerState.releaseFrames = 0
        }
      }
    } else {
      const wantsPress =
        touching[name] && (isClosest || distance <= closestDistance * EXTRA_PRESS_RATIO + EXTRA_PRESS_OFFSET)
      if (touching[name] && !wantsPress) {
        blocked[name] = 'extra'
      }
      if (wantsPress) {
        fingerState.held = true // at once: no added latency
        pressed.push(name)
        fingerState.releaseFrames = 0
        fingerState.closestWhileHeld = distance
        fingerState.widestSinceClosest = distance
      }
    }
    if (fingerState.held) {
      pinched.push(name)
    }
  }
  // A re-strike only counts if the finger is still held after this frame.
  let stillHeldRetriggers: FingerName[] = []
  for (const name of retriggered) {
    if (pinched.includes(name)) {
      stillHeldRetriggers.push(name)
    }
  }

  let fingers = pinched
  if (!multiFinger) {
    const previous = singleFinger[side]
    const chosen = pickNewestStrike(side, pinched, pressed, stillHeldRetriggers, flatDistances)
    fingers = chosen !== null ? [chosen] : []
    // The same finger striking again restarts its note.
    const struckAgain = chosen !== null && chosen === previous && stillHeldRetriggers.includes(chosen)
    stillHeldRetriggers = struckAgain ? [chosen] : []
  }
  return {
    fingers: fingers,
    retriggered: stillHeldRetriggers,
    distances: distances,
    flatDistances: flatDistances,
    blocked: blocked,
  }
}

// Single mode: which one of this frame's pinched fingers sounds. The
// detection is exactly multi mode's; this only turns its several notes
// into one, like a mono synth: the newest strike (a fresh press or a
// re-tap) takes the note, and the closest one wins if two strike on the
// same frame. While a note plays, a new finger only takes over if it is
// closer to the thumb than the playing one (the thumb moving on in a run);
// a neighbour curling in behind it is ignored. When the sounding finger lets go the hand goes quiet, even
// if another finger is still held, so a neighbour resting against the
// thumb never pops out as a note on its own.
function pickNewestStrike(
  side: HandSide,
  pinched: FingerName[],
  pressed: FingerName[],
  retriggered: FingerName[],
  flatDistances: PinchDistances,
): FingerName | null {
  const current = singleFinger[side]
  const currentHeld = current !== null && pinched.includes(current)
  let chosen: FingerName | null = null
  for (const name of pinched) {
    const struck = pressed.includes(name) || retriggered.includes(name)
    const takesOver = !currentHeld || name === current || flatDistances[name] < flatDistances[current]
    if (struck && takesOver && (chosen === null || flatDistances[name] < flatDistances[chosen])) {
      chosen = name
    }
  }
  if (chosen === null && currentHeld) {
    chosen = current
  }
  singleFinger[side] = chosen
  return chosen
}

// A held finger looks open: clearly further than its closest point in
// this pinch, or past the absolute limit (flat distances).
function looksReleased(state: FingerState, distance: number): boolean {
  return distance > state.closestWhileHeld + RELEASE_MARGIN || distance > RELEASE_DISTANCE
}

// The hand is gone: forget its pinches.
export function resetAccuratePinch(side: HandSide): void {
  hands[side] = newHandState()
  singleFinger[side] = null
}

// Image points have y as a fraction of the height; scale it to width
// units so distances are even in every direction. World points are all
// in meters already (scaleY 1).
function scalePoints(points: HandPoint[], scaleY: number): HandPoint[] {
  const scaled: HandPoint[] = []
  for (const point of points) {
    scaled.push({ x: point.x, y: point.y * scaleY, z: point.z ?? 0 })
  }
  return scaled
}

// Image points with depth dropped, y scaled to width units.
function flattenPoints(points: HandPoint[], scaleY: number): HandPoint[] {
  const flat: HandPoint[] = []
  for (const point of points) {
    flat.push({ x: point.x, y: point.y * scaleY, z: 0 })
  }
  return flat
}

function lerpPoint(a: HandPoint, b: HandPoint, amount: number): HandPoint {
  const az = a.z ?? 0
  const bz = b.z ?? 0
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount, z: az + (bz - az) * amount }
}

// The point on segment a-b closest to p.
function closestPointOnSegment(p: HandPoint, a: HandPoint, b: HandPoint): HandPoint {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = (b.z ?? 0) - (a.z ?? 0)
  const lengthSquared = abx * abx + aby * aby + abz * abz
  if (lengthSquared === 0) {
    return a
  }
  const apx = p.x - a.x
  const apy = p.y - a.y
  const apz = (p.z ?? 0) - (a.z ?? 0)
  const amount = Math.min(1, Math.max(0, (apx * abx + apy * aby + apz * abz) / lengthSquared))
  return lerpPoint(a, b, amount)
}

function getDistance(a: HandPoint, b: HandPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
