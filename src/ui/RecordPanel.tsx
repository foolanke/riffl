// Record a take (SPEC steps 12-17, 23-24): drum dropdown, Record button (or Space),
// mute-layers option, camera confirmation toggle, undo, status, raw playback,
// detected hits and result.
// Step 29: the next take is a drum or a melody take (whatever was picked
// last); a melody take uses the instrument picked under the camera.
import { useSyncExternalStore } from 'react'
import { DRUMS, getDrumLabel } from '../audio/drums.ts'
import type { DrumName } from '../audio/drums.ts'
import { getInstrumentLabel } from '../audio/instruments.ts'
import { getSelectedInstrument, subscribeToInstrument } from '../audio/liveMelody.ts'
import {
  getRecorderState,
  playLastTake,
  recordTake,
  setCameraConfirmOn,
  setMuteLayersWhileRecording,
  setTakeDrum,
  setTakeKind,
  subscribeToRecorder,
} from '../audio/recorder.ts'
import type { RecordStatus, TakeKind } from '../audio/recorder.ts'
import { findObject, undoLastTake } from '../project/projectStore.ts'
import { useProject } from './hooks.ts'

const STATUS_TEXT: Record<RecordStatus, string> = {
  idle: 'Ready. Press Space or click Record.',
  countIn: 'Count-in...',
  recording: 'RECORDING - play now',
  processing: 'Finding hits...',
}

function getStatusText(status: RecordStatus, kind: TakeKind): string {
  if (kind === 'melody' && status === 'recording') {
    return 'RECORDING - pinch to play'
  }
  if (kind === 'melody' && status === 'processing') {
    return 'Snapping notes...'
  }
  return STATUS_TEXT[status]
}

export function RecordPanel() {
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const take = recorder.lastTake
  const isBusy = recorder.status !== 'idle'
  useProject() // re-render when objects change, so the object text stays current
  const takeObject = findObject(recorder.takeObjectId)
  const instrument = useSyncExternalStore(subscribeToInstrument, getSelectedInstrument)
  const melodyTake = recorder.lastMelodyTake
  const showMelodyReport = recorder.lastTakeKind === 'melody' && melodyTake !== null

  let resultText = ''
  if (take && take.snappedSteps.length > 0) {
    const what = take.isRetake ? 'Retaken layer' : 'New layer'
    resultText = `${what}: ${getDrumLabel(take.drum)}, ${take.snappedSteps.length} hits on steps ${take.snappedSteps.join(', ')}`
  }

  let speakerCount = 0
  let noHandCount = 0
  if (take) {
    for (const hit of take.hits) {
      if (hit.ignoredAsSpeaker) {
        speakerCount++
      }
      if (hit.ignoredNoHand) {
        noHandCount++
      }
    }
  }
  const ignoredParts: string[] = []
  if (speakerCount > 0) {
    ignoredParts.push(`${speakerCount} ignored as speaker sound`)
  }
  if (noHandCount > 0) {
    ignoredParts.push(`${noHandCount} ignored, no hand at the object`)
  }

  return (
    <fieldset>
      <legend>Record</legend>
      <p>
        Next take:{' '}
        <label>
          <input
            type="radio"
            checked={recorder.takeKind === 'drum'}
            disabled={isBusy}
            onChange={(event) => {
              setTakeKind('drum')
              event.target.blur()
            }}
          />{' '}
          Drum
        </label>{' '}
        <label>
          <input
            type="radio"
            checked={recorder.takeKind === 'melody'}
            disabled={isBusy}
            onChange={(event) => {
              setTakeKind('melody')
              event.target.blur()
            }}
          />{' '}
          Melody ({getInstrumentLabel(instrument)}, pick the instrument under the camera)
        </label>
      </p>
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
        {takeObject ? '(from the chosen object) ' : '(no object chosen) '}
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
      <p>
        <label>
          <input
            type="checkbox"
            checked={recorder.cameraConfirmOn}
            onChange={(event) => {
              setCameraConfirmOn(event.target.checked)
              event.target.blur()
            }}
          />{' '}
          Camera confirmation (keep only hits with a hand at the object; off = mic only)
        </label>
      </p>
      <p>{getStatusText(recorder.status, recorder.takeKind)}</p>
      {recorder.message ? <p>{recorder.message}</p> : null}

      {showMelodyReport && melodyTake ? (
        <div>
          <p>
            Last take: {melodyTake.isRetake ? 'retaken' : 'new'} {getInstrumentLabel(melodyTake.instrument)} layer,{' '}
            {melodyTake.notes.length} notes played (camera lag {melodyTake.cameraLagMs.toFixed(0)} ms subtracted)
          </p>
          <ol>
            {melodyTake.notes.map((note, index) => (
              <li key={index}>
                {note.pitch}: {note.startMs.toFixed(0)} ms to {note.endMs.toFixed(0)} ms
              </li>
            ))}
          </ol>
          {melodyTake.snappedNotes.length > 0 ? (
            <p>
              Snapped:{' '}
              {melodyTake.snappedNotes
                .map((note) => `${note.pitch} at step ${note.step} for ${note.length}`)
                .join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {take && !showMelodyReport ? (
        <div>
          <p>
            Last take: {take.recordedSeconds.toFixed(3)} s recorded (loop is{' '}
            {take.loopSeconds.toFixed(3)} s){' '}
            <button onClick={playLastTake}>Play recording</button>
          </p>
          <p>
            Hits found: {take.hits.length}
            {ignoredParts.length > 0 ? ` (${ignoredParts.join(', ')})` : ''}
          </p>
          <ol>
            {take.hits.map((hit, index) => (
              <li key={index}>
                {hit.timeMs.toFixed(0)} ms - nearest {hit.positionLabel} (step {hit.step}),{' '}
                {hit.offsetMs >= 0 ? '+' : ''}
                {hit.offsetMs.toFixed(0)} ms
                {hit.ignoredAsSpeaker ? ' - IGNORED (speaker)' : ''}
                {hit.ignoredNoHand ? ' - IGNORED (no hand at object)' : ''}
              </li>
            ))}
          </ol>
          {resultText ? <p>{resultText}</p> : null}
        </div>
      ) : null}
    </fieldset>
  )
}
