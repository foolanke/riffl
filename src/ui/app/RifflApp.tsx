// The designed riffl page (docs/design.md, Figma states 0-1).
// Layout: camera + layers panel on the left, sidebar on the right.
//
// Layers: ADD LAYER makes a draft card (01, 02 ...) with a sound picker
// (drums and melody instruments). RECORD on a draft records a new take with
// that sound (the same take flow as the test page, SPEC 1.3, 3.7); the
// finished take replaces the draft. RECORD on a recorded layer retakes it (SPEC 1.6).
//
// Melody: pinches play live notes (SPEC 3.6) only while the active card is a
// melody layer, so hands near drum objects never set off notes.
//
// The old step-by-step test page stays at /test.html, unchanged.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { selectInstrument, setLiveMelodyOn } from '../../audio/liveMelody.ts'
import {
  getRecorderState,
  recordTake,
  selectObjectForTake,
  setTakeDrum,
  setTakeKind,
  subscribeToRecorder,
} from '../../audio/recorder.ts'
import {
  addObject,
  deleteObject,
  deleteLayer,
  findObject,
  getProject,
  setLayerDrum,
  setLayerObject,
  setObjectDrum,
  setLayerInstrument,
  toggleLayerMutedByIndex,
  undoLastTake,
  updateSettings,
} from '../../project/projectStore.ts'
import type { Box } from '../../project/projectStore.ts'
import { downloadProjectFile } from '../../project/saveLoad.ts'
import { useProject } from '../hooks.ts'
import { getCameraLagCheckState, subscribeToCameraLagCheck } from '../../audio/cameraLagCheck.ts'
import { getLagCheckState, subscribeToLagCheck } from '../../audio/lagCheck.ts'
import { BrandBadge } from './BrandBadge.tsx'
import { CalibrationSection, getCalibrationHint } from './CalibrationSection.tsx'
import { CameraConfirmToggle } from './CameraConfirmToggle.tsx'
import { CameraView } from './CameraView.tsx'
import { ICONS } from './icons.ts'
import { LayerCard } from './LayerCard.tsx'
import { LayersPanel } from './LayersPanel.tsx'
import { buildLayerItems, findItem, getItemSound, isMelodyItem } from './layerItems.ts'
import type { DraftLayer, LayerItem, LayerSound } from './layerItems.ts'
import { MetronomeStrip } from './MetronomeStrip.tsx'
import { ObjectMarkers } from './ObjectMarkers.tsx'
import { SettingsSection } from './SettingsSection.tsx'
import { StartOverlay } from './StartOverlay.tsx'

const SETUP_HINT = 'Point the camera at an object, then press record'
const MELODY_HINT = 'Pinch your thumb to a finger to play'
const NO_TRACKING_HINT = 'Hand tracking unavailable. Melody needs the camera.'

