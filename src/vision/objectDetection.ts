// Automatic object suggestions (designed page only; the human asked for
// this on top of SPEC 1.2, where the user drags every box by hand).
// MediaPipe's object detector (EfficientDet-Lite2, 80 everyday COCO
// classes such as cup, bottle, book) looks at the camera a couple of times
// a second and returns boxes. Only the box matters (the drum comes from the
// card), so the class is just a hint: it's shown only when the detector is
// sure, and a wrong guess (a phone read as a toothbrush) costs nothing.
// Objects outside those 80 classes are added by clicking them instead
// (silhouette.ts findObjectBoxAt). The UI shows them as suggestions; clicking
// one turns it into an object exactly as if the user had drawn that box.
// Nothing is added automatically, and hits are still confirmed by the box
// (SPEC 1.4). Drawing boxes by hand keeps working.
//
// Boxes follow their objects (the human asked for this, beyond SPEC 1.2's
// fixed boxes): an added object the detector has recognised before, that
// is no longer seen with no hand covering it, is either moved to where a
// same-sized object now is, or removed if it's gone. Never during a take
// (the UI doesn't call this then), so a take's confirmation box can't move.
// Objects the detector never recognised (added by clicking an unusual
// object) are left alone: it can't tell whether they're still there.
//
// Opt-in from the UI (a setting, default on); the test page never starts it.
// Offline rule (SPEC 0.2): model in public/models/, WASM from the npm package.
import { ObjectDetector } from '@mediapipe/tasks-vision'
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Box, TrackedObject } from '../project/projectStore.ts'
import { getCameraVideo } from './camera.ts'
import { getLatestHandFrame } from './handTracking.ts'
import type { HandFrame } from './handTracking.ts'
import { isHandInBox } from './objects.ts'

// Lite2 rather than Lite0: Lite0 missed and mislabelled too much.
const MODEL_URL = import.meta.env.BASE_URL + 'models/efficientdet_lite2.tflite'

// Objects stay still (SPEC 1.2), so a couple of looks a second is plenty
// and leaves the CPU/GPU to hand tracking.
const DETECT_EVERY_MS = 500
// Low on purpose: the class doesn't matter, and a real object that scores
// low is seen again and again, while noise isn't (MIN_SIGHTINGS).
const MIN_SCORE = 0.25
const MAX_RESULTS = 10
// Shown only once seen in this many looks: one-off noise never appears.
const MIN_SIGHTINGS = 2
// A shown suggestion is dropped after this many looks without it while
// nothing covers it (the thing was moved or taken away), so no stale box
// is left behind. While a hand is over it, it's kept, up to KEEP_UNSEEN_MS.
const SUGGESTION_GONE_LOOKS = 2
const KEEP_UNSEEN_MS = 10000
// Every box gets this much room on each side (share of its size), the same
// as click-to-add (silhouette.ts), so a hand touching the edge is inside.
const BOX_PADDING = 0.1

// ---- Following added objects ----
// A detection overlapping an object's box this much is that object.
const OBJECT_MATCH_OVERLAP = 0.3
// Matched, but its centre is off by more than this share of the box size
// for OBJECT_SHIFT_LOOKS looks in a row: the object was nudged, so the box
// moves onto it. (Centre, not overlap: a hand-drawn box that is just bigger
// than the detector's box must not be resized.)
const OBJECT_SHIFT_FRACTION = 0.25
const OBJECT_SHIFT_LOOKS = 2
// Only objects recognised in this many looks are followed.
const OBJECT_TRUSTED_SIGHTINGS = 3
// Not seen (and no hand over it) this long: moved elsewhere, or gone.
const OBJECT_GONE_MS = 2000
// A detection elsewhere counts as the moved object if its size is within
// this factor of the object's box.
const MOVED_SIZE_FACTOR = 2
// The class name is shown only at this confidence; below it the tag says
// just "Object".
const LABEL_SCORE = 0.6
// Two boxes this much overlapped (intersection over union) are the same
// thing: the same suggestion across looks, or a suggestion that is already
// an object.
const SAME_BOX_OVERLAP = 0.5
// Bigger than this share of the picture is the table or the room, not a
// thing to tap.
const MAX_AREA_SHARE = 0.6
// Classes that are never a percussion object on a table.
// (Only classes that are reliably big background things: a mislabelled
// small object must not be thrown away.)
const IGNORED_CLASSES = ['person', 'dining table']

