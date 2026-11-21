// Webcam (SPEC step 19). Owns one <video> element that both the screen
// and hand tracking use, so the camera is only opened once.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").

let video: HTMLVideoElement | null = null
let cameraStarting: Promise<HTMLVideoElement> | null = null

// Asks for camera permission and starts the feed. Safe to call many times.
export function startCamera(): Promise<HTMLVideoElement> {
  if (!cameraStarting) {
    cameraStarting = openCamera()
    // If it failed (e.g. permission denied), allow trying again.
    cameraStarting.catch(function () {
      cameraStarting = null
    })
  }
  return cameraStarting
}

async function openCamera(): Promise<HTMLVideoElement> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      // Higher frame rate = smoother feed and more hand samples per hit.
      frameRate: { ideal: 60 },
    },
  })

  const element = document.createElement('video')
  element.srcObject = stream
  element.muted = true
  element.playsInline = true
  await element.play()

  video = element
  return element
}

export function getCameraVideo(): HTMLVideoElement | null {
  return video
}
