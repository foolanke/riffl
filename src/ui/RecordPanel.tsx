// Record a take (SPEC steps 12-14): drum dropdown, Record button (or Space),
// status, raw playback, detected hits and the snapped result.
import { useSyncExternalStore } from 'react'
import { DRUMS, getDrumLabel } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import {
  getRecorderState,
  playLastTake,
  recordTake,
  setTakeDrum,
  subscribeToRecorder,
} from '../audio/recorder.ts'
import type { RecordStatus } from '../audio/recorder.ts'

const STATUS_TEXT: Record<RecordStatus, string> = {
  idle: 'Ready. Press Space or click Record.',
  countIn: 'Count-in...',
  recording: 'RECORDING - play now',
  processing: 'Finding hits...',
}

export function RecordPanel() {
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const take = recorder.lastTake

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
        <button onClick={recordTake} disabled={recorder.status !== 'idle'}>
          Record (Space)
        </button>
      </p>
      <p>{STATUS_TEXT[recorder.status]}</p>
      {recorder.errorText ? <p>{recorder.errorText}</p> : null}

      {take ? (
        <div>
          <p>
            Last take: {take.recordedSeconds.toFixed(3)} s recorded (loop is{' '}
            {take.loopSeconds.toFixed(3)} s){' '}
            <button onClick={playLastTake}>Play recording</button>
          </p>
          <p>Hits found: {take.hits.length}</p>
          <ol>
            {take.hits.map((hit, index) => (
              <li key={index}>
                {hit.timeMs.toFixed(0)} ms - nearest {hit.positionLabel} (step {hit.step}),{' '}
                {hit.offsetMs >= 0 ? '+' : ''}
                {hit.offsetMs.toFixed(0)} ms
              </li>
            ))}
          </ol>
          <p>
            {take.snappedSteps.length > 0
              ? `New layer: ${getDrumLabel(take.drum)}, ${take.snappedSteps.length} hits on steps ${take.snappedSteps.join(', ')}`
              : 'No hits, so no layer was added.'}
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}