export interface ObjectSuggestion {
  id: number
  label: string // e.g. "cup", or '' when the detector isn't sure what it is
  box: Box // camera-image coordinates, 0..1, not mirrored
  lastSeenMs: number
  sightings: number
  misses: number // looks in a row without it, with nothing covering it
}

// What the UI should do to added objects (it owns deleting: links, takes).
export interface ObjectChanges {
  move: (objectId: string, box: Box) => void
  remove: (objectId: string) => void
}

interface ObjectWatch {
  sightings: number
  shiftedLooks: number
  missingSinceMs: number | null
}

// ---- The setting (saved per browser, default on) ----
const STORAGE_KEY = 'sounds.autoDetectObjects'
let enabled = loadEnabled()
const settingListeners = new Set<() => void>()

export function getAutoDetectObjects(): boolean {
  return enabled
}

export function setAutoDetectObjects(on: boolean): void {
  enabled = on
  if (!on) {
    suggestions = []
  }
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Storage blocked: the setting just isn't remembered.
  }
  for (const listener of settingListeners) {
    listener()
  }
}

export function subscribeToAutoDetectObjects(listener: () => void): () => void {
  settingListeners.add(listener)
  return function unsubscribe() {
    settingListeners.delete(listener)
  }
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

// ---- Detection ----
let detectorLoading: Promise<ObjectDetector> | null = null
let detector: ObjectDetector | null = null
let lastDetectMs = 0
let detectMsAverage = 0
let suggestions: ObjectSuggestion[] = []
let nextSuggestionId = 1
const objectWatch = new Map<string, ObjectWatch>()

function loadDetector(): void {
  if (detectorLoading) {
    return
  }
  detectorLoading = createDetector()
  detectorLoading
    .then(function (loaded) {
      detector = loaded
    })
    .catch(function (error) {
      console.warn('Object detector failed to load', error)
      detectorLoading = null // allow trying again
    })
}

// GPU is faster; fall back to CPU if this laptop can't do GPU.
async function createDetector(): Promise<ObjectDetector> {
  const wasmFiles = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
  const options = { scoreThreshold: MIN_SCORE, maxResults: MAX_RESULTS, runningMode: 'IMAGE' as const }
  try {
    return await ObjectDetector.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      ...options,
    })
  } catch {
    return await ObjectDetector.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      ...options,
    })
  }
}

// Call every screen frame while suggestions should show (never during a
// take). It only looks at the camera every DETECT_EVERY_MS, follows added
// objects through `changes`, and skips suggestions that overlap an existing
// object. Returns the current suggestions.
export function updateObjectSuggestions(objects: TrackedObject[], changes: ObjectChanges): ObjectSuggestion[] {
  if (!enabled) {
    return []
  }
  loadDetector()
  const now = performance.now()
  const video = getCameraVideo()
  const videoReady = video !== null && video.readyState >= 2 && video.videoWidth > 0
  if (detector !== null && videoReady && now - lastDetectMs >= DETECT_EVERY_MS) {
    lastDetectMs = now
    detectOnce(detector, video, now, objects, changes)
  }

  // Forget suggestions not seen for a while, and hide ones already added.
  const kept: ObjectSuggestion[] = []
  for (const suggestion of suggestions) {
    if (now - suggestion.lastSeenMs <= KEEP_UNSEEN_MS) {
      kept.push(suggestion)
    }
  }
  suggestions = kept
  const visible: ObjectSuggestion[] = []
  for (const suggestion of suggestions) {
    if (suggestion.sightings >= MIN_SIGHTINGS && !overlapsAnyObject(suggestion.box, objects)) {
      visible.push(suggestion)
    }
  }
  return visible
}

