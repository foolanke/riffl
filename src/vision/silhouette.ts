// Object silhouettes (shown on the object markers, SPEC 1.2 "cosmetic").
// When a box is drawn, the camera picture inside it is cut out with
// MediaPipe's Interactive Segmenter (tapped at the box centre), and the
// outline of the object is saved as a polygon in camera-image coordinates.
// Objects stay still on the table (SPEC 1.2), so this runs once per object.
// The box itself is still what hit confirmation uses (SPEC 1.4).
//
// findObjectBoxAt (designed page, the human's addition to SPEC 1.2): click
// any object on the camera and the same segmenter, tapped at the click,
// finds its box. Works for any kind of object, unlike the 80-class
// detector in objectDetection.ts.
//
// Offline rule (SPEC 0.2): model in public/models/, WASM from the npm package.
import { InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision'
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Box, OutlinePoint } from '../project/projectStore.ts'

const MODEL_URL = import.meta.env.BASE_URL + 'models/magic_touch.tflite'

// The box picture is scaled so its longest side is this many pixels.
const CROP_SIZE = 384
// A pixel belongs to the object when the model is at least this sure.
const CONFIDENCE_THRESHOLD = 0.5
// Ignore cut-outs that cover less than this share of the box (a miss).
const MIN_AREA_SHARE = 0.03
// Outline simplification tolerance, in crop pixels.
const SIMPLIFY_TOLERANCE = 1.2

let segmenterLoading: Promise<InteractiveSegmenterLegacy> | null = null

function getSegmenter(): Promise<InteractiveSegmenterLegacy> {
  if (!segmenterLoading) {
    segmenterLoading = createSegmenter()
    segmenterLoading.catch(function () {
      segmenterLoading = null // allow trying again
    })
  }
  return segmenterLoading
}

// GPU is faster; fall back to CPU if this laptop can't do GPU.
async function createSegmenter(): Promise<InteractiveSegmenterLegacy> {
  const wasmFiles = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
  try {
    return await InteractiveSegmenterLegacy.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  } catch {
    return await InteractiveSegmenterLegacy.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  }
}

// Cuts the object out of the current camera frame and returns its outline
// (camera-image coordinates, 0..1, not mirrored), or null if nothing clear
// was found.
export async function traceSilhouette(video: HTMLVideoElement, box: Box): Promise<OutlinePoint[] | null> {
  const segmenter = await getSegmenter()

  // Copy just the box out of the frame, so small objects get full model resolution.
  const sourceX = box.x * video.videoWidth
  const sourceY = box.y * video.videoHeight
  const sourceWidth = box.width * video.videoWidth
  const sourceHeight = box.height * video.videoHeight
  const scale = CROP_SIZE / Math.max(sourceWidth, sourceHeight)
  const width = Math.max(8, Math.round(sourceWidth * scale))
  const height = Math.max(8, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)

  // Tap the centre of the box: the user drew the box around the object.
  const result = segmenter.segment(canvas, { keypoint: { x: 0.5, y: 0.5 } })
  const masks = result.confidenceMasks
  if (!masks || masks.length === 0) {
    return null
  }
  // With more than one mask, the last one is the "object" channel.
  const mask = masks[masks.length - 1]
  const confidence = mask.getAsFloat32Array()
  const maskWidth = mask.width
  const maskHeight = mask.height
  const inside = new Uint8Array(maskWidth * maskHeight)
  for (let i = 0; i < inside.length; i++) {
    inside[i] = confidence[i] >= CONFIDENCE_THRESHOLD ? 1 : 0
  }
  for (const each of masks) {
    each.close()
  }

  const centreIndex = Math.floor(maskHeight / 2) * maskWidth + Math.floor(maskWidth / 2)
  const shape = keepMainShape(inside, maskWidth, maskHeight, centreIndex)
  if (shape === null || shape.area < MIN_AREA_SHARE * maskWidth * maskHeight) {
    return null
  }
  fillHoles(shape.pixels, maskWidth, maskHeight)
  const contour = traceOuterContour(shape.pixels, maskWidth, maskHeight)
  if (contour.length < 3) {
    return null
  }
  const simple = simplifyClosed(contour, SIMPLIFY_TOLERANCE)

  // Crop pixels → camera-image coordinates. Pixel centres, rounded so saves stay small.
  const outline: OutlinePoint[] = []
  for (const point of simple) {
    outline.push({
      x: round4(box.x + ((point.x + 0.5) / maskWidth) * box.width),
      y: round4(box.y + ((point.y + 0.5) / maskHeight) * box.height),
    })
  }
  return outline
}

// ---- Click to add an object ----

