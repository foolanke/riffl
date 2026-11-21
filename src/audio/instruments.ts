// The 6 melody instruments (SPEC 3.5), plus a pitched 808 for hip-hop/trap
// (an extra the team asked for), and the white-key note helpers (SPEC 3.3).
// No Tone.js here, so project data can use these types too (like drums.ts).
// The sounds themselves are in melodySynths.ts.

export type InstrumentName = 'pluck' | 'pad' | 'synthLead' | 'piano' | 'bass' | 'chordPad' | 'bass808'

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
//   e.g. C -> C E G, A -> A C E, B -> B D F.
// - Everything else: the note itself.
export function getNotesToPlay(instrument: InstrumentName, pitch: string): string[] {
  if (instrument === 'bass' || instrument === 'bass808') {
    return [moveByWhiteKeys(pitch, -14)]
  }
  if (instrument === 'chordPad') {
    return [pitch, moveByWhiteKeys(pitch, 2), moveByWhiteKeys(pitch, 4)]
  }
  return [pitch]
}
