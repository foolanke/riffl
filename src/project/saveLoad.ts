// Save and load (SPEC 0.4, step 18).
// - Auto-save: the project is written to browser storage after every change.
// - File: the project can be downloaded as a .json file and loaded on
//   another laptop.
// Per-laptop things (lag check, mic sensitivity) are not part of the
// project, so a loaded file sounds the same on any laptop.
import { DRUMS } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import { INSTRUMENTS, isPitch } from '../audio/instruments.ts'
import type { InstrumentName } from '../audio/instruments.ts'
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
import type {
  Box,
  OutlinePoint,
  DrumLayer,
  Layer,
  MelodyLayer,
  MelodyNote,
  Project,
  ProjectSettings,
  TrackedObject,
} from './projectStore.ts'

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
  const objectsData = Array.isArray(data.objects) ? data.objects : []
  const layersData = Array.isArray(data.layers) ? data.layers : []

  return {
    version: PROJECT_VERSION,
    settings: parseSettings(settingsData, defaults.settings),
    objects: parseObjects(objectsData),
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

// Drum and melody layers stay in one list, in their saved order.
// A layer with no type comes from a version 1 file, which only had drums.
function parseLayers(data: unknown[]): Layer[] {
  const layers: Layer[] = []
  for (const item of data) {
    if (!isObject(item)) {
      continue
    }
    let layer: Layer | null = null
    if (item.type === 'melody') {
      layer = parseMelodyLayer(item)
    } else if (item.type === 'drum' || item.type === undefined) {
      layer = parseDrumLayer(item)
    }
    if (layer !== null) {
      layers.push(layer)
    }
  }
  return layers
}

function parseDrumLayer(item: Record<string, unknown>): DrumLayer | null {
  const drum = findDrumName(item.drum)
  if (drum === null || !Array.isArray(item.hits)) {
    return null
  }
  const hits: number[] = []
  for (const hit of item.hits) {
    if (isStep(hit)) {
      hits.push(hit)
    }
  }
  const layer: DrumLayer = {
    type: 'drum',
    id: parseLayerId(item),
    drum: drum,
    hits: hits,
    muted: item.muted === true,
  }
  if (typeof item.objectId === 'string') {
    layer.objectId = item.objectId
  }
  return layer
}

function parseMelodyLayer(item: Record<string, unknown>): MelodyLayer | null {
  const instrument = findInstrumentName(item.instrument)
  if (instrument === null || !Array.isArray(item.notes)) {
    return null
  }
  const notes: MelodyNote[] = []
  for (const note of item.notes) {
    if (!isObject(note)) {
      continue
    }
    // Minimum note length is one 16th (SPEC 3.7).
    const lengthOk = typeof note.length === 'number' && Number.isInteger(note.length) && note.length >= 1
    if (isStep(note.step) && lengthOk && isPitch(note.pitch)) {
      notes.push({ step: note.step, length: note.length as number, pitch: note.pitch })
    }
  }
  return {
    type: 'melody',
    id: parseLayerId(item),
    instrument: instrument,
    notes: notes,
    muted: item.muted === true,
  }
}

function parseLayerId(item: Record<string, unknown>): string {
  return typeof item.id === 'string' ? item.id : crypto.randomUUID()
}

function isStep(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function findInstrumentName(value: unknown): InstrumentName | null {
  for (const instrument of INSTRUMENTS) {
    if (instrument.name === value) {
      return instrument.name
    }
  }
  return null
}

function parseObjects(data: unknown[]): TrackedObject[] {
  const objects: TrackedObject[] = []
  for (const item of data) {
    if (!isObject(item)) {
      continue
    }
    const drum = findDrumName(item.drum)
    const box = isObject(item.box) ? parseBox(item.box) : null
    if (drum === null || box === null) {
      continue
    }
    const object: TrackedObject = {
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      drum: drum,
      box: box,
    }
    const outline = parseOutline(item.outline)
    if (outline !== null) {
      object.outline = outline
    }
    objects.push(object)
  }
  return objects
}

// An object's silhouette: at least 3 points on the camera image (0..1).
// Optional; anything malformed is dropped and the plain box is shown.
function parseOutline(data: unknown): OutlinePoint[] | null {
  if (!Array.isArray(data) || data.length < 3) {
    return null
  }
  const points: OutlinePoint[] = []
  for (const item of data) {
    if (!isObject(item) || typeof item.x !== 'number' || typeof item.y !== 'number') {
      return null
    }
    if (item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1) {
      return null
    }
    points.push({ x: item.x, y: item.y })
  }
  return points
}

// A box must lie inside the camera image (0..1) and have some size.
function parseBox(data: Record<string, unknown>): Box | null {
  const { x, y, width, height } = data
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    return null
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.0001 || y + height > 1.0001) {
    return null
  }
  return { x: x, y: y, width: width, height: height }
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
