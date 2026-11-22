// Where the camera image sits inside the camera panel, and how to map points
// between the two. The image is mirrored (SPEC 3.2) and scaled to cover the
// panel (object-fit: cover), so part of it may be cut off. Hand points and
// object boxes are stored in camera-image coordinates (0-1, not mirrored).
// All panel positions are in layout pixels (clientWidth units), which stay
// right under the page zoom (--ui-scale).
import type { Box } from '../../../project/projectStore.ts'
import { getCameraVideo } from '../../../vision/camera.ts'
import type { HandPoint } from '../../../vision/handTracking.ts'

export interface ImageFit {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface PanelPoint {
  x: number
  y: number
}

export interface PanelRect {
  left: number
  top: number
  width: number
  height: number
}

export function getImageFit(panelWidth: number, panelHeight: number): ImageFit {
  const video = getCameraVideo()
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return { offsetX: 0, offsetY: 0, width: panelWidth, height: panelHeight }
  }
  const scale = Math.max(panelWidth / video.videoWidth, panelHeight / video.videoHeight)
  const width = video.videoWidth * scale
  const height = video.videoHeight * scale
  return { offsetX: (panelWidth - width) / 2, offsetY: (panelHeight - height) / 2, width: width, height: height }
}

// A camera-image point (0-1) on the mirrored, cover-fitted panel.
export function imageToPanel(point: HandPoint, fit: ImageFit): PanelPoint {
  return { x: fit.offsetX + (1 - point.x) * fit.width, y: fit.offsetY + point.y * fit.height }
}

// A panel position back to a camera-image point. Screen left is the image's right.
export function panelToImage(panelX: number, panelY: number, fit: ImageFit): HandPoint {
  return { x: 1 - (panelX - fit.offsetX) / fit.width, y: (panelY - fit.offsetY) / fit.height }
}

// A camera-image box as a rectangle on the mirrored panel.
export function boxToPanel(box: Box, fit: ImageFit): PanelRect {
  return {
    left: fit.offsetX + (1 - box.x - box.width) * fit.width,
    top: fit.offsetY + box.y * fit.height,
    width: box.width * fit.width,
    height: box.height * fit.height,
  }
}
