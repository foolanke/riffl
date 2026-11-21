// The whole project is one plain data object (SPEC 0.4).
// Later steps add objects, layers and hits to it. Save, load and undo
// will work by copying this object, so every change replaces it with a
// new copy instead of editing it in place.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").

export type TimeSignature = '4/4' | '3/4' | '6/8'
export type LoopBars = 1 | 2 | 4
export type CountInBars = 0 | 1 | 2

export interface ProjectSettings {
  tempoBpm: number
  timeSignature: TimeSignature
  loopBars: LoopBars
  key: string
  metronomeOn: boolean
  metronomeVolume: number // 0 (silent) to 1 (full)
  countInBars: CountInBars
}

export interface Project {
  settings: ProjectSettings
}

// Allowed values for the setup controls (SPEC 2.1, 2.2).
export const MIN_TEMPO_BPM = 60
export const MAX_TEMPO_BPM = 180
export const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8']
export const LOOP_BAR_OPTIONS: LoopBars[] = [1, 2, 4]
export const COUNT_IN_OPTIONS: CountInBars[] = [0, 1, 2]

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

function buildKeyList(): string[] {
  const keys: string[] = []
  for (const note of NOTE_NAMES) {
    keys.push(note + ' major')
  }
  for (const note of NOTE_NAMES) {
    keys.push(note + ' minor')
  }
  return keys
}

export const KEYS: string[] = buildKeyList()

// Defaults are the demo song's settings: I Gotta Feeling (SPEC 2.4).
export function createDefaultProject(): Project {
  return {
    settings: {
      tempoBpm: 128,
      timeSignature: '4/4',
      loopBars: 2,
      key: 'G major',
      metronomeOn: true,
      metronomeVolume: 0.8,
      countInBars: 1, // SPEC 1.3: 1-bar count-in
    },
  }
}

// ---- The single current project, plus change notifications ----

let currentProject: Project = createDefaultProject()
const listeners = new Set<() => void>()

export function getProject(): Project {
  return currentProject
}

export function subscribeToProject(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

export function updateSettings(changes: Partial<ProjectSettings>): void {
  const newSettings: ProjectSettings = { ...currentProject.settings, ...changes }

  // Keep tempo inside the allowed range no matter who calls this.
  newSettings.tempoBpm = Math.min(MAX_TEMPO_BPM, Math.max(MIN_TEMPO_BPM, newSettings.tempoBpm))

  currentProject = { ...currentProject, settings: newSettings }

  for (const listener of listeners) {
    listener()
  }
}
