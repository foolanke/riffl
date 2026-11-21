// Record a take (SPEC steps 12-17): drum dropdown, Record button (or Space),
// mute-layers option, undo, status, raw playback, detected hits and result.
import { useSyncExternalStore } from 'react'
import { DRUMS, getDrumLabel } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import {
  getRecorderState,
  playLastTake,
  recordTake,
  setMuteLayersWhileRecording,
  setTakeDrum,
  subscribeToRecorder,
} from '../audio/recorder.ts'
import type { RecordStatus } from '../audio/recorder.ts'
import { undoLastTake } from '../project/projectStore.ts'

const STATUS_TEXT: Record<RecordStatus, string> = {
  idle: 'Ready. Press Space or click Record.',
  countIn: 'Count-in...',
  recording: 'RECORDING - play now',
  processing: 'Finding hits...',
}

export function RecordPanel() {
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const take = recorder.lastTake
  const isBusy = recorder.status !== 'idle'

  let resultText = ''
  if (take && take.snappedSteps.length > 0) {
    const what = take.isRetake ? 'Retaken layer' : 'New layer'
    resultText = `${what}: ${getDrumLabel(take.drum)}, ${take.snappedSteps.length} hits on steps ${take.snappedSteps.join(', ')}`
  }

  let ignoredCount = 0
  if (take) {
    for (const hit of take.hits) {
      if (hit.ignoredAsSpeaker) {
        ignoredCount++
      }
    }
  }

  return (
    <fieldset>
      <legend>Record</legend>
      <p>
        <label>
          Drum for next take:{' '}
          <select
            value={recorder.takeDrum}
            onChange={(event) => {
              setTakeDrum(event.target.value as DrumName)
              event.target.blur() // so Space records instead of opening the list
            }}
          >
            {DRUMS.map((drum) => (
              <option key={drum.name} value={drum.name}>
                {drum.label}
              </option>
            ))}
          </select>
        </label>{' '}
        <button onClick={() => recordTake()} disabled={isBusy}>
          Record (Space)
        </button>{' '}
        <button onClick={() => undoLastTake()} disabled={isBusy}>
          Undo last take (Z)
        </button>
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={recorder.muteLayersWhileRecording}
            onChange={(event) => {
              setMuteLayersWhileRecording(event.target.checked)
              event.target.blur()
            }}
          />{' '}
          Mute layers while recording (metronome only)
        </label>
      </p>
      <p>{STATUS_TEXT[recorder.status]}</p>
      {recorder.message ? <p>{recorder.message}</p> : null}

      {take ? (
        <div>
          <p>
            Last take: {take.recordedSeconds.toFixed(3)} s recorded (loop is{' '}
            {take.loopSeconds.toFixed(3)} s){' '}
            <button onClick={playLastTake}>Play recording</button>
          </p>
          <p>
            Hits found: {take.hits.length}
            {ignoredCount > 0 ? ` (${ignoredCount} ignored as speaker sound)` : ''}
          </p>
          <ol>
            {take.hits.map((hit, index) => (
              <li key={index}>
                {hit.timeMs.toFixed(0)} ms - nearest {hit.positionLabel} (step {hit.step}),{' '}
                {hit.offsetMs >= 0 ? '+' : ''}
                {hit.offsetMs.toFixed(0)} ms
                {hit.ignoredAsSpeaker ? ' - IGNORED (speaker)' : ''}
              </li>
            ))}
          </ol>
          {resultText ? <p>{resultText}</p> : null}
        </div>
      ) : null}
    </fieldset>
  )
}