// The whole frame is scaled to this many pixels on its longest side.
const CLICK_FRAME_SIZE = 512
// The click finds nothing (returns null) if the shape covers more than this
// share of the picture (bare table, wall) or less than this (a speck).
const CLICK_MAX_AREA_SHARE = 0.6
const CLICK_MIN_AREA_SHARE = 0.002
// Room added around the object on each side, as a share of its size, so a
// hand touching its edge is still inside the box (SPEC 1.4).
const CLICK_BOX_PADDING = 0.1

// The box of the object under `point` (camera-image coordinates, 0..1, not
// mirrored), or null if the click didn't land on a clear, object-sized shape.
export async function findObjectBoxAt(video: HTMLVideoElement, point: { x: number; y: number }): Promise<Box | null> {
  const segmenter = await getSegmenter()
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return null
  }
  const scale = CLICK_FRAME_SIZE / Math.max(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  const result = segmenter.segment(canvas, { keypoint: { x: point.x, y: point.y } })
  const masks = result.confidenceMasks
  if (!masks || masks.length === 0) {
    return null
  }
  const mask = masks[masks.length - 1]
  const confidence = mask.getAsFloat32Array()
  const width = mask.width
  const height = mask.height
  const inside = new Uint8Array(width * height)
  for (let i = 0; i < inside.length; i++) {
    inside[i] = confidence[i] >= CONFIDENCE_THRESHOLD ? 1 : 0
  }
  for (const each of masks) {
    each.close()
  }

  // Only the shape the click is actually on counts (not the biggest one).
  const seedX = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)))
  const seedY = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)))
  const seedIndex = seedY * width + seedX
  if (inside[seedIndex] === 0) {
    return null
  }
  const shape = keepMainShape(inside, width, height, seedIndex)
  if (shape === null) {
    return null
  }
  const share = shape.area / (width * height)
  if (share > CLICK_MAX_AREA_SHARE || share < CLICK_MIN_AREA_SHARE) {
    return null
  }

  // Bounding box of the shape, padded, clipped to the picture.
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (shape.pixels[y * width + x] === 1) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  }
  const boxLeft = left / width
  const boxTop = top / height
  const boxWidth = (right + 1 - left) / width
  const boxHeight = (bottom + 1 - top) / height
  const padX = boxWidth * CLICK_BOX_PADDING
  const padY = boxHeight * CLICK_BOX_PADDING
  const x0 = Math.max(0, boxLeft - padX)
  const y0 = Math.max(0, boxTop - padY)
  const x1 = Math.min(1, boxLeft + boxWidth + padX)
  const y1 = Math.min(1, boxTop + boxHeight + padY)
  return { x: round4(x0), y: round4(y0), width: round4(x1 - x0), height: round4(y1 - y0) }
}

// ---- Mask clean-up ----

interface Pixel {
  x: number
  y: number
}

// The connected shape under `seedIndex` (the tap), or the biggest one if the
// tap missed. Returns a new mask with only that shape.
function keepMainShape(
  mask: Uint8Array,
  width: number,
  height: number,
  seedIndex: number,
): { pixels: Uint8Array; area: number } | null {
  const labels = new Int32Array(width * height) // 0 = not visited
  let bestLabel = 0
  let bestArea = 0
  let nextLabel = 1
  const centreIndex = seedIndex
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || labels[start] !== 0) {
      continue
    }
    const label = nextLabel
    nextLabel++
    const area = floodLabel(mask, labels, width, height, start, label)
    if (area > bestArea) {
      bestArea = area
      bestLabel = label
    }
  }
  if (labels[centreIndex] !== 0) {
    bestLabel = labels[centreIndex]
  }
  if (bestLabel === 0) {
    return null
  }
  const pixels = new Uint8Array(width * height)
  let area = 0
  for (let i = 0; i < pixels.length; i++) {
    if (labels[i] === bestLabel) {
      pixels[i] = 1
      area++
    }
  }
  return { pixels: pixels, area: area }
}

// 4-connected flood fill of mask pixels equal to 1, writing `label`. Returns the area.
function floodLabel(mask: Uint8Array, labels: Int32Array, width: number, height: number, start: number, label: number): number {
  const stack = [start]
  labels[start] = label
  let area = 0
  while (stack.length > 0) {
    const index = stack.pop() as number
    area++
    const x = index % width
    const y = (index - x) / width
    const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]
    for (const next of neighbours) {
      if (next >= 0 && mask[next] === 1 && labels[next] === 0) {
        labels[next] = label
        stack.push(next)
      }
    }
  }
  return area
}

