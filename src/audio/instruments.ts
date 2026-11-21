// The 6 melody instruments (SPEC 3.5) and the white-key note layout (SPEC 3.3).
// No Tone.js here, so project data can use these types too (like drums.ts).
// The actual sounds are built in step 27; step 26 adds the synth lead.

export type InstrumentName = 'pluck' | 'pad' | 'synthLead' | 'piano' | 'bass' | 'chordPad'

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
export const WHITE_KEY_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// True for names like "C4" or "B6". Used to check loaded files.
export function isWhiteKeyPitch(value: unknown): value is string {
  return typeof value === 'string' && /^[A-G][0-9]$/.test(value)
}
