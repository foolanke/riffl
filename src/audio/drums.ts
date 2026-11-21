// The 8 drum sounds (SPEC 1.7) and their sample files in public/samples/,
// plus two extras for hip-hop/trap beats, added at the team's request:
// - 808: a deep, long TR-808 kick with heavy reverb (see samples.ts).
// - Hi-hat roll: each hit plays two closed hats a 32nd apart, so tapping
//   a run of 16ths gives a trap-style 32nd roll while hits still snap to
//   the 16th grid (SPEC 2.3).
// No Tone.js here, so project data can use these types too.

export type DrumName =
  | 'kick'
  | 'snare'
  | 'hihatClosed'
  | 'hihatOpen'
  | 'clap'
  | 'crash'
  | 'tom'
  | 'shaker'
  | 'bass808'
  | 'hihatRoll'

export interface DrumInfo {
  name: DrumName
  label: string
  file: string
}

export const DRUMS: DrumInfo[] = [
  { name: 'kick', label: 'Kick', file: 'kick.wav' },
  { name: 'snare', label: 'Snare', file: 'snare.wav' },
  { name: 'hihatClosed', label: 'Closed hi-hat', file: 'hihat-closed.wav' },
  { name: 'hihatOpen', label: 'Open hi-hat', file: 'hihat-open.wav' },
  { name: 'clap', label: 'Clap', file: 'clap.wav' },
  { name: 'crash', label: 'Crash', file: 'crash.wav' },
  { name: 'tom', label: 'Tom', file: 'tom.wav' },
  { name: 'shaker', label: 'Shaker', file: 'shaker.wav' },
  { name: 'bass808', label: '808', file: '808.wav' },
  { name: 'hihatRoll', label: 'Hi-hat roll', file: 'hihat-closed.wav' },
]

export function getDrumLabel(name: DrumName): string {
  for (const drum of DRUMS) {
    if (drum.name === name) {
      return drum.label
    }
  }
  return name
}