function detectOnce(
  loaded: ObjectDetector,
  video: HTMLVideoElement,
  now: number,
  objects: TrackedObject[],
  changes: ObjectChanges,
): void {
  const start = performance.now()
  let result
  try {
    result = loaded.detect(video)
  } catch (error) {
    console.warn('Object detection failed', error)
    return
  }
  const took = performance.now() - start
  detectMsAverage = detectMsAverage === 0 ? took : detectMsAverage * 0.8 + took * 0.2

  const width = video.videoWidth
  const height = video.videoHeight
  const found: { box: Box; label: string }[] = []
  for (const detection of result.detections) {
    const category = detection.categories[0]
    const pixels = detection.boundingBox
    if (!category || !pixels) {
      continue
    }
    if (IGNORED_CLASSES.includes(category.categoryName)) {
      continue
    }
    const label = category.score >= LABEL_SCORE ? category.categoryName : ''
    const box = clipBox({
      x: pixels.originX / width,
      y: pixels.originY / height,
      width: pixels.width / width,
      height: pixels.height / height,
    })
    if (box.width * box.height > MAX_AREA_SHARE || box.width <= 0 || box.height <= 0) {
      continue
    }
    found.push({ box: padBox(box), label: label })
  }

  const frame = getLatestHandFrame()
  const claimed = followObjects(found, objects, changes, frame, now)

  // Detections that aren't an added object: suggestions.
  const matchedIds = new Set<number>()
  for (let i = 0; i < found.length; i++) {
    if (claimed.has(i)) {
      continue
    }
    const box = found[i].box
    const label = found[i].label
    // Same thing as an existing suggestion: follow it (newest box wins).
    let match: ObjectSuggestion | null = null
    for (const suggestion of suggestions) {
      if (!matchedIds.has(suggestion.id) && getOverlap(suggestion.box, box) >= SAME_BOX_OVERLAP) {
        match = suggestion
        break
      }
    }
    if (match) {
      match.box = box
      if (label !== '') {
        match.label = label // keep the last sure name through unsure looks
      }
      match.lastSeenMs = now
      match.sightings++
      match.misses = 0
      matchedIds.add(match.id)
    } else {
      const id = nextSuggestionId++
      suggestions.push({ id: id, label: label, box: box, lastSeenMs: now, sightings: 1, misses: 0 })
      matchedIds.add(id)
    }
  }
  // Not seen this look: if nothing covers it, it was moved or taken away.
  const kept: ObjectSuggestion[] = []
  for (const suggestion of suggestions) {
    if (!matchedIds.has(suggestion.id) && !isHandInBox(frame, suggestion.box)) {
      suggestion.misses++
    }
    if (suggestion.misses < SUGGESTION_GONE_LOOKS) {
      kept.push(suggestion)
    }
  }
  suggestions = kept
}

