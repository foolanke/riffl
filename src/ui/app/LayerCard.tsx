// Layer card (design.md 5.9): collapsed = number, sound, chevron right.
// Expanded = header, RECORD, audio bar, sound Select.
// A draft card (not recorded yet) records a new take; a recorded card retakes it.
import { useEffect, useRef } from 'react'
import { DRUMS } from '../../audio/drums.ts'
import type { DrumName } from '../../audio/drums.ts'
import { getLoopProgress } from '../../audio/clock.ts'
import type { RecordStatus } from '../../audio/recorder.ts'
import { useIsPlaying, useProject } from '../hooks.ts'
import { ICONS } from './icons.ts'
import { formatMinutesSeconds, getLoopSeconds, getStepMap, getStepsInLoop } from './layerItems.ts'
import type { LayerItem } from './layerItems.ts'

const RECORD_LABELS: Record<RecordStatus, string> = {
  idle: 'Record',
  countIn: 'Count-in',
  recording: 'Recording',
  processing: 'Processing',
}

interface LayerCardProps {
  item: LayerItem
  expanded: boolean
  recorderStatus: RecordStatus
  isRecordingThis: boolean // this card's take is the one in progress
  message: string // status or result of the last take; '' = none
  onActivate: () => void
  onRecord: () => void
  onDrumChange: (drum: DrumName) => void
}

export function LayerCard(props: LayerCardProps) {
  const item = props.item
  const isMelody = item.layer !== null && item.layer.type === 'melody'

  let selectedDrum: DrumName | null = null
  if (item.draft) {
    selectedDrum = item.draft.drum
  } else if (item.layer && item.layer.type === 'drum') {
    selectedDrum = item.layer.drum
  }

  const isBusy = props.recorderStatus !== 'idle'
  const recordLabel = props.isRecordingThis ? RECORD_LABELS[props.recorderStatus] : RECORD_LABELS.idle
  const showRecording = props.isRecordingThis && props.recorderStatus === 'recording'

  let className = 'layer-card'
  if (!props.expanded) {
    className += ' is-collapsed'
  }
  if (item.muted) {
    className += ' is-muted'
  }

  return (
    <div className={className}>
      <button
        className="layer-card-header"
        type="button"
        aria-expanded={props.expanded}
        onClick={(event) => {
          props.onActivate()
          event.currentTarget.blur() // so Space records instead of pressing this
        }}
      >
        <span className="text-item">{item.number}</span>
        <span className="text-item">{item.soundLabel}</span>
        <span className="layer-card-spacer" />
        <img src={props.expanded ? ICONS.chevronDown : ICONS.chevronRight} alt="" />
      </button>

      {props.expanded ? (
        <div className="layer-card-body">
          <button
            className={'button-filled button-record text-item' + (showRecording ? ' is-recording' : '')}
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              props.onRecord()
              event.currentTarget.blur()
            }}
          >
            <img src={ICONS.record} alt="" />
            {recordLabel}
          </button>

          <AudioBar item={item} />

          <div className={'select' + (isMelody || isBusy ? ' is-disabled' : '')}>
            {selectedDrum !== null ? (
              <select
                className="text-item"
                aria-label="Drum sound"
                value={selectedDrum}
                disabled={isBusy}
                onChange={(event) => {
                  props.onDrumChange(event.target.value as DrumName)
                  event.target.blur() // so Space records instead of opening the list
                }}
              >
                {DRUMS.map((drum) => (
                  <option key={drum.name} value={drum.name}>
                    {drum.label.toUpperCase()}
                  </option>
                ))}
              </select>
            ) : (
              // Melody layers (made on the test page) keep their instrument here.
              <select className="text-item" aria-label="Instrument" disabled value="current">
                <option value="current">{item.soundLabel.toUpperCase()}</option>
              </select>
            )}
            <img src={ICONS.chevronDown} alt="" />
          </div>

          {props.message ? <p className="layer-card-message text-label color-muted">{props.message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

// Audio bar (design.md 5.10). Past takes keep no audio, so the "waveform"
// shows one bar per 16th step where the layer plays and a dot elsewhere.
// The red line follows the loop position, moved every frame straight on
// the DOM node so React doesn't re-render 60 times a second.
function AudioBar(props: { item: LayerItem }) {
  const settings = useProject().settings
  const isPlaying = useIsPlaying()
  const nowLineRef = useRef<HTMLDivElement>(null)
  const stepMap = getStepMap(props.item.layer, getStepsInLoop(settings))

  useEffect(function () {
    let frameId = 0
    function draw() {
      if (nowLineRef.current) {
        nowLineRef.current.style.left = getLoopProgress() * 100 + '%'
      }
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="audio-bar">
      <div className="audio-bar-wave">
        <div className="audio-bar-steps">
          {stepMap.map((isOn, step) => (
            <div key={step} className="audio-bar-slot">
              <div className={isOn ? 'audio-bar-hit' : 'audio-bar-dot'} />
            </div>
          ))}
          {isPlaying ? <div className="audio-bar-now" ref={nowLineRef} /> : null}
        </div>
        <span className="audio-bar-time text-label color-muted">{formatMinutesSeconds(getLoopSeconds(settings))}</span>
      </div>
    </div>
  )
}
