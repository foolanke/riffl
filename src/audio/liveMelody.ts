// Live melody notes (SPEC 3.4, 3.6, step 26): pinch = note on,
// release = note off, played the moment the camera sees it.
// Runs once per camera frame (not per screen redraw), so React never
// affects when a note sounds (SPEC 0.1).
//
// Not recorded yet: melody takes arrive in step 29.
import * as Tone from 'tone'
import { onHandFrame } from '../vision/handTracking.ts'
import type { HandFrame, HandSide } from '../vision/handTracking.ts'
import { getGuideHands } from '../vision/melodyGuide.ts'
import type { FingerName, GuideHand } from '../vision/melodyGuide.ts'
import { getPinchDistances, resetPinch, updatePinch } from '../vision/pinch.ts'
import type { PinchDistances } from '../vision/pinch.ts'
import { createSynthLeadVoice } from './melodySynths.ts'
import type { MelodyVoice } from './melodySynths.ts'
import { getRecorderState } from './recorder.ts'

// Tracking sometimes loses a hand for a frame or two. A held note only
// stops after the hand has been missing this long, so it doesn't stutter.
const MISSING_HAND_GRACE_MS = 150

const SIDES: HandSide[] = ['left', 'right']

// The note each hand is holding: which finger, and the pitch it started
// on. The pitch stays fixed while held, even if the hand drifts into
// another column, so a held note never jumps.
export interface HeldNote {
  finger: FingerName
  pitch: string
}

let initialized = false
let melodyOn = true
let voices: Record<HandSide, MelodyVoice> | null = null
const held: Record<HandSide, HeldNote | null> = { left: null, right: null }
const lastSeenTime: Record<HandSide, number> = { left: 0, right: 0 }
const lastDistances: Record<HandSide, PinchDistances | null> = { left: null, right: null }

// Call once, after startAudio().
export function initLiveMelody(): void {
  if (initialized) {
    return
  }
  initialized = true
  voices = { left: createSynthLeadVoice(), right: createSynthLeadVoice() }
  onHandFrame(handleHandFrame)
}

// The "melody" checkbox: off = no live notes (and any held note stops).
export function setLiveMelodyOn(on: boolean): void {
  melodyOn = on
  if (!on) {
    for (const side of SIDES) {
      stopNote(side)
      resetPinch(side)
    }
  }
}

function handleHandFrame(frame: HandFrame): void {
  // During a drum take, hands are tapping objects; a stray pinch would
  // play a note that leaks into the mic and records as a drum hit.
  // Melody takes (step 29) will let notes play during their own take.
  const drumTakeRunning = getRecorderState().status !== 'idle'
  if (!melodyOn || drumTakeRunning) {
    for (const side of SIDES) {
      stopNote(side)
      resetPinch(side)
    }
    return
  }

  const guideHands = getGuideHands(frame)
  for (const side of SIDES) {
    const hand = findHand(guideHands, side)
    if (hand === null) {
      lastDistances[side] = null
      if (frame.time - lastSeenTime[side] > MISSING_HAND_GRACE_MS) {
        stopNote(side)
        resetPinch(side)
      }
      continue
    }
    lastSeenTime[side] = frame.time

    const distances = getPinchDistances(hand.points, frame.aspect)
    lastDistances[side] = distances
    const finger = updatePinch(side, distances)
    const current = held[side]

    if (finger === null) {
      stopNote(side)
    } else if (current === null || current.finger !== finger) {
      startNote(side, finger, getPitch(hand, finger))
    }
  }
}

function findHand(guideHands: GuideHand[], side: HandSide): GuideHand | null {
  for (const hand of guideHands) {
    if (hand.side === side) {
      return hand
    }
  }
  return null
}

function getPitch(hand: GuideHand, finger: FingerName): string {
  for (const guideFinger of hand.fingers) {
    if (guideFinger.finger === finger) {
      return guideFinger.pitch
    }
  }
  return 'C4' // unreachable: every hand has all four fingers
}

// Tone.immediate() is "right now". Tone.now() would add Tone's ~0.1s
// scheduling look-ahead, which is a lag you'd hear on every pinch.
function startNote(side: HandSide, finger: FingerName, pitch: string): void {
  if (!voices) {
    return
  }
  // Same voice, new pitch: the attack simply moves to the new note.
  voices[side].noteOn(pitch, Tone.immediate())
  held[side] = { finger: finger, pitch: pitch }
}

function stopNote(side: HandSide): void {
  if (!voices || held[side] === null) {
    return
  }
  voices[side].noteOff(Tone.immediate())
  held[side] = null
}

// ---- For the screen ----

// The pitch each hand is holding right now, or null.
export function getHeldNote(side: HandSide): HeldNote | null {
  return held[side]
}

// Latest pinch distances per hand, for the tuning readout.
export function getLastPinchDistances(side: HandSide): PinchDistances | null {
  return lastDistances[side]
}
