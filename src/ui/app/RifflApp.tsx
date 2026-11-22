// The designed riffl page (docs/design.md). Opens on the START overlay;
// after that: camera + layers panel on the left, sidebar on the right.
// This file only wires the parts together:
// - layers/useLayerCards.ts: layer cards, takes, objects
// - camera/: camera feed and everything drawn over it
// - layers/LayersPanel.tsx: the bottom panel
// - sidebar/Sidebar.tsx: the sidebar
//
// The old step-by-step test page stays at /test.html, unchanged.
import { useState } from 'react'
import { CameraView } from './camera/CameraView.tsx'
import { getHintText } from './camera/hintText.ts'
import { ObjectMarkers } from './camera/ObjectMarkers.tsx'
import { useCameraLagCheck, useMicLagCheck, useRecorder } from './hooks/engineState.ts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.ts'
import { useLiveNotesForCard } from './hooks/useLiveNotesForCard.ts'
import { getItemSound, isMelodyItem } from './layers/layerItems.ts'
import { LayersPanel } from './layers/LayersPanel.tsx'
import { useLayerCards } from './layers/useLayerCards.ts'
import { Sidebar } from './sidebar/Sidebar.tsx'
import { StartOverlay } from './StartOverlay.tsx'

export function RifflApp() {
  const [started, setStarted] = useState(false)
  const [cameraOk, setCameraOk] = useState(true)
  const [trackingOk, setTrackingOk] = useState(true)
  const cards = useLayerCards()
  const recorder = useRecorder()
  const micCheck = useMicLagCheck()
  const cameraCheck = useCameraLagCheck()

  const activeItem = cards.activeItem
  const activeSound = activeItem ? getItemSound(activeItem) : null
  const melodyActive = isMelodyItem(activeItem)

  useLiveNotesForCard(activeSound && activeSound.kind === 'melody' ? activeSound.instrument : null)
  useKeyboardShortcuts(started, function () {
    if (activeItem) {
      cards.record(activeItem)
    }
  })

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

  const hintText = getHintText({
    recorderStatus: recorder.status,
    micCheckStatus: micCheck.status,
    cameraCheckStatus: cameraCheck.status,
    hasLayers: cards.items.some((item) => item.layer !== null),
    melodyActive: melodyActive,
    trackingOk: trackingOk,
  })

  return (
    <div className="page">
      <div className="main">
        <CameraView
          hudLabel={activeItem ? `Layer ${activeItem.number} / ${activeItem.soundLabel}` : 'Setup / Camera'}
          hintText={hintText}
          cameraOk={cameraOk}
          melodyActive={melodyActive}
          objectMarkers={
            // Object boxes only for a drum card (none on a melody card, design.md 4.3).
            activeItem !== null && !melodyActive && cameraOk ? (
              <ObjectMarkers
                linkedObjectId={cards.getLinkedObjectId(activeItem)}
                editable={recorder.status === 'idle'}
                onDraw={cards.drawObject}
                onSelect={cards.selectObject}
                onDelete={cards.deleteObjectById}
              />
            ) : null
          }
        />
        <LayersPanel items={cards.items} />
      </div>
      <Sidebar cards={cards} cameraOk={cameraOk} />
    </div>
  )
}
