// Object markers on the camera (SPEC 1.2, steps 21-24, design.md 5.17, 5.18)
// while a drum card is active. Drag on the camera to draw a box around an
// object; click a box to use it for the active card; × in a tag deletes it.
//
// Boxes are stored in camera-image coordinates (0-1, not mirrored). The image
// is mirrored and cover-fitted (cropped), so every frame the markers are
// placed with the same image fit the melody guide uses, and the "hand inside"
// highlight (step 22) and tap ripples read the engine directly. React only
// re-renders when the objects themselves change (SPEC 0.1).
//
// Once the camera runs, each object's silhouette is traced (vision/silhouette.ts)
// and drawn instead of the corner brackets: a white outline with a
// translucent, diagonally hatched fill. Until then (or if tracing finds
// nothing), the corner brackets of design.md 5.17 are shown.
//
// Auto-detected suggestions (vision/objectDetection.ts, a setting, default
// on; not in SPEC or the design): dashed boxes tagged e.g. "CUP · ADD".
// Clicking one adds it as an object, the same as drawing that box.
// Clicking anything else on the camera cuts out the object under the click
// (silhouette.ts findObjectBoxAt, any kind of object) and adds it; a click
// on bare table finds nothing and means "no object" (mic only), as before.
import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { getDrumLabel } from '../../../audio/drums.ts'
import { onLiveHit } from '../../../audio/mic.ts'
import { getProject, moveObjectBox, setObjectOutline } from '../../../project/projectStore.ts'
import type { Box, OutlinePoint, TrackedObject } from '../../../project/projectStore.ts'
import { getCameraVideo } from '../../../vision/camera.ts'
import { getLatestHandFrame } from '../../../vision/handTracking.ts'
import type { HandPoint } from '../../../vision/handTracking.ts'
import { updateObjectSuggestions } from '../../../vision/objectDetection.ts'
import type { ObjectSuggestion } from '../../../vision/objectDetection.ts'
import { MIN_BOX_SIZE, findObjectAtPoint, isPointInBox, makeBoxFromCorners } from '../../../vision/objects.ts'
import { findObjectBoxAt, traceSilhouette } from '../../../vision/silhouette.ts'
import { useProject } from '../../hooks.ts'
import { ICONS } from '../icons.ts'
import { boxToPanel, getImageFit, imageToPanel, panelToImage } from './imageFit.ts'
import type { ImageFit, PanelRect } from './imageFit.ts'

// The tag sits 32px above the box (design.md 5.17). Closer to the top of the
// camera than that, it would be cut off, so it moves below the box instead.
const TAG_OFFSET = 32

interface ObjectMarkersProps {
  linkedObjectId: string | null // the object the active card's next take uses
  editable: boolean // false while a take runs: no drawing, selecting or deleting
  onDraw: (box: Box) => void
  onSelect: (objectId: string | null) => void // null = clicked empty camera: mic only
  onDelete: (objectId: string) => void
}

