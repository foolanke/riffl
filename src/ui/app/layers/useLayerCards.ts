// State and actions for the layer cards: recorded layers from the project
// plus draft cards (added with ADD LAYER, not recorded yet), which card is
// active, which one is recording, and which object each drum card plays on.
//
// RECORD on a draft records a new take with its sound (the same take flow as
// the test page, SPEC 1.3, 3.7); the finished take replaces the draft.
// RECORD on a recorded layer retakes it (SPEC 1.6).
// Objects (SPEC 1.2, steps 21-24): one active drum card <-> one object.
import { useState } from 'react'
import { selectInstrument } from '../../../audio/liveMelody.ts'
import { getRecorderState, recordTake, selectObjectForTake, setTakeDrum, setTakeKind } from '../../../audio/recorder.ts'
import {
  addObject,
  deleteLayer,
  deleteObject,
  findObject,
  getProject,
  setLayerDrum,
  setLayerInstrument,
  setLayerObject,
  setObjectDrum,
} from '../../../project/projectStore.ts'
import type { Box } from '../../../project/projectStore.ts'
import { useProject } from '../../hooks.ts'
import { isCalibrating } from '../hooks/engineState.ts'
import { buildLayerItems, findItem, getItemSound } from './layerItems.ts'
import type { DraftLayer, LayerItem, LayerSound } from './layerItems.ts'

export interface LayerCards {
  items: LayerItem[] // oldest first: recorded layers, then drafts
  activeItem: LayerItem | null
  cardOrder: LayerItem[] // the sidebar's order: the active card first (design.md 4.2)
  recordingKey: string | null // the card whose take is in progress
  isExpanded: (item: LayerItem) => boolean // only the active card can be open
  activate: (item: LayerItem) => void // another card: make it active and open; the active one: open/close it
  addLayer: () => void
  record: (item: LayerItem) => Promise<void>
  changeSound: (item: LayerItem, sound: LayerSound) => void
  deleteCard: (item: LayerItem) => void
  getLinkedObjectId: (item: LayerItem) => string | null
  drawObject: (box: Box) => void
  selectObject: (objectId: string | null) => void
  deleteObjectById: (objectId: string) => void
}

export function useLayerCards(): LayerCards {
  const project = useProject()
  const [drafts, setDrafts] = useState<DraftLayer[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // The active card is open unless its header was clicked to close it.
  const [activeCollapsed, setActiveCollapsed] = useState(false)
  const [recordingKey, setRecordingKey] = useState<string | null>(null)
  // Draft card key -> the object its take will be played on (step 24).
  // Recorded drum layers keep theirs in the project (layer.objectId).
  const [draftObjects, setDraftObjects] = useState<Record<string, string>>({})

  const items = buildLayerItems(project.layers, drafts)
  // If the active layer is gone (deleted, undone), fall back to the newest one.
  let activeItem = findItem(items, activeKey)
  if (activeItem === null && items.length > 0) {
    activeItem = items[items.length - 1]
  }

  const cardOrder: LayerItem[] = []
  if (activeItem) {
    cardOrder.push(activeItem)
  }
  for (const item of items) {
    if (activeItem === null || item.key !== activeItem.key) {
      cardOrder.push(item)
    }
  }

  function isExpanded(item: LayerItem): boolean {
    return activeItem !== null && item.key === activeItem.key && !activeCollapsed
  }

  function activate(item: LayerItem) {
    if (activeItem !== null && item.key === activeItem.key) {
      setActiveCollapsed(!activeCollapsed)
      return
    }
    setActiveKey(item.key)
    setActiveCollapsed(false)
  }

  function getLinkedObjectId(item: LayerItem): string | null {
    return findLinkedObjectId(item, draftObjects)
  }

  function addLayer() {
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
    setActiveCollapsed(false)
  }

  async function record(item: LayerItem) {
    if (getRecorderState().status !== 'idle' || isCalibrating()) {
      return
    }
    setActiveKey(item.key)
    setActiveCollapsed(false) // show the card whose take is running
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
      const objectId = getLinkedObjectId(item)
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

  function changeSound(item: LayerItem, sound: LayerSound) {
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
    const objectId = getLinkedObjectId(item)
    if (objectId !== null && sound.kind === 'drum') {
      setObjectDrum(objectId, sound.drum)
    }
  }

  // Delete a card (SPEC 1.6): a recorded layer leaves the project, a draft
  // just leaves the page. Never during a take.
  function deleteCard(item: LayerItem) {
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

  // A box drawn on the camera becomes an object with the active drum card's drum.
  function drawObject(box: Box) {
    const sound = activeItem ? getItemSound(activeItem) : null
    if (!activeItem || !sound || sound.kind !== 'drum') {
      return
    }
    const id = crypto.randomUUID()
    addObject({ id: id, drum: sound.drum, box: box })
    linkObject(activeItem, id)
  }

  function selectObject(objectId: string | null) {
    if (activeItem) {
      linkObject(activeItem, objectId)
    }
  }

  // Cards linked to a deleted object fall back to mic only (findObject finds nothing).
  function deleteObjectById(objectId: string) {
    if (getRecorderState().takeObjectId === objectId) {
      selectObjectForTake(null)
    }
    deleteObject(objectId)
  }

  return {
    items: items,
    activeItem: activeItem,
    cardOrder: cardOrder,
    recordingKey: recordingKey,
    isExpanded: isExpanded,
    activate: activate,
    addLayer: addLayer,
    record: record,
    changeSound: changeSound,
    deleteCard: deleteCard,
    getLinkedObjectId: getLinkedObjectId,
    drawObject: drawObject,
    selectObject: selectObject,
    deleteObjectById: deleteObjectById,
  }
}

// The object a drum card's take is played on, or null (mic only).
function findLinkedObjectId(item: LayerItem, draftObjects: Record<string, string>): string | null {
  let objectId: string | undefined = undefined
  if (item.draft) {
    objectId = draftObjects[item.draft.key]
  } else if (item.layer && item.layer.type === 'drum') {
    objectId = item.layer.objectId
  }
  const object = findObject(objectId)
  return object ? object.id : null
}
