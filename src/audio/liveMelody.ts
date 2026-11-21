// Live melody notes (SPEC 3.4, 3.6, step 26): pinch = note on,
// release = note off, played the moment the camera sees it.
// Runs once per camera frame (not per screen redraw), so React never
// affects when a note sounds (SPEC 0.1).
//
// Instruments (step 27): the selected instrument decides the sound and
// which notes a pinch plays (bass 2 octaves down, chord pad a triad).
//
// Not recorded yet: melody takes arrive in step 29.
import * as Tone from 'tone'
import { onHandFrame } from '../vision/handTracking.ts'
import type { HandFrame, HandSide } from '../vision/handTracking.ts'
import { getGuideHands } from '../vision/melodyGuide.ts'
import type { FingerName, GuideHand } from '../vision/melodyGuide.ts'
import { getPinchDistances, resetPinch, updatePinch } from '../vision/pinch.ts'
import type { PinchDistances } from '../vision/pinch.ts'
import { getNotesToPlay } from './instruments.ts'
import type { InstrumentName } from './instruments.ts'
import { getMelodyVoice } from './melodySynths.ts'
import { getRecorderState } from './recorder.ts'

// Tracking sometimes loses a hand for a frame or two. A held note only
// stops after the hand has been missing this long, so it doesn't stutter.
const MISSING_HAND_GRACE_MS = 150

const SIDES: HandSide[] = ['left', 'right']

// The note each hand is holding: which finger, and the pitch it started
// on. The pitch stays fixed while held, even if the hand drifts into
// another column, so a held note never jumps. The instrument is kept so
// note off goes to the voice that started it.
export interface HeldNote {
  finger: FingerName
  pitch: string
  instrument: InstrumentName
}

let initialized = false
let melodyOn = true
// Pluck by default: the first sound of I Gotta Feeling (SPEC 3.5).
let selectedInstrument: InstrumentName = 'pluck'
const instrumentListeners = new Set<() => void>()
const held: Record<HandSide, HeldNote | null> = { left: null, right: null }
const lastSeenTime: Record<HandSide, number> = { left: 0, right: 0 }
const lastDistances: Record<HandSide, PinchDistances | null> = { left: null, right: null }

// Camera lag check (step 28): while set, live notes are silent and every
// new pinch reports the camera time (ms, performance.now clock) of the
// frame it was first seen in.
let pinchStartListener: ((frameTimeMs: number) => void) | null = null
const capturedFinger: Record<HandSide, FingerName | null> = { left: null, right: null }

// Call once, after loadMelodyInstruments().
export function initLiveMelody(): void {
  if (initialized) {
    return
  }
  initialized = true
  onHandFrame(handleHandFrame)
}

// ---- Instrument picker (SPEC 3.5) ----

export function getSelectedInstrument(): InstrumentName {
  return selectedInstrument
}

// Held notes stop first, so nothing hangs on the old instrument.
// The pinch itself carries on: the next pinch uses the new instrument.
export function selectInstrument(instrument: InstrumentName): void {
  for (const side of SIDES) {
    stopNote(side)
    resetPinch(side)
  }
  selectedInstrument = instrument
  for (const listener of instrumentListeners) {
    listener()
  }
}

export function subscribeToInstrument(listener: () => void): () => void {
  instrumentListeners.add(listener)
  return function unsubscribe() {
    instrumentListeners.delete(listener)
  }
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

// ---- Pinch capture for the camera lag check (step 28) ----

export function startPinchCapture(listener: (frameTimeMs: number) => void): void {
  for (const side of SIDES) {
    stopNote(side)
    resetPinch(side)
    capturedFinger[side] = null
  }
  pinchStartListener = listener
}

export function stopPinchCapture(): void {
  pinchStartListener = null
  for (const side of SIDES) {
    resetPinch(side)
    capturedFinger[side] = null
  }
}

// Same pinch detection as live play (so the measured lag matches what
// melody takes will see), but silent: you only hear the clicks.
// Works even with the melody checkbox off.
function handleCaptureFrame(frame: HandFrame, listener: (frameTimeMs: number) => void): void {
  const guideHands = getGuideHands(frame)
  for (const side of SIDES) {
    const hand = findHand(guideHands, side)
    if (hand === null) {
      lastDistances[side] = null
      resetPinch(side)
      capturedFinger[side] = null
      continue
    }
    const distances = getPinchDistances(hand.points, frame.aspect)
    lastDistances[side] = distances
    const finger = updatePinch(side, distances)
    // Only a pinch from open counts, not sliding to another finger.
    if (finger !== null && capturedFinger[side] === null) {
      listener(frame.time)
    }
    capturedFinger[side] = finger
  }
}

function handleHandFrame(frame: HandFrame): void {
  if (pinchStartListener !== null) {
    handleCaptureFrame(frame, pinchStartListener)
    return
  }

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
  const current = held[side]
  if (current !== null && current.instrument !== selectedInstrument) {
    stopNote(side)
  }
  const voice = getMelodyVoice(selectedInstrument, side)
  if (!voice) {
    return
  }
  // Same voice, new pitch: the voice releases the old notes itself.
  voice.noteOn(getNotesToPlay(selectedInstrument, pitch), Tone.immediate())
  held[side] = { finger: finger, pitch: pitch, instrument: selectedInstrument }
}

function stopNote(side: HandSide): void {
  const current = held[side]
  if (current === null) {
    return
  }
  const voice = getMelodyVoice(current.instrument, side)
  if (voice) {
    voice.noteOff(Tone.immediate())
  }
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
