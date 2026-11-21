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
export interface HandPoint {
  x: number
  y: number
}

// One tracking result. Each hand is a list of 21 points (wrist, finger joints, tips).
export interface HandFrame {
  time: number // performance.now() in ms when the camera captured the frame
  hands: HandPoint[][]
}

let landmarker: HandLandmarker | null = null
let trackingStarted = false
let latestFrame: HandFrame = { time: 0, hands: [] }

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
        points.push({ x: landmark.x, y: landmark.y })
      }
      hands.push(points)
    }
    // When the camera took the picture, if the browser knows. This matters
    // for matching hands to mic hits: the frame reaches us tens of ms later.
    const captureTime = metadata.captureTime !== undefined ? metadata.captureTime : now
    latestFrame = { time: captureTime, hands: hands }
    if (isRecordingFrames) {
      recordedFrames.push(latestFrame)
    }
    countFrame(now)
  }
  video.requestVideoFrameCallback(function (nextNow, nextMetadata) {
    handleVideoFrame(video, nextNow, nextMetadata)
  })
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

// ---- For the screen ----

export function getLatestHandFrame(): HandFrame {
  return latestFrame
}

export function getTrackingFps(): number {
  return trackingFps
}
