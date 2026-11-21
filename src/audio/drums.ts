// The 8 drum sounds (SPEC 1.7) and their sample files in public/samples/.
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
]

export function getDrumLabel(name: DrumName): string {
  for (const drum of DRUMS) {
    if (drum.name === name) {
      return drum.label
    }
  }
  return name
}
