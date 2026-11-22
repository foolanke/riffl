// Hand tracking (SPEC step 20) with MediaPipe Hand Landmarker.
// Runs once per new camera frame and keeps the latest hand positions.
//
// Offline rule (SPEC 0.2): the model file is in public/models/, and the
// WASM files come from the installed npm package via Vite (?url imports),
// so nothing is fetched from the internet.
import { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

const MODEL_URL = import.meta.env.BASE_URL + 'models/hand_landmarker.task'
const MAX_HANDS = 2

// A point on the camera image: 0..1 from left to right and top to bottom.
// z is MediaPipe's depth relative to the wrist (smaller = closer to the
// camera), on roughly the same scale as x. Only hand points have it.
export interface HandPoint {
  x: number
  y: number
  z?: number
}

// The user's real left or right hand.
export type HandSide = 'left' | 'right'

// One tracking result. Each hand is a list of 21 points (wrist, finger joints, tips).
// sides[i] says which of the user's hands hands[i] is (melody, SPEC 3.3).
export interface HandFrame {
  time: number // performance.now() in ms when the camera captured the frame
  hands: HandPoint[][]
  sides: HandSide[]
  aspect: number // camera image width / height, for measuring real distances
  // The same 21 points per hand in MediaPipe's "world" coordinates: meters,
  // centred on the hand. Depth here is far better than the image z, so
  // finger-to-thumb distances are real 3D distances (used by pinchAccurate).
  world?: HandPoint[][]
}

let landmarker: HandLandmarker | null = null
let trackingStarted = false
let latestFrame: HandFrame = { time: 0, hands: [], sides: [], aspect: 16 / 9 }

// Called on every new tracking result, e.g. live melody (step 26), so the
// engine reacts per camera frame, not per screen redraw.
const frameListeners = new Set<(frame: HandFrame) => void>()

// Frames saved during a take for camera confirmation (step 23).
let recordedFrames: HandFrame[] = []
let isRecordingFrames = false

// Frames per second, counted over the last second.
let framesThisSecond = 0
let secondStartTime = 0
let trackingFps = 0

// Timing readout (designed page, /?pinchdebug): how long the model takes
// per frame, averaged, and which way frames reach us.
let detectMsAverage = 0
let frameSource: 'video' | 'stream' = 'video'

// ---- Fast frames (designed page only, additive) ----
// By default frames come from the <video> element's requestVideoFrameCallback,
// which fires when Chrome is about to SHOW a frame: up to one frame later
// than it arrived from the camera. With fast frames on, frames are read
// straight off the camera track as they arrive (MediaStreamTrackProcessor,
// Chrome only) and tracked at once. Falls back to the video element if the
// browser doesn't support it. The test page never turns this on.
let fastFrames = false

// Call before startHandTracking().
export function setFastFrames(on: boolean): void {
  fastFrames = on
}

// Chrome exposes this on the main thread; TypeScript's DOM types don't have it.
interface TrackProcessorConstructor {
  new (init: { track: MediaStreamTrack; maxBufferSize?: number }): { readable: ReadableStream<VideoFrame> }
}

export async function startHandTracking(video: HTMLVideoElement): Promise<void> {
  if (trackingStarted) {
    return
  }
  trackingStarted = true
  try {
    landmarker = await createLandmarker()
  } catch (error) {
    trackingStarted = false
    throw error
  }
  if (fastFrames && startStreamFrames(video)) {
    return
  }
  video.requestVideoFrameCallback(function (now, metadata) {
    handleVideoFrame(video, now, metadata)
  })
}

// Starts reading frames straight off the camera track. False if this
// browser can't, so the caller uses the video element instead.
function startStreamFrames(video: HTMLVideoElement): boolean {
  const Processor = (window as unknown as { MediaStreamTrackProcessor?: TrackProcessorConstructor })
    .MediaStreamTrackProcessor
  const stream = video.srcObject
  if (Processor === undefined || !(stream instanceof MediaStream)) {
    return false
  }
  const tracks = stream.getVideoTracks()
  if (tracks.length === 0) {
    return false
  }
  // A clone, so reading frames here never affects the picture on screen.
  // maxBufferSize 1: if tracking ever falls behind, old frames are dropped
  // and we always work on the newest one instead of building up a queue.
  const processor = new Processor({ track: tracks[0].clone(), maxBufferSize: 1 })
  const reader = processor.readable.getReader()
  frameSource = 'stream'
  let lastTimestamp = 0

  async function readLoop() {
    for (;;) {
      const { value: frame, done } = await reader.read()
      if (done || !frame) {
        return
      }
      // Arrival time stands in for capture time: it is when the frame
      // reached the page. The camera lag check measures what is left.
      // MediaPipe needs strictly increasing timestamps.
      let arrival = performance.now()
      if (arrival <= lastTimestamp) {
        arrival = lastTimestamp + 0.01
      }
      lastTimestamp = arrival
      try {
        const aspect = frame.displayHeight > 0 ? frame.displayWidth / frame.displayHeight : 16 / 9
        trackFrame(frame, arrival, arrival, aspect)
      } finally {
        frame.close()
      }
    }
  }
  readLoop().catch(function (error) {
    console.warn('Fast camera frames stopped, using the video element.', error)
    frameSource = 'video'
    video.requestVideoFrameCallback(function (now, metadata) {
      handleVideoFrame(video, now, metadata)
    })
  })
  return true
}

export function isHandTrackingRunning(): boolean {
  return landmarker !== null
}

// GPU is much faster; fall back to CPU if this laptop can't do GPU.
async function createLandmarker(): Promise<HandLandmarker> {
  const wasmFiles = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
  try {
    return await HandLandmarker.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: MAX_HANDS,
    })
  } catch (error) {
    console.warn('GPU hand tracking failed, using CPU.', error)
    return await HandLandmarker.createFromOptions(wasmFiles, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: MAX_HANDS,
    })
  }
}