export function ObjectMarkers(props: ObjectMarkersProps) {
  const objects = useProject().objects
  const layerRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<HTMLDivElement>(null)
  // The drag in progress, in camera-image coordinates. A ref, so moving the
  // mouse doesn't re-render.
  const dragRef = useRef<{ start: HandPoint; current: HandPoint } | null>(null)
  const suggestionLayerRef = useRef<HTMLDivElement>(null)
  // The suggestions on screen right now, for clicks.
  const suggestionsRef = useRef<ObjectSuggestion[]>([])
  // Read by the frame loop: no suggestions (and no detector work) during a take.
  const editableRef = useRef(props.editable)
  editableRef.current = props.editable
  // Latest props, for the click-to-add answer that arrives a moment later.
  const propsRef = useRef(props)
  propsRef.current = props
  // A click-to-add is being worked out (one at a time).
  const findingRef = useRef(false)
  // The detector saw an added object move or disappear: its box follows,
  // or it's deleted like the × in its tag (which also unlinks cards).
  const objectChanges = {
    move: function (objectId: string, box: Box) {
      outlineAttempts.delete(objectId) // trace the outline again at the new spot
      moveObjectBox(objectId, box)
    },
    remove: function (objectId: string) {
      propsRef.current.onDelete(objectId)
    },
  }

  // Every screen frame: place markers (the fit changes on resize or when the
  // camera starts), light the ones with a hand inside, draw the drag preview.
  useEffect(function () {
    let frameId = 0
    function draw() {
      const layer = layerRef.current
      if (layer) {
        updateMarkers(layer)
        updateDraft(layer, draftRef.current, dragRef.current)
        const suggestions = editableRef.current ? updateObjectSuggestions(getProject().objects, objectChanges) : []
        suggestionsRef.current = suggestions
        updateSuggestions(layer, suggestionLayerRef.current, suggestions)
      }
      traceMissingOutlines()
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  // A tap ripple (design.md 5.18) on the hand, for each mic hit with a hand in a box.
  useEffect(function () {
    return onLiveHit(function () {
      const layer = layerRef.current
      if (layer) {
        addRipplesForHit(layer)
      }
    })
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!props.editable || event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toImagePoint(event)
    dragRef.current = { start: point, current: point }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      dragRef.current.current = toImagePoint(event)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !props.editable) {
      return
    }
    const box = makeBoxFromCorners(drag.start, toImagePoint(event))
    if (box.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE) {
      props.onDraw(box)
    } else {
      // A click: use the box under the mouse; else add the suggestion under
      // it (smallest first, so a cup in front of a laptop is reachable); else none.
      const clicked = findObjectAtPoint(getProject().objects, drag.start)
      const suggestion = clicked ? null : findSuggestionAtPoint(suggestionsRef.current, drag.start)
      if (suggestion) {
        props.onDraw(suggestion.box)
      } else if (clicked) {
        props.onSelect(clicked.id)
      } else {
        addObjectAtClick(event.currentTarget, drag.start)
      }
    }
  }

  // Cut out the object under the click and add it, or select none (mic only)
  // if the click was on bare table.
  function addObjectAtClick(layer: HTMLDivElement, point: HandPoint) {
    const video = getCameraVideo()
    if (video === null || findingRef.current) {
      return
    }
    findingRef.current = true
    layer.classList.add('is-finding')
    findObjectBoxAt(video, point)
      .catch(function (error) {
        console.warn('Click to add object failed', error)
        return null
      })
      .then(function (box) {
        findingRef.current = false
        layer.classList.remove('is-finding')
        const latest = propsRef.current
        if (!latest.editable) {
          return // a take started meanwhile
        }
        if (box && box.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE) {
          latest.onDraw(box)
        } else {
          latest.onSelect(null)
        }
      })
  }

  let layerClass = 'object-layer'
  if (props.editable) {
    layerClass += ' is-editable'
  }

  return (
    <div
      className={layerClass}
      ref={layerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null
      }}
    >
      <div className="object-suggestions" ref={suggestionLayerRef} />
      {objects.map((object) => (
        <ObjectMarker
          key={object.id}
          object={object}
          linked={object.id === props.linkedObjectId}
          editable={props.editable}
          onDelete={() => props.onDelete(object.id)}
        />
      ))}
      <div className="object-draft" ref={draftRef} />
    </div>
  )
}

function ObjectMarker(props: { object: TrackedObject; linked: boolean; editable: boolean; onDelete: () => void }) {
  const outline = props.object.outline
  let className = 'object-marker'
  if (props.linked) {
    className += ' is-linked'
  }
  if (outline) {
    className += ' has-silhouette'
  }
  return (
    // Placed by the frame loop (left/top/width/height), found by data-id.
    <div className={className} data-id={props.object.id}>
      {outline ? (
        <Silhouette objectId={props.object.id} box={props.object.box} outline={outline} />
      ) : (
        <>
          <img className="object-corner is-tl" src={ICONS.cornerTl} alt="" />
          <img className="object-corner is-tr" src={ICONS.cornerTr} alt="" />
          <img className="object-corner is-bl" src={ICONS.cornerBl} alt="" />
          <img className="object-corner is-br" src={ICONS.cornerBr} alt="" />
        </>
      )}
      <div className="object-tag text-label">
        <span>Object · {getDrumLabel(props.object.drum)}</span>
        {props.editable ? (
          <button
            className="object-tag-delete text-label"
            type="button"
            aria-label="Delete object"
            title="Delete object"
            // Not the start of a drag on the camera underneath.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.currentTarget.blur() // so Space records instead of pressing this
              props.onDelete()
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}

// The object's outline inside its marker. Points are given as fractions of
// the marker box (0..1, mirrored like the camera image), so the shape follows
// the marker wherever the frame loop places it. The fill is a CSS hatch on a
// div clipped to the same shape, so the hatch lines keep a fixed pixel
// spacing; the stroke keeps a fixed width (non-scaling-stroke).
function Silhouette(props: { objectId: string; box: Box; outline: OutlinePoint[] }) {
  const clipId = 'object-clip-' + props.objectId
  const points = outlineToBoxFractions(props.outline, props.box)
  return (
    <>
      <div className="object-silhouette-fill" style={{ clipPath: 'url(#' + clipId + ')' }} />
      <svg className="object-silhouette" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <polygon points={points} />
          </clipPath>
        </defs>
        <polygon className="object-silhouette-line" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  )
}

// "u,v u,v ..." with u, v as fractions of the box on screen. Screen left is
// the image's right (the camera is mirrored), so u counts from the box's right edge.
function outlineToBoxFractions(outline: OutlinePoint[], box: Box): string {
  const parts: string[] = []
  for (const point of outline) {
    const u = (box.x + box.width - point.x) / box.width
    const v = (point.y - box.y) / box.height
    parts.push(u.toFixed(4) + ',' + v.toFixed(4))
  }
  return parts.join(' ')
}

// ---- Silhouette tracing ----
// Each object is traced once per page visit, as soon as the camera shows a
// picture. Objects already traced (saved outline) are skipped.
const outlineAttempts = new Set<string>()

function traceMissingOutlines() {
  const video = getCameraVideo()
  if (!video || video.videoWidth === 0 || video.readyState < 2) {
    return
  }
  for (const object of getProject().objects) {
    if (object.outline || outlineAttempts.has(object.id)) {
      continue
    }
    outlineAttempts.add(object.id)
    traceSilhouette(video, object.box)
      .then(function (outline) {
        // The object may have been deleted, or moved, while tracing.
        const now = findById(getProject().objects, object.id)
        if (outline && now && now.box === object.box) {
          setObjectOutline(object.id, outline)
        }
      })
      .catch(function (error) {
        console.warn('Could not trace object silhouette', error)
      })
  }
}

// ---- Coordinates ----
// Positions inside the layer are in layout pixels (clientWidth units), which
// stay right under the page zoom (--ui-scale). Mouse positions are turned into
// a fraction of the layer's on-screen rect first, so the zoom cancels out.

function getLayerFit(layer: HTMLElement): ImageFit {
  return getImageFit(layer.clientWidth, layer.clientHeight)
}

function toImagePoint(event: PointerEvent<HTMLDivElement>): HandPoint {
  const layer = event.currentTarget
  const rect = layer.getBoundingClientRect()
  const layoutX = ((event.clientX - rect.left) / rect.width) * layer.clientWidth
  const layoutY = ((event.clientY - rect.top) / rect.height) * layer.clientHeight
  const fit = getLayerFit(layer)
  return panelToImage(layoutX, layoutY, fit)
}

function placeElement(element: HTMLElement, rect: PanelRect) {
  element.style.left = rect.left + 'px'
  element.style.top = rect.top + 'px'
  element.style.width = rect.width + 'px'
  element.style.height = rect.height + 'px'
}

// ---- Per-frame DOM updates ----

function updateMarkers(layer: HTMLDivElement) {
  const fit = getLayerFit(layer)
  const frame = getLatestHandFrame()
  const objects = getProject().objects
  const markers = layer.querySelectorAll<HTMLElement>('.object-marker')
  for (const marker of markers) {
    const object = findById(objects, marker.dataset.id || '')
    if (object === null) {
      continue
    }
    const rect = boxToPanel(object.box, fit)
    placeElement(marker, rect)
    marker.classList.toggle('is-tag-below', rect.top < TAG_OFFSET)
    marker.classList.toggle('is-hand-inside', getHandPointsInBox(frame.hands, object.box).length > 0)
  }
}

// Suggestion boxes, kept in sync by id (plain DOM, no React re-render).
function updateSuggestions(layer: HTMLDivElement, container: HTMLDivElement | null, suggestions: ObjectSuggestion[]) {
  if (container === null) {
    return
  }
  const fit = getLayerFit(layer)
  const wanted = new Set<string>()
  for (const suggestion of suggestions) {
    const id = String(suggestion.id)
    wanted.add(id)
    let element = container.querySelector<HTMLElement>('[data-id="' + id + '"]')
    if (element === null) {
      element = document.createElement('div')
      element.className = 'object-suggestion'
      element.dataset.id = id
      const tag = document.createElement('div')
      tag.className = 'object-suggestion-tag text-label'
      element.appendChild(tag)
      container.appendChild(element)
    }
    const tag = element.firstElementChild as HTMLElement
    const text = (suggestion.label !== '' ? suggestion.label : 'Object') + ' · Add'
    if (tag.textContent !== text) {
      tag.textContent = text
    }
    const rect = boxToPanel(suggestion.box, fit)
    placeElement(element, rect)
    element.classList.toggle('is-tag-below', rect.top < TAG_OFFSET)
  }
  for (const element of Array.from(container.children) as HTMLElement[]) {
    if (!wanted.has(element.dataset.id || '')) {
      element.remove()
    }
  }
}

function findSuggestionAtPoint(suggestions: ObjectSuggestion[], point: HandPoint): ObjectSuggestion | null {
  let found: ObjectSuggestion | null = null
  for (const suggestion of suggestions) {
    const area = suggestion.box.width * suggestion.box.height
    if (isPointInBox(point, suggestion.box) && (found === null || area < found.box.width * found.box.height)) {
      found = suggestion
    }
  }
  return found
}

function updateDraft(layer: HTMLDivElement, draft: HTMLDivElement | null, drag: { start: HandPoint; current: HandPoint } | null) {
  if (draft === null) {
    return
  }
  if (drag === null) {
    draft.style.display = 'none'
    return
  }
  // Same clipping as the box that will be saved.
  const box = makeBoxFromCorners(drag.start, drag.current)
  placeElement(draft, boxToPanel(box, getLayerFit(layer)))
  draft.style.display = 'block'
}

// One ripple per box with a hand inside, centred on the hand points in it.
function addRipplesForHit(layer: HTMLDivElement) {
  const fit = getLayerFit(layer)
  const hands = getLatestHandFrame().hands
  for (const object of getProject().objects) {
    const inside = getHandPointsInBox(hands, object.box)
    if (inside.length === 0) {
      continue
    }
    let sumX = 0
    let sumY = 0
    for (const point of inside) {
      sumX += point.x
      sumY += point.y
    }
    const center = imageToPanel({ x: sumX / inside.length, y: sumY / inside.length }, fit)

    const ripple = document.createElement('img')
    ripple.src = ICONS.tapRipple
    ripple.alt = ''
    ripple.className = 'tap-ripple object-ripple'
    ripple.style.left = center.x + 'px'
    ripple.style.top = center.y + 'px'
    ripple.addEventListener('animationend', function () {
      ripple.remove()
    })
    layer.appendChild(ripple)
  }
}

function getHandPointsInBox(hands: HandPoint[][], box: Box): HandPoint[] {
  const inside: HandPoint[] = []
  for (const hand of hands) {
    for (const point of hand) {
      if (isPointInBox(point, box)) {
        inside.push(point)
      }
    }
  }
  return inside
}

function findById(objects: TrackedObject[], id: string): TrackedObject | null {
  for (const object of objects) {
    if (object.id === id) {
      return object
    }
  }
  return null
}
