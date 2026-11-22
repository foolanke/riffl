// The sidebar (design.md 3.1, 4.2): brand badge, ADD LAYER, metronome strip, the layer
// cards (active card first, expanded), then camera check, calibration and
// the Download button pinned to the bottom.
import { downloadProjectFile } from '../../../project/saveLoad.ts'
import { useProject } from '../../hooks.ts'
import { DownloadButton } from '../components/DownloadButton.tsx'
import { SectionTitle } from '../components/Glyphs.tsx'
import { releaseFocus } from '../components/releaseFocus.ts'
import { useRecorder } from '../hooks/engineState.ts'
import { ICONS } from '../icons.ts'
import { LayerCard } from '../layers/LayerCard.tsx'
import type { LayerCards } from '../layers/useLayerCards.ts'
import { BrandBadge } from './BrandBadge.tsx'
import { CalibrationSection } from './CalibrationSection.tsx'
import { CameraConfirmToggle } from './CameraConfirmToggle.tsx'
import { MetronomeStrip } from './MetronomeStrip.tsx'

interface SidebarProps {
  cards: LayerCards
  cameraOk: boolean
}

export function Sidebar(props: SidebarProps) {
  const cards = props.cards
  const recorder = useRecorder()
  const hasLayers = useProject().layers.length > 0

  return (
    <aside className="sidebar">
      <BrandBadge audioStarted />
      {/* ADD LAYER sits at the top of the sidebar as a white, primary button
          (moved here from the bottom Layers panel at the human's request). */}
      <button
        className="button-filled button-add-layer text-item"
        type="button"
        onClick={(event) => {
          cards.addLayer()
          releaseFocus(event.currentTarget)
        }}
      >
        <img src={ICONS.plus} alt="" />
        Add layer
      </button>
      <MetronomeStrip />

      {cards.cardOrder.length > 0 ? (
        <div className="section">
          <SectionTitle>Layers</SectionTitle>
          {cards.cardOrder.map((item) => {
            const isActive = cards.activeItem !== null && item.key === cards.activeItem.key
            return (
              <LayerCard
                key={item.key}
                item={item}
                expanded={cards.isExpanded(item)}
                recorderStatus={recorder.status}
                isRecordingThis={cards.recordingKey === item.key}
                message={isActive ? recorder.message : ''}
                onActivate={() => cards.activate(item)}
                onRecord={() => cards.record(item)}
                onSoundChange={(sound) => cards.changeSound(item, sound)}
                onDelete={() => cards.deleteCard(item)}
              />
            )
          })}
        </div>
      ) : null}

      <div className="sidebar-spacer" />

      <CameraConfirmToggle />
      <CalibrationSection cameraOk={props.cameraOk} />

      <div className="sidebar-footer">
        <DownloadButton disabled={!hasLayers} onClick={downloadProjectFile} />
        <a className="test-page-link text-label" href="/test.html">
          Test page
        </a>
      </div>
    </aside>
  )
}