// Called by the browser once for every new camera frame.
function handleVideoFrame(video: HTMLVideoElement, now: number, metadata: VideoFrameCallbackMetadata): void {
  // When the camera took the picture, if the browser knows. This matters
  // for matching hands to mic hits: the frame reaches us tens of ms later.
  const captureTime = metadata.captureTime !== undefined ? metadata.captureTime : now
  const aspect = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 16 / 9
  trackFrame(video, now, captureTime, aspect)
  video.requestVideoFrameCallback(function (nextNow, nextMetadata) {
    handleVideoFrame(video, nextNow, nextMetadata)
  })
}

// Runs the model on one frame and hands the result to everyone listening.
function trackFrame(image: HTMLVideoElement | VideoFrame, now: number, captureTime: number, aspect: number): void {
  if (landmarker) {
    const detectStart = performance.now()
    const result = landmarker.detectForVideo(image, now)
    const detectMs = performance.now() - detectStart
    detectMsAverage = detectMsAverage === 0 ? detectMs : detectMsAverage * 0.9 + detectMs * 0.1
    const hands: HandPoint[][] = []
    for (const handLandmarks of result.landmarks) {
      const points: HandPoint[] = []
      for (const landmark of handLandmarks) {
        points.push({ x: landmark.x, y: landmark.y, z: landmark.z })
      }
      hands.push(points)
    }
    const world: HandPoint[][] = []
    for (const handWorld of result.worldLandmarks) {
      const points: HandPoint[] = []
      for (const landmark of handWorld) {
        points.push({ x: landmark.x, y: landmark.y, z: landmark.z })
      }
      world.push(points)
    }
    const sides = getHandSides(result.handedness, hands)
    latestFrame = { time: captureTime, hands: hands, sides: sides, aspect: aspect, world: world }
    if (isRecordingFrames) {
      recordedFrames.push(latestFrame)
    }
    for (const listener of frameListeners) {
      listener(latestFrame)
    }
    countFrame(now)
  }
}

// MediaPipe's label is used as-is: tested on the demo laptop, its "Left"
// is the user's real left hand, even though we give it the unmirrored image.
// If both hands get the same label (it happens when hands cross or blur),
// fall back to position: the hand further left on the mirrored screen is
// the left hand. On the mirrored screen, left = larger camera x.
function getHandSides(handedness: { categoryName: string }[][], hands: HandPoint[][]): HandSide[] {
  const sides: HandSide[] = []
  for (let i = 0; i < hands.length; i++) {
    const categories = handedness[i]
    const label = categories && categories.length > 0 ? categories[0].categoryName : ''
    sides.push(label === 'Left' ? 'left' : 'right')
  }
  if (hands.length === 2 && sides[0] === sides[1]) {
    const firstIsMoreLeftOnScreen = hands[0][0].x > hands[1][0].x
    sides[0] = firstIsMoreLeftOnScreen ? 'left' : 'right'
    sides[1] = firstIsMoreLeftOnScreen ? 'right' : 'left'
  }
  return sides
}

function countFrame(now: number): void {
  framesThisSecond++
  if (now - secondStartTime >= 1000) {
    trackingFps = framesThisSecond
    framesThisSecond = 0
    secondStartTime = now
  }
}

// ---- Saving frames during a take (step 23) ----

export function startRecordingHands(): void {
  recordedFrames = []
  isRecordingFrames = true
}

export function stopRecordingHands(): HandFrame[] {
  isRecordingFrames = false
  const frames = recordedFrames
  recordedFrames = []
  return frames
}

export function onHandFrame(listener: (frame: HandFrame) => void): () => void {
  frameListeners.add(listener)
  return function unsubscribe() {
    frameListeners.delete(listener)
  }
}

// ---- For the screen ----

export function getLatestHandFrame(): HandFrame {
  return latestFrame
}

export function getTrackingFps(): number {
  return trackingFps
}

// For the designed page's /?pinchdebug readout.
export function getTrackingTimings(): { fps: number; detectMs: number; source: 'video' | 'stream' } {
  return { fps: trackingFps, detectMs: detectMsAverage, source: frameSource }
}
