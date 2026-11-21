// Save and load (SPEC 0.4, step 18).
// - Auto-save: the project is written to browser storage after every change.
// - File: the project can be downloaded as a .json file and loaded on
//   another laptop.
// Per-laptop things (lag check, mic sensitivity) are not part of the
// project, so a loaded file sounds the same on any laptop.
import { DRUMS } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import {
  COUNT_IN_OPTIONS,
  KEYS,
  LOOP_BAR_OPTIONS,
  MAX_TEMPO_BPM,
  MIN_TEMPO_BPM,
  PROJECT_VERSION,
  TIME_SIGNATURES,
  createDefaultProject,
  getProject,
  replaceProject,
  subscribeToProject,
} from './projectStore.ts'
import type { Layer, Project, ProjectSettings } from './projectStore.ts'

const STORAGE_KEY = 'sounds.project'

// Call once at startup, before the app renders.
export function initAutoSave(): void {
  const savedText = readStorage()
  if (savedText !== null) {
    try {
      replaceProject(parseProject(savedText))
    } catch (error) {
      console.warn('Saved project could not be read, starting fresh.', error)
    }
  }
  subscribeToProject(function () {
    writeStorage(JSON.stringify(getProject()))
  })
}

export function startNewProject(): void {
  replaceProject(createDefaultProject())
}

// ---- File download / load ----

export function downloadProjectFile(): void {
  const text = JSON.stringify(getProject(), null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sounds-project.json'
  link.click()
  URL.revokeObjectURL(url)
}

// Throws with a readable message if the file is not a valid project.
export async function loadProjectFile(file: File): Promise<void> {
  const text = await file.text()
  replaceProject(parseProject(text))
}

// ---- Reading a project safely ----
// A save may come from an older version or be hand-edited, so every field
// is checked. Missing or invalid settings fall back to the defaults.

function parseProject(text: string): Project {
  const data: unknown = JSON.parse(text)
  if (!isObject(data)) {
    throw new Error('Not a project file.')
  }
  const defaults = createDefaultProject()
  const settingsData = isObject(data.settings) ? data.settings : {}
  const layersData = Array.isArray(data.layers) ? data.layers : []

  return {
    version: PROJECT_VERSION,
    settings: parseSettings(settingsData, defaults.settings),
    layers: parseLayers(layersData),
  }
}

function parseSettings(data: Record<string, unknown>, defaults: ProjectSettings): ProjectSettings {
  const settings: ProjectSettings = { ...defaults }

  if (typeof data.tempoBpm === 'number' && data.tempoBpm >= MIN_TEMPO_BPM && data.tempoBpm <= MAX_TEMPO_BPM) {
    settings.tempoBpm = data.tempoBpm
  }
  for (const signature of TIME_SIGNATURES) {
    if (data.timeSignature === signature) {
      settings.timeSignature = signature
    }
  }
  for (const bars of LOOP_BAR_OPTIONS) {
    if (data.loopBars === bars) {
      settings.loopBars = bars
    }
  }
  if (typeof data.key === 'string' && KEYS.includes(data.key)) {
    settings.key = data.key
  }
  if (typeof data.metronomeOn === 'boolean') {
    settings.metronomeOn = data.metronomeOn
  }
  if (typeof data.metronomeVolume === 'number' && data.metronomeVolume >= 0 && data.metronomeVolume <= 1) {
    settings.metronomeVolume = data.metronomeVolume
  }
  for (const bars of COUNT_IN_OPTIONS) {
    if (data.countInBars === bars) {
      settings.countInBars = bars
    }
  }
  return settings
}

function parseLayers(data: unknown[]): Layer[] {
  const layers: Layer[] = []
  for (const item of data) {
    if (!isObject(item)) {
      continue
    }
    const drum = findDrumName(item.drum)
    if (drum === null || !Array.isArray(item.hits)) {
      continue
    }
    const hits: number[] = []
    for (const hit of item.hits) {
      if (typeof hit === 'number' && Number.isInteger(hit) && hit >= 0) {
        hits.push(hit)
      }
    }
    layers.push({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      drum: drum,
      hits: hits,
      muted: item.muted === true,
    })
  }
  return layers
}

function findDrumName(value: unknown): DrumName | null {
  for (const drum of DRUMS) {
    if (drum.name === value) {
      return drum.name
    }
  }
  return null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ---- Browser storage (can be unavailable, so never crash on it) ----

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStorage(text: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, text)
  } catch {
    // Keeps working for this session even if it can't be saved.
  }
}
