// The bottom Layers panel (design.md 4.1): LAYERS title, bar/beat readout,
// PLAY/STOP and UNDO (ADD LAYER lives in the sidebar), then the empty-state text, or one track
// row per recorded layer. Layer 01 first, in the same fixed order as the
// sidebar cards (the human asked for layers to keep their place and number;
// the design listed the newest first).
//
// While a take records, that layer's row lights the 16th step the take is
// on (the human asked for it); a new layer that has no row yet gets a
// temporary one, which the recorded layer replaces when the take ends.
import { useEffect, useRef } from 'react'
import { getRecorderState } from '../../../audio/recorder.ts'
import { getLoopProgress } from '../../../audio/clock.ts'
import { useProject } from '../../hooks.ts'
import type { LayerItem } from './layerItems.ts'
import { TrackRow } from './TrackRow.tsx'
import { BeatReadout, TransportButtons } from './TransportControls.tsx'

interface LayersPanelProps {
  items: LayerItem[]
  recordingKey: string | null // the card whose take is running
}

export function LayersPanel(props: LayersPanelProps) {
  const settings = useProject().settings
  const tracksRef = useRef<HTMLDivElement>(null)

  const recorded: LayerItem[] = []
  for (const item of props.items) {
    if (item.layer !== null || item.key === props.recordingKey) {
      recorded.push(item)
    }
  }

  // Every screen frame during the recorded loop (not the count-in): light
  // the step the take is on in the recording row.
  useEffect(function () {
    let frameId = 0
    let litStep: HTMLElement | null = null
    function draw() {
      let current: HTMLElement | null = null
      const tracks = tracksRef.current
      if (tracks && getRecorderState().status === 'recording') {
        const steps = tracks.querySelectorAll<HTMLElement>('.track-row.is-recording .step')
        if (steps.length > 0) {
          const index = Math.min(steps.length - 1, Math.floor(getLoopProgress() * steps.length))
          current = steps[index]
        }
      }
      if (current !== litStep) {
        if (litStep) {
          litStep.classList.remove('is-current')
        }
        if (current) {
          current.classList.add('is-current')
        }
        litStep = current
      }
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
      if (litStep) {
        litStep.classList.remove('is-current')
      }
    }
  }, [])

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="text-title">Layers</span>
        <BeatReadout />
        <div className="layers-header-spacer" />
        <TransportButtons />
      </div>

      {recorded.length === 0 ? (
        <div className="layers-empty">
          <span className="text-label color-muted">No layers yet. Record one to start your loop.</span>
        </div>
      ) : (
        <div className="tracks" ref={tracksRef}>
          {recorded.map((item) => (
            <TrackRow key={item.key} item={item} settings={settings} isRecording={item.key === props.recordingKey} />
          ))}
        </div>
      )}
    </div>
  )
}
