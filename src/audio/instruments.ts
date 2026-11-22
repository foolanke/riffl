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
  if (instrument === 'chordPad' && chordKey !== null) {
    // Same open voicing, on the key's triad (see getTriad).
    const triad = getTriad(pitch)
    const useFlats = chordKey.useFlats
    return [
      semitoneToPitch(triad[0] - 12, useFlats),
      semitoneToPitch(triad[0], useFlats),
      semitoneToPitch(triad[2], useFlats),
      semitoneToPitch(triad[1] + 12, useFlats),
    ]
  }
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

// A note moved a semitone up (sharp) or down (flat), named like a real
// key: sharps as "F#4", flats as "Bb4". E and B have no sharp key and C and
// F no flat key, so those land on the next white key (E# -> F, Cb -> B).
// The note can already be a sharp or flat (a key's F#4 tilted up is G4).
export function applyAccidental(natural: string, accidental: Accidental): string {
  if (accidental === 0) {
    return natural
  }
  return semitoneToPitch(pitchToSemitone(natural) + accidental, accidental === -1)
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

// Semitones above C0: "C4" -> 48, "F#4" -> 54, "Bb4" -> 58.
export function pitchToSemitone(pitch: string): number {
  const parts = splitPitch(pitch)
  return Number(parts.natural.slice(1)) * 12 + SEMITONES_FROM_C[parts.natural[0]] + parts.accidental
}

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// The pitch name for a semitone, with sharps ("F#4") or flats ("Gb4").
// Never a double sharp or E#/B#-style name, so it always passes isPitch.
export function semitoneToPitch(semitone: number, useFlats: boolean): string {
  const names = useFlats ? FLAT_NAMES : SHARP_NAMES
  return names[((semitone % 12) + 12) % 12] + Math.floor(semitone / 12)
}

// ---- The project key (designed page; SPEC 3.3 keeps white keys only on
// the test page, the human asked for the key to set the notes here) ----

export interface KeyScale {
  root: number // semitone of the root within an octave, C = 0
  steps: number[] // the 7 scale notes, in semitones above the root
  useFlats: boolean // name notes with flats (F major, Bb major, D minor...)
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] // natural minor

// "G major" -> root 7, major steps, sharps. null if the name isn't a key.
export function parseKey(key: string): KeyScale | null {
  const words = key.split(' ')
  if (words.length !== 2 || (words[1] !== 'major' && words[1] !== 'minor')) {
    return null
  }
  const rootName = words[0]
  let root = SHARP_NAMES.indexOf(rootName)
  if (root === -1) {
    root = FLAT_NAMES.indexOf(rootName)
  }
  if (root === -1) {
    return null
  }
  const isMajor = words[1] === 'major'
  // Flat keys: a flat root, F major, and the minors that share a flat
  // key's notes (D, G, C, F minor = F, Bb, Eb, Ab major).
  const flatMinors = ['D', 'G', 'C', 'F']
  const useFlats = rootName.includes('b') || (isMajor && rootName === 'F') || (!isMajor && flatMinors.includes(rootName))
  return { root: root, steps: isMajor ? MAJOR_STEPS : MINOR_STEPS, useFlats: useFlats }
}

// The chord pad's key. null (the test page, which never sets it) keeps
// SPEC 3.5's white-key triads.
let chordKey: KeyScale | null = null

export function setChordKey(key: string | null): void {
  chordKey = key === null ? null : parseKey(key)
}

// The chord pad triad for a note (root, 3rd, 5th as semitones). With a key:
// a note in the key gets the key's own triad (G major: B -> B D F#); a note
// outside it (tilted sharp or flat) gets a major triad, which is what
// borrowed chords like F in G major usually are. Without a key: the
// white-key triad (SPEC 3.5), moved by the note's accidental.
export function getTriad(pitch: string): number[] {
  const semitone = pitchToSemitone(pitch)
  if (chordKey !== null) {
    const fromRoot = (((semitone - chordKey.root) % 12) + 12) % 12
    const degree = chordKey.steps.indexOf(fromRoot)
    if (degree === -1) {
      return [semitone, semitone + 4, semitone + 7]
    }
    const triad: number[] = []
    for (const offset of [0, 2, 4]) {
      const step = chordKey.steps[(degree + offset) % 7] + (degree + offset >= 7 ? 12 : 0)
      triad.push(semitone + step - fromRoot)
    }
    return triad
  }
  const parts = splitPitch(pitch)
  const triad: number[] = []
  for (const whiteKeys of [0, 2, 4]) {
    triad.push(pitchToSemitone(moveByWhiteKeys(parts.natural, whiteKeys)) + parts.accidental)
  }
  return triad
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
