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
  video.requestVideoFrameCallback(function (now, metadata) {
    handleVideoFrame(video, now, metadata)
  })
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
  if (landmarker) {
    const result = landmarker.detectForVideo(video, now)
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
    // When the camera took the picture, if the browser knows. This matters
    // for matching hands to mic hits: the frame reaches us tens of ms later.
    const captureTime = metadata.captureTime !== undefined ? metadata.captureTime : now
    const aspect = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 16 / 9
    latestFrame = { time: captureTime, hands: hands, sides: sides, aspect: aspect, world: world }
    if (isRecordingFrames) {
      recordedFrames.push(latestFrame)
    }
    for (const listener of frameListeners) {
      listener(latestFrame)
    }
    countFrame(now)
  }
  video.requestVideoFrameCallback(function (nextNow, nextMetadata) {
    handleVideoFrame(video, nextNow, nextMetadata)
  })
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
