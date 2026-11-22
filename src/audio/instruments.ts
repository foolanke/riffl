// The 6 melody instruments (SPEC 3.5), plus extras the team asked for
// (not in SPEC): a pitched 808 for hip-hop/trap, and a flute and low flute
// for Mask Off (Future). Also the white-key note helpers (SPEC 3.3).
// No Tone.js here, so project data can use these types too (like drums.ts).
// The sounds themselves are in melodySynths.ts.

export type InstrumentName = 'pluck' | 'pad' | 'synthLead' | 'piano' | 'bass' | 'chordPad' | 'bass808' | 'flute' | 'lowFlute'

export interface InstrumentInfo {
  name: InstrumentName
  label: string
}

export const INSTRUMENTS: InstrumentInfo[] = [
  { name: 'pluck', label: 'Pluck' },
  { name: 'pad', label: 'Pad' },
  { name: 'synthLead', label: 'Synth lead' },
  { name: 'piano', label: 'Piano' },
  { name: 'bass', label: 'Bass' },
  { name: 'chordPad', label: 'Chord pad' },
  { name: 'bass808', label: '808' },
  { name: 'flute', label: 'Flute' },
  { name: 'lowFlute', label: 'Low flute' },
]

export function getInstrumentLabel(name: InstrumentName): string {
  for (const instrument of INSTRUMENTS) {
    if (instrument.name === name) {
      return instrument.label
    }
  }
  return name
}

// White keys only (SPEC 3.3). A pitch is a letter plus octave, e.g. "G4".
// True for names like "C4" or "B6". Used to check loaded files.
export function isWhiteKeyPitch(value: unknown): value is string {
  return typeof value === 'string' && /^[A-G][0-9]$/.test(value)
}

const WHITE_KEY_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// The pitch `whiteKeySteps` white keys above `pitch` (negative = below).
// e.g. ("A4", 2) -> "C5", ("G4", -7) -> "G3".
export function moveByWhiteKeys(pitch: string, whiteKeySteps: number): string {
  const letterIndex = WHITE_KEY_LETTERS.indexOf(pitch[0])
  const octave = Number(pitch.slice(1))
  const total = octave * 7 + letterIndex + whiteKeySteps
  const newOctave = Math.floor(total / 7)
  const newLetter = WHITE_KEY_LETTERS[total - newOctave * 7]
  return newLetter + newOctave
}

// The notes an instrument actually plays for one gesture pitch (SPEC 3.5):
// - Bass and 808: the note 2 octaves below.
// - Chord pad: the white-key triad built on the note (root, 3rd, 5th),
//   e.g. C -> C E G, A -> A C E, B -> B D F. Voiced open (fuller, like
//   produced synth chords) instead of squashed into one octave:
//   root an octave down, root, 5th, and the 3rd an octave up.
//   Still only the triad's three notes (SPEC 3.5), just spread out.
// - Low flute: the note one octave below (alto-flute range).
// - Everything else: the note itself.
//
// Accidentals (designed page, wrist tilt): a sharp or flat pitch such as
// "F#4" is worked out on its natural ("F4") and then every note played is
// moved by the same semitone, so the chord pad's F chord becomes F# major.
export function getNotesToPlay(instrument: InstrumentName, pitch: string): string[] {
  const parts = splitPitch(pitch)
  const naturalNotes = getNaturalNotesToPlay(instrument, parts.natural)
  if (parts.accidental === 0) {
    return naturalNotes
  }
  const notes: string[] = []
  for (const note of naturalNotes) {
    notes.push(applyAccidental(note, parts.accidental))
  }
  return notes
}

function getNaturalNotesToPlay(instrument: InstrumentName, pitch: string): string[] {
  if (instrument === 'bass' || instrument === 'bass808') {
    return [moveByWhiteKeys(pitch, -14)]
  }
  if (instrument === 'chordPad') {
    return [moveByWhiteKeys(pitch, -7), pitch, moveByWhiteKeys(pitch, 4), moveByWhiteKeys(pitch, 9)]
  }
  if (instrument === 'lowFlute') {
    return [moveByWhiteKeys(pitch, -7)]
  }
  return [pitch]
}

// ---- Accidentals (designed page only; the human overrode SPEC 3.3's
// white keys only there) ----
// -1 = flat, 0 = natural, +1 = sharp.
export type Accidental = -1 | 0 | 1

// Any pitch name the app stores: a letter, an optional # or b, an octave.
// e.g. "G4", "F#4", "Bb4". Used to check loaded files.
export function isPitch(value: unknown): value is string {
  return typeof value === 'string' && /^[A-G][#b]?[0-9]$/.test(value)
}

// "F#4" -> natural "F4", accidental +1. "G4" -> "G4", 0.
export function splitPitch(pitch: string): { natural: string; accidental: Accidental } {
  if (pitch.length === 3 && pitch[1] === '#') {
    return { natural: pitch[0] + pitch[2], accidental: 1 }
  }
  if (pitch.length === 3 && pitch[1] === 'b') {
    return { natural: pitch[0] + pitch[2], accidental: -1 }
  }
  return { natural: pitch, accidental: 0 }
}

// A natural moved a semitone up (sharp) or down (flat), named like a real
// key: sharps as "F#4", flats as "Bb4". E and B have no sharp key and C and
// F no flat key, so those land on the next white key (E# -> F, Cb -> B).
export function applyAccidental(natural: string, accidental: Accidental): string {
  if (accidental === 0) {
    return natural
  }
  const letter = natural[0]
  if (accidental === 1 && (letter === 'E' || letter === 'B')) {
    return moveByWhiteKeys(natural, 1)
  }
  if (accidental === -1 && (letter === 'C' || letter === 'F')) {
    return moveByWhiteKeys(natural, -1)
  }
  return letter + (accidental === 1 ? '#' : 'b') + natural.slice(1)
}

const SEMITONES_FROM_C: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// The piano key a pitch sounds on, always named with sharps ("Bb4" -> "A#4"),
// so a flat and its sharp light the same key.
export function getKeyName(pitch: string): string {
  const parts = splitPitch(pitch)
  const octave = Number(parts.natural.slice(1))
  const semitone = octave * 12 + SEMITONES_FROM_C[parts.natural[0]] + parts.accidental
  return SHARP_NAMES[((semitone % 12) + 12) % 12] + Math.floor(semitone / 12)
}

// For on-screen text: "F#4" -> "F♯4", "Bb4" -> "B♭4" (a lowercase b would
// read as B once the UI uppercases it).
export function formatPitch(pitch: string): string {
  const parts = splitPitch(pitch)
  if (parts.accidental === 0) {
    return pitch
  }
  return parts.natural[0] + (parts.accidental === 1 ? '♯' : '♭') + parts.natural.slice(1)
}
