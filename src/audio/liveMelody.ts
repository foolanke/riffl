// Live melody notes (SPEC 3.4, 3.6, step 26): pinch = note on,
// release = note off, played the moment the camera sees it.
// Runs once per camera frame (not per screen redraw), so React never
// affects when a note sounds (SPEC 0.1).
//
// Instruments (step 27): the selected instrument decides the sound and
// which notes a pinch plays (bass 2 octaves down, chord pad a triad).
//
// Melody takes (step 29): the recorder tells this module when a take is
// running (setLiveMelodyTakeMode). During a melody take notes play live
// as usual (SPEC 3.6) and every note's pinch/release time is logged for
// the recorder. During a drum take live notes are silent.
// Only the recorder calls in here; this module never imports the recorder.
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

// ---- Take mode (step 29), set by the recorder ----
// 'drum': silent, so a stray pinch can't leak into the mic as a drum hit.
// 'melody': live as usual, even with the melody checkbox off, using the
// take's instrument (a retake uses the layer's instrument).
export type LiveTakeMode = 'none' | 'drum' | 'melody'
let takeMode: LiveTakeMode = 'none'
let takeInstrument: InstrumentName | null = null

// One note as played during a take. Times are camera times (ms,
// performance.now clock) of the frame where the pinch/release was seen.
// offMs is null if the note was still held when logging stopped.
export interface RecordedNote {
  pitch: string
  onMs: number
  offMs: number | null
}
let noteLog: RecordedNote[] | null = null // null = not logging
const openLogNote: Record<HandSide, RecordedNote | null> = { left: null, right: null }

// Call once, after loadMelodyInstruments().
export function initLiveMelody(): void {
  if (initialized) {
    return
  }
  initialized = true
  onHandFrame(handleHandFrame)
}

// ---- Instrument picker (SPEC 3.5) ----

// The picker's choice (and the instrument for the next new melody take).
export function getSelectedInstrument(): InstrumentName {
  return selectedInstrument
}

// What pinches play right now: the take's instrument during a take.
export function getPlayingInstrument(): InstrumentName {
  return takeInstrument !== null ? takeInstrument : selectedInstrument
}

// Held notes stop first, so nothing hangs on the old instrument.
// The pinch itself carries on: the next pinch uses the new instrument.
// Ignored during a take: the take's instrument is fixed.
export function selectInstrument(instrument: InstrumentName): void {
  if (takeMode !== 'none') {
    return
  }
  stopAllNotes()
  selectedInstrument = instrument
  notifyInstrumentListeners()
}

function notifyInstrumentListeners(): void {
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
  if (!on && takeMode !== 'melody') {
    stopAllNotes()
  }
}

function stopAllNotes(): void {
  for (const side of SIDES) {
    stopNote(side, performance.now())
    resetPinch(side)
  }
}

// ---- Takes (step 29) ----

// Called by the recorder when a take starts ('drum' / 'melody') and
// ends ('none'). instrument: the melody take's instrument.
export function setLiveMelodyTakeMode(mode: LiveTakeMode, instrument: InstrumentName | null): void {
  if (mode !== takeMode || instrument !== takeInstrument) {
    stopAllNotes() // a note held into or out of a take would hang
  }
  takeMode = mode
  takeInstrument = mode === 'melody' ? instrument : null
  notifyInstrumentListeners() // the playing instrument may have changed
}

export function getLiveTakeMode(): LiveTakeMode {
  return takeMode
}

// Starts logging notes for a melody take.
export function startNoteLog(): void {
  noteLog = []
  openLogNote.left = null
  openLogNote.right = null
}

// Stops logging and returns every note played. Notes still held are
// returned with offMs null (the recorder cuts them at the loop end).
export function stopNoteLog(): RecordedNote[] {
  const notes = noteLog !== null ? noteLog : []
  noteLog = null
  openLogNote.left = null
  openLogNote.right = null
  return notes
}

function logNoteOn(side: HandSide, pitch: string, timeMs: number): void {
  logNoteOff(side, timeMs)
  if (noteLog === null) {
    return
  }
  const note: RecordedNote = { pitch: pitch, onMs: timeMs, offMs: null }
  noteLog.push(note)
  openLogNote[side] = note
}

function logNoteOff(side: HandSide, timeMs: number): void {
  const note = openLogNote[side]
  if (note !== null) {
    note.offMs = timeMs
    openLogNote[side] = null
  }
}

// ---- Pinch capture for the camera lag check (step 28) ----

export function startPinchCapture(listener: (frameTimeMs: number) => void): void {
  stopAllNotes()
  for (const side of SIDES) {
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
  // A melody take plays even if the checkbox is off: that's the point of it.
  const silent = takeMode === 'drum' || (!melodyOn && takeMode !== 'melody')
  if (silent) {
    stopAllNotes()
    return
  }

  const guideHands = getGuideHands(frame)
  for (const side of SIDES) {
    const hand = findHand(guideHands, side)
    if (hand === null) {
      lastDistances[side] = null
      if (frame.time - lastSeenTime[side] > MISSING_HAND_GRACE_MS) {
        // The note ended when the hand was last seen, not now.
        stopNote(side, lastSeenTime[side])
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
      stopNote(side, frame.time)
    } else if (current === null || current.finger !== finger) {
      startNote(side, finger, getPitch(hand, finger), frame.time)
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

// Sound: Tone.immediate() is "right now". Tone.now() would add Tone's
// ~0.1s scheduling look-ahead, which is a lag you'd hear on every pinch.
// timeMs: camera time of the frame, for the take's note log.
function startNote(side: HandSide, finger: FingerName, pitch: string, timeMs: number): void {
  const instrument = getPlayingInstrument()
  const current = held[side]
  if (current !== null && current.instrument !== instrument) {
    stopNote(side, timeMs)
  }
  const voice = getMelodyVoice(instrument, side)
  if (!voice) {
    return
  }
  // Same voice, new pitch: the voice releases the old notes itself.
  voice.noteOn(getNotesToPlay(instrument, pitch), Tone.immediate())
  held[side] = { finger: finger, pitch: pitch, instrument: instrument }
  logNoteOn(side, pitch, timeMs)
}

function stopNote(side: HandSide, timeMs: number): void {
  const current = held[side]
  if (current === null) {
    return
  }
  const voice = getMelodyVoice(current.instrument, side)
  if (voice) {
    voice.noteOff(Tone.immediate())
  }
  held[side] = null
  logNoteOff(side, timeMs)
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
