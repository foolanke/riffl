// The whole project is one plain data object (SPEC 0.4).
// Later steps add objects, layers and hits to it. Save, load and undo
// will work by copying this object, so every change replaces it with a
// new copy instead of editing it in place.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
import type { DrumName } from '../audio/drums.ts'

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

// One recorded take (SPEC 1.6). Hits are 16th-note step numbers
// counted from the start of the loop (0 = bar 1, beat 1).
export interface Layer {
  id: string
  drum: DrumName
  hits: number[]
  muted: boolean
  // The object this take was played on (step 24), so a retake checks the
  // same box. Missing for takes recorded without an object.
  objectId?: string
}

// A box on the camera image, 0..1 from left to right and top to bottom.
// Stored in camera-image coordinates (not mirrored like the screen).
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

// A physical object on the table (SPEC 1.2): one fixed box, one drum.
export interface TrackedObject {
  id: string
  drum: DrumName
  box: Box
}

export interface Project {
  version: number // file format version, for loading saves later
  settings: ProjectSettings
  objects: TrackedObject[]
  layers: Layer[]
}

export const PROJECT_VERSION = 1

// 16th-note grid steps in one bar (SPEC 2.3). 6/8 = 6 eighths = 12 sixteenths.
export function getStepsPerBar(timeSignature: TimeSignature): number {
  if (timeSignature === '3/4' || timeSignature === '6/8') {
    return 12
  }
  return 16
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
    version: PROJECT_VERSION,
    settings: {
      tempoBpm: 128,
      timeSignature: '4/4',
      loopBars: 2,
      key: 'G major',
      metronomeOn: true,
      metronomeVolume: 0.8,
      countInBars: 1, // SPEC 1.3: 1-bar count-in
    },
    objects: [],
    layers: [],
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

  setProject({ ...currentProject, settings: newSettings })
}

// Every change goes through here: replace the object, then tell listeners.
function setProject(newProject: Project): void {
  currentProject = newProject
  for (const listener of listeners) {
    listener()
  }
}

// Swap in a whole project (loading a save or starting fresh).
// Undo history belongs to the old project, so it is cleared.
export function replaceProject(newProject: Project): void {
  undoStack.length = 0
  setProject(newProject)
}

// ---- Undo (SPEC 1.6: undo deletes the most recent take) ----
// Before every take the layer list is copied onto this stack. Undo puts
// the copy back, which removes a new take or brings back a retaken layer.
// Layers are never edited in place, so copying the array is enough.

const MAX_UNDO_STEPS = 50
const undoStack: Layer[][] = []

function rememberLayersForUndo(): void {
  undoStack.push([...currentProject.layers])
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift()
  }
}

// Returns false if there was nothing to undo.
export function undoLastTake(): boolean {
  const previousLayers = undoStack.pop()
  if (!previousLayers) {
    return false
  }
  setProject({ ...currentProject, layers: previousLayers })
  return true
}

// A new take becomes a new layer (SPEC 1.6), undoable.
export function addTakeLayer(layer: Layer): void {
  rememberLayersForUndo()
  addLayers([layer])
}

// A retake replaces one layer's hits, keeping its place in the list. Undoable.
export function replaceLayerHits(layerId: string, hits: number[]): void {
  rememberLayersForUndo()
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === layerId) {
      updated.push({ ...layer, hits: hits })
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

// ---- Objects (SPEC 1.2, step 21) ----
// Not part of undo: undo is only for takes (SPEC 1.6).

export function addObject(object: TrackedObject): void {
  setProject({ ...currentProject, objects: [...currentProject.objects, object] })
}

export function deleteObject(objectId: string): void {
  const remaining: TrackedObject[] = []
  for (const object of currentProject.objects) {
    if (object.id !== objectId) {
      remaining.push(object)
    }
  }
  setProject({ ...currentProject, objects: remaining })
}

export function setObjectDrum(objectId: string, drum: DrumName): void {
  const updated: TrackedObject[] = []
  for (const object of currentProject.objects) {
    if (object.id === objectId) {
      updated.push({ ...object, drum: drum })
    } else {
      updated.push(object)
    }
  }
  setProject({ ...currentProject, objects: updated })
}

export function findObject(objectId: string | null | undefined): TrackedObject | null {
  for (const object of currentProject.objects) {
    if (object.id === objectId) {
      return object
    }
  }
  return null
}

// ---- Layers ----

export function addLayers(newLayers: Layer[]): void {
  setProject({ ...currentProject, layers: [...currentProject.layers, ...newLayers] })
}

export function deleteLayer(layerId: string): void {
  const remaining: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id !== layerId) {
      remaining.push(layer)
    }
  }
  setProject({ ...currentProject, layers: remaining })
}

export function toggleLayerMuted(layerId: string): void {
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === layerId) {
      updated.push({ ...layer, muted: !layer.muted })
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

// For keys 1-9 (SPEC 0.6). Index 0 = layer 1. Does nothing if no such layer.
export function toggleLayerMutedByIndex(index: number): void {
  const layer = currentProject.layers[index]
  if (layer) {
    toggleLayerMuted(layer.id)
  }
}