export function RifflApp() {
  const [started, setStarted] = useState(false)
  const [cameraOk, setCameraOk] = useState(true)
  const [trackingOk, setTrackingOk] = useState(true)
  const [drafts, setDrafts] = useState<DraftLayer[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [recordingKey, setRecordingKey] = useState<string | null>(null)
  // Draft card key -> the object its take will be played on (step 24).
  // Recorded drum layers keep theirs in the project (layer.objectId).
  const [draftObjects, setDraftObjects] = useState<Record<string, string>>({})
  const project = useProject()
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const micCheck = useSyncExternalStore(subscribeToLagCheck, getLagCheckState)
  const cameraCheck = useSyncExternalStore(subscribeToCameraLagCheck, getCameraLagCheckState)

  const items = buildLayerItems(project.layers, drafts)
  // If the active layer is gone (deleted, undone), fall back to the newest one.
  let activeItem = findItem(items, activeKey)
  if (activeItem === null && items.length > 0) {
    activeItem = items[items.length - 1]
  }

  // Live notes follow the active card: on for a melody layer (with its
  // instrument, for free play), off otherwise.
  const activeSound = activeItem ? getItemSound(activeItem) : null
  const activeInstrument = activeSound && activeSound.kind === 'melody' ? activeSound.instrument : null
  useEffect(
    function () {
      if (activeInstrument !== null) {
        selectInstrument(activeInstrument)
        setLiveMelodyOn(true)
      } else {
        setLiveMelodyOn(false)
      }
    },
    [activeInstrument, started],
  )

  function handleAddLayer() {
    // A new layer starts on the sound picked last, or kick.
    let sound: LayerSound = { kind: 'drum', drum: 'kick' }
    if (activeItem) {
      const itemSound = getItemSound(activeItem)
      if (itemSound) {
        sound = itemSound
      }
    }
    const draft: DraftLayer = { key: crypto.randomUUID(), sound: sound }
    setDrafts([...drafts, draft])
    setActiveKey(draft.key)
  }

  async function handleRecord(item: LayerItem) {
    if (getRecorderState().status !== 'idle' || isCalibrating()) {
      return
    }
    setActiveKey(item.key)
    setRecordingKey(item.key)

    if (item.layer) {
      await recordTake(item.layer.id) // retake (drum or melody)
      setRecordingKey(null)
      return
    }
    if (!item.draft) {
      setRecordingKey(null)
      return
    }

    // New take. Remember which layers existed, so the new one can be found.
    const draftKey = item.draft.key
    const sound = item.draft.sound
    const idsBefore = new Set<string>()
    for (const layer of getProject().layers) {
      idsBefore.add(layer.id)
    }
    if (sound.kind === 'drum') {
      setTakeKind('drum')
      const objectId = getLinkedObjectId(item, draftObjects)
      if (objectId !== null) {
        selectObjectForTake(objectId) // the take uses this object's box (camera confirmation) and drum
      } else {
        setTakeDrum(sound.drum) // no object: mic only
      }
    } else {
      selectInstrument(sound.instrument) // a new melody take uses the selected instrument
      setTakeKind('melody')
    }
    await recordTake()
    setRecordingKey(null)

    // The take found hits (or notes): the new layer replaces the draft. If it
    // found none, no layer was made and the draft stays for another try.
    for (const layer of getProject().layers) {
      if (!idsBefore.has(layer.id)) {
        setDrafts(function (current) {
          return current.filter((draft) => draft.key !== draftKey)
        })
        setActiveKey(layer.id)
        return
      }
    }
  }

  function handleSoundChange(item: LayerItem, sound: LayerSound) {
    if (item.draft) {
      const draftKey = item.draft.key
      setDrafts(
        drafts.map(function (draft) {
          return draft.key === draftKey ? { key: draftKey, sound: sound } : draft
        }),
      )
    } else if (item.layer && item.layer.type === 'drum' && sound.kind === 'drum') {
      setLayerDrum(item.layer.id, sound.drum)
    } else if (item.layer && item.layer.type === 'melody' && sound.kind === 'melody') {
      setLayerInstrument(item.layer.id, sound.instrument)
    }
    // A card and its object always play the same drum.
    const objectId = getLinkedObjectId(item, draftObjects)
    if (objectId !== null && sound.kind === 'drum') {
      setObjectDrum(objectId, sound.drum)
    }
  }

  // ---- Objects (SPEC 1.2, steps 21-24): one active drum card <-> one object ----

  // Link an object (or none = mic only) to a drum card. Picking an object
  // sets the card's drum to the object's drum (step 24).
  function linkObject(item: LayerItem, objectId: string | null) {
    const object = findObject(objectId)
    if (item.draft) {
      const draftKey = item.draft.key
      if (object) {
        const objectDrum = object.drum
        setDrafts(function (current) {
          return current.map(function (draft) {
            return draft.key === draftKey ? { key: draftKey, sound: { kind: 'drum', drum: objectDrum } } : draft
          })
        })
      }
      setDraftObjects(function (current) {
        const updated = { ...current }
        if (object) {
          updated[draftKey] = object.id
        } else {
          delete updated[draftKey]
        }
        return updated
      })
      selectObjectForTake(object ? object.id : null)
    } else if (item.layer && item.layer.type === 'drum') {
      setLayerObject(item.layer.id, object ? object.id : null)
      if (object && object.drum !== item.layer.drum) {
        setLayerDrum(item.layer.id, object.drum)
      }
    }
  }

  function handleObjectDrawn(box: Box) {
    const sound = activeItem ? getItemSound(activeItem) : null
    if (!activeItem || !sound || sound.kind !== 'drum') {
      return
    }
    const id = crypto.randomUUID()
    addObject({ id: id, drum: sound.drum, box: box })
    linkObject(activeItem, id)
  }

  function handleObjectSelected(objectId: string | null) {
    if (activeItem) {
      linkObject(activeItem, objectId)
    }
  }

  // Cards linked to a deleted object fall back to mic only (findObject finds nothing).
  function handleObjectDeleted(objectId: string) {
    if (getRecorderState().takeObjectId === objectId) {
      selectObjectForTake(null)
    }
    deleteObject(objectId)
  }

  // Delete a card (SPEC 1.6): a recorded layer leaves the project, a draft
  // just leaves the page. Never during a take.
  function handleDelete(item: LayerItem) {
    if (getRecorderState().status !== 'idle') {
      return
    }
    if (item.layer) {
      deleteLayer(item.layer.id)
    } else if (item.draft) {
      const draftKey = item.draft.key
      setDrafts(drafts.filter((draft) => draft.key !== draftKey))
    }
  }

  // Keyboard shortcuts (SPEC 0.6): Space records the active layer, Z undo,
  // 1-9 mute, M metronome. The handler reads the latest values from a ref,
  // so it is set up once.
  const recordActiveRef = useRef<() => void>(() => {})
  recordActiveRef.current = function () {
    if (activeItem) {
      handleRecord(activeItem)
    }
  }

  useEffect(
    function () {
      if (!started) {
        return
      }
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === ' ') {
          // Stop Space from scrolling or pressing whatever has focus.
          event.preventDefault()
          if (!event.repeat) {
            recordActiveRef.current()
          }
          return
        }
        if (event.repeat) {
          return
        }
        if (event.key === 'm' || event.key === 'M') {
          updateSettings({ metronomeOn: !getProject().settings.metronomeOn })
        }
        if (/^[1-9]$/.test(event.key)) {
          toggleLayerMutedByIndex(Number(event.key) - 1)
        }
        // Undo only between takes, never while one is being recorded.
        if ((event.key === 'z' || event.key === 'Z') && getRecorderState().status === 'idle') {
          undoLastTake()
        }
      }
      // Buttons fire on Space key-up, so block that too.
      function handleKeyUp(event: KeyboardEvent) {
        if (event.key === ' ') {
          event.preventDefault()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      return function () {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    },
    [started],
  )

  if (!started) {
    return (
      <StartOverlay
        onStarted={function (cameraWorks, trackingWorks) {
          setCameraOk(cameraWorks)
          setTrackingOk(trackingWorks)
          setStarted(true)
        }}
      />
    )
  }

  const hudLabel = activeItem ? `Layer ${activeItem.number} / ${activeItem.soundLabel}` : 'Setup / Camera'
  // A running calibration takes over the hint pill.
  const calibrationHint = getCalibrationHint(micCheck.status, cameraCheck.status)
  const melodyActive = isMelodyItem(activeItem)
  let hintText = getHintText(recorder.status, project.layers.length > 0, melodyActive, trackingOk)
  if (calibrationHint !== null) {
    hintText = calibrationHint
  }

  // The active card comes first and is expanded (design.md 4.2).
  const cardOrder: LayerItem[] = []
  if (activeItem) {
    cardOrder.push(activeItem)
  }
  for (const item of items) {
    if (activeItem === null || item.key !== activeItem.key) {
      cardOrder.push(item)
    }
  }

  return (
    <div className="page">
      <div className="main">
        <CameraView
          hudLabel={hudLabel}
          hintText={hintText}
          cameraOk={cameraOk}
          melodyActive={melodyActive}
          objectMarkers={
            // Object boxes only for a drum card (none on a melody card, design.md 4.3).
            activeItem !== null && !melodyActive && cameraOk ? (
              <ObjectMarkers
                linkedObjectId={getLinkedObjectId(activeItem, draftObjects)}
                editable={recorder.status === 'idle'}
                onDraw={handleObjectDrawn}
                onSelect={handleObjectSelected}
                onDelete={handleObjectDeleted}
              />
            ) : null
          }
        />
        <LayersPanel items={items} onAddLayer={handleAddLayer} />
      </div>

      <aside className="sidebar">
        <BrandBadge />
        <MetronomeStrip />

        {cardOrder.length > 0 ? (
          <div className="section">
            <div className="section-title text-label">Layers</div>
            {cardOrder.map((item) => {
              const isActive = activeItem !== null && item.key === activeItem.key
              return (
                <LayerCard
                  key={item.key}
                  item={item}
                  expanded={isActive}
                  recorderStatus={recorder.status}
                  isRecordingThis={recordingKey === item.key}
                  message={isActive ? recorder.message : ''}
                  onActivate={() => setActiveKey(item.key)}
                  onRecord={() => handleRecord(item)}
                  onSoundChange={(sound) => handleSoundChange(item, sound)}
                  onDelete={() => handleDelete(item)}
                />
              )
            })}
          </div>
        ) : null}

        <div className="sidebar-spacer" />

        <SettingsSection />

        <CameraConfirmToggle />
        <CalibrationSection cameraOk={cameraOk} />

        <div className="sidebar-footer">
          <button
            className="button-filled button-download text-item"
            type="button"
            disabled={project.layers.length === 0}
            onClick={(event) => {
              downloadProjectFile()
              event.currentTarget.blur()
            }}
          >
            <img src={project.layers.length === 0 ? ICONS.downloadDisabled : ICONS.download} alt="" />
            Download
          </button>
          <a className="test-page-link text-label" href="/test.html">
            Test page
          </a>
        </div>
      </aside>
    </div>
  )
}

// The object a drum card's take is played on, or null (mic only).
function getLinkedObjectId(item: LayerItem, draftObjects: Record<string, string>): string | null {
  let objectId: string | undefined = undefined
  if (item.draft) {
    objectId = draftObjects[item.draft.key]
  } else if (item.layer && item.layer.type === 'drum') {
    objectId = item.layer.objectId
  }
  const object = findObject(objectId)
  return object ? object.id : null
}

// A take and a lag check both use the clock and mic, so never run both at once.
function isCalibrating(): boolean {
  return getLagCheckState().status !== 'idle' || getCameraLagCheckState().status !== 'idle'
}

// The hint pill at the bottom of the camera: take progress while recording,
// the pinch hint on a melody card, otherwise the setup hint until the first
// layer exists.
function getHintText(status: string, hasLayers: boolean, melodyActive: boolean, trackingOk: boolean): string | null {
  if (status === 'countIn') {
    return 'Count-in. Get ready.'
  }
  if (status === 'recording') {
    return 'Recording. Play now.'
  }
  if (status === 'processing') {
    return melodyActive ? 'Snapping notes...' : 'Finding hits...'
  }
  if (melodyActive) {
    return trackingOk ? MELODY_HINT : NO_TRACKING_HINT
  }
  return hasLayers ? null : SETUP_HINT
}