// Matches this look's detections to added objects, moves or removes
// objects that are gone (see the top of the file), and returns the indexes
// of detections that belong to objects (not suggestions).
function followObjects(
  found: { box: Box; label: string }[],
  objects: TrackedObject[],
  changes: ObjectChanges,
  frame: HandFrame,
  now: number,
): Set<number> {
  const claimed = new Set<number>()
  const goneObjects: TrackedObject[] = []
  const liveIds = new Set<string>()
  for (const object of objects) {
    liveIds.add(object.id)
    let watch = objectWatch.get(object.id)
    if (!watch) {
      watch = { sightings: 0, shiftedLooks: 0, missingSinceMs: null }
      objectWatch.set(object.id, watch)
    }
    let best = -1
    let bestOverlap = OBJECT_MATCH_OVERLAP
    for (let i = 0; i < found.length; i++) {
      const overlap = getOverlap(object.box, found[i].box)
      if (!claimed.has(i) && overlap >= bestOverlap) {
        best = i
        bestOverlap = overlap
      }
    }
    if (best >= 0) {
      claimed.add(best)
      watch.sightings++
      watch.missingSinceMs = null
      // Nudged a little: move the box onto it once that's consistent.
      const boxSize = Math.max(object.box.width, object.box.height)
      const shifted = getCentreDistance(object.box, found[best].box) > boxSize * OBJECT_SHIFT_FRACTION
      watch.shiftedLooks = shifted ? watch.shiftedLooks + 1 : 0
      if (watch.shiftedLooks >= OBJECT_SHIFT_LOOKS && watch.sightings >= OBJECT_TRUSTED_SIGHTINGS) {
        watch.shiftedLooks = 0
        changes.move(object.id, found[best].box)
      }
      continue
    }
    watch.shiftedLooks = 0
    if (watch.sightings < OBJECT_TRUSTED_SIGHTINGS || isHandInBox(frame, object.box)) {
      watch.missingSinceMs = null // unknown kind of object, or covered by a hand
      continue
    }
    if (watch.missingSinceMs === null) {
      watch.missingSinceMs = now
    }
    if (now - watch.missingSinceMs >= OBJECT_GONE_MS) {
      goneObjects.push(object)
    }
  }
  // Forget objects deleted meanwhile.
  for (const id of Array.from(objectWatch.keys())) {
    if (!liveIds.has(id)) {
      objectWatch.delete(id)
    }
  }

  // A gone object moves to the nearest unclaimed detection of about its
  // size (it was moved), or is removed (it was taken away).
  for (const object of goneObjects) {
    const area = object.box.width * object.box.height
    let best = -1
    let bestDistance = Infinity
    for (let i = 0; i < found.length; i++) {
      const candidateArea = found[i].box.width * found[i].box.height
      const sizeRatio = candidateArea / area
      const similarSize = sizeRatio <= MOVED_SIZE_FACTOR && sizeRatio >= 1 / MOVED_SIZE_FACTOR
      const distance = getCentreDistance(object.box, found[i].box)
      if (!claimed.has(i) && similarSize && distance < bestDistance) {
        best = i
        bestDistance = distance
      }
    }
    const watch = objectWatch.get(object.id)
    if (best >= 0) {
      claimed.add(best)
      if (watch) {
        watch.missingSinceMs = null
      }
      changes.move(object.id, found[best].box)
    } else {
      objectWatch.delete(object.id)
      changes.remove(object.id)
    }
  }
  return claimed
}

function getCentreDistance(a: Box, b: Box): number {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2)
  const dy = a.y + a.height / 2 - (b.y + b.height / 2)
  return Math.sqrt(dx * dx + dy * dy)
}

function padBox(box: Box): Box {
  const padX = box.width * BOX_PADDING
  const padY = box.height * BOX_PADDING
  return clipBox({ x: box.x - padX, y: box.y - padY, width: box.width + 2 * padX, height: box.height + 2 * padY })
}

// For the latency readout: average model time per look, in ms.
export function getObjectDetectMs(): number {
  return detectMsAverage
}

function overlapsAnyObject(box: Box, objects: TrackedObject[]): boolean {
  for (const object of objects) {
    if (getOverlap(box, object.box) >= SAME_BOX_OVERLAP) {
      return true
    }
  }
  return false
}

// Intersection over union of two boxes (0 = apart, 1 = identical).
function getOverlap(a: Box, b: Box): number {
  const left = Math.max(a.x, b.x)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const top = Math.max(a.y, b.y)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= left || bottom <= top) {
    return 0
  }
  const shared = (right - left) * (bottom - top)
  return shared / (a.width * a.height + b.width * b.height - shared)
}

function clipBox(box: Box): Box {
  const left = Math.max(0, box.x)
  const top = Math.max(0, box.y)
  const right = Math.min(1, box.x + box.width)
  const bottom = Math.min(1, box.y + box.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}