// Empty areas that can't reach the edge are holes (e.g. a mug's handle gap
// seen head-on, or a shiny highlight): fill them so only the outer outline remains.
function fillHoles(pixels: Uint8Array, width: number, height: number): void {
  const outside = new Uint8Array(width * height)
  const stack: number[] = []
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1)
  }
  while (stack.length > 0) {
    const index = stack.pop() as number
    if (pixels[index] === 1 || outside[index] === 1) {
      continue
    }
    outside[index] = 1
    const x = index % width
    const y = (index - x) / width
    if (x > 0) stack.push(index - 1)
    if (x < width - 1) stack.push(index + 1)
    if (y > 0) stack.push(index - width)
    if (y < height - 1) stack.push(index + width)
  }
  for (let i = 0; i < pixels.length; i++) {
    if (outside[i] === 0) {
      pixels[i] = 1
    }
  }
}

// ---- Outline tracing ----

// The 8 neighbours, clockwise on screen (y points down), starting east.
const STEP_X = [1, 1, 0, -1, -1, -1, 0, 1]
const STEP_Y = [0, 1, 1, 1, 0, -1, -1, -1]

// Moore-neighbour boundary tracing: walks clockwise around the outside of
// the shape and returns its edge pixels in order.
function traceOuterContour(pixels: Uint8Array, width: number, height: number): Pixel[] {
  function isSet(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < width && y < height && pixels[y * width + x] === 1
  }

  // Start at the top-most, then left-most pixel; the pixel west of it is empty.
  let start: Pixel | null = null
  for (let i = 0; i < pixels.length && start === null; i++) {
    if (pixels[i] === 1) {
      start = { x: i % width, y: Math.floor(i / width) }
    }
  }
  if (start === null) {
    return []
  }

  const contour: Pixel[] = [start]
  let current = start
  let backDirection = 4 // west: where we "came from"
  let firstDirection = -1
  const maxSteps = width * height * 4
  for (let step = 0; step < maxSteps; step++) {
    // Look clockwise around the current pixel, starting just after where we came from.
    let found = -1
    for (let k = 1; k <= 8; k++) {
      const direction = (backDirection + k) % 8
      if (isSet(current.x + STEP_X[direction], current.y + STEP_Y[direction])) {
        found = direction
        break
      }
    }
    if (found === -1) {
      break // a single pixel
    }
    // Back at the start and about to repeat the first move: the loop is closed.
    if (step > 0 && current.x === start.x && current.y === start.y && found === firstDirection) {
      break
    }
    if (firstDirection === -1) {
      firstDirection = found
    }
    // The empty neighbour checked just before `found`, seen from the new pixel.
    const previous = (found + 7) % 8
    const emptyX = current.x + STEP_X[previous]
    const emptyY = current.y + STEP_Y[previous]
    const next = { x: current.x + STEP_X[found], y: current.y + STEP_Y[found] }
    backDirection = directionBetween(next, emptyX, emptyY)
    current = next
    if (!(current.x === start.x && current.y === start.y)) {
      contour.push(current)
    }
  }
  return contour
}

function directionBetween(from: Pixel, toX: number, toY: number): number {
  const dx = toX - from.x
  const dy = toY - from.y
  for (let direction = 0; direction < 8; direction++) {
    if (STEP_X[direction] === dx && STEP_Y[direction] === dy) {
      return direction
    }
  }
  return 4
}

// Ramer-Douglas-Peucker on a closed loop: drops points that sit within
// `tolerance` of a straight line, turning the pixel staircase into clean edges.
function simplifyClosed(points: Pixel[], tolerance: number): Pixel[] {
  // Split the loop at the point farthest from the first one.
  let farthest = 0
  let farthestDistance = -1
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y)
    if (distance > farthestDistance) {
      farthestDistance = distance
      farthest = i
    }
  }
  const firstHalf = simplifyOpen(points.slice(0, farthest + 1), tolerance)
  const secondHalf = simplifyOpen([...points.slice(farthest), points[0]], tolerance)
  // Drop the shared end points so none appear twice.
  return [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)]
}

function simplifyOpen(points: Pixel[], tolerance: number): Pixel[] {
  if (points.length <= 2) {
    return points
  }
  const first = points[0]
  const last = points[points.length - 1]
  let worstIndex = 0
  let worstDistance = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToLine(points[i], first, last)
    if (distance > worstDistance) {
      worstDistance = distance
      worstIndex = i
    }
  }
  if (worstDistance <= tolerance) {
    return [first, last]
  }
  const left = simplifyOpen(points.slice(0, worstIndex + 1), tolerance)
  const right = simplifyOpen(points.slice(worstIndex), tolerance)
  return [...left.slice(0, -1), ...right]
}

function distanceToLine(point: Pixel, a: Pixel, b: Pixel): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }
  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / length
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}
