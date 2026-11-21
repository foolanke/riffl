// Controls for project setup (SPEC 2.1) and recording options (SPEC 2.2).
// Every control writes to the project data; the clock reacts from there.
import {
  COUNT_IN_OPTIONS,
  KEYS,
  LOOP_BAR_OPTIONS,
  MAX_TEMPO_BPM,
  MIN_TEMPO_BPM,
  TIME_SIGNATURES,
  updateSettings,
} from '../project/projectStore.ts'
import type { CountInBars, LoopBars, TimeSignature } from '../project/projectStore.ts'
import { useProject } from './hooks.ts'

export function SetupControls() {
  const settings = useProject().settings

  return (
    <div>
      <fieldset>
        <legend>Project</legend>

        <p>
          <label>
            Tempo: {settings.tempoBpm} BPM{' '}
            <input
              type="range"
              min={MIN_TEMPO_BPM}
              max={MAX_TEMPO_BPM}
              step={1}
              value={settings.tempoBpm}
              onChange={(event) => updateSettings({ tempoBpm: Number(event.target.value) })}
            />
          </label>
        </p>

        <p>
          <label>
            Time signature:{' '}
            <select
              value={settings.timeSignature}
              onChange={(event) =>
                updateSettings({ timeSignature: event.target.value as TimeSignature })
              }
            >
              {TIME_SIGNATURES.map((signature) => (
                <option key={signature} value={signature}>
                  {signature}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            Loop length:{' '}
            <select
              value={settings.loopBars}
              onChange={(event) =>
                updateSettings({ loopBars: Number(event.target.value) as LoopBars })
              }
            >
              {LOOP_BAR_OPTIONS.map((bars) => (
                <option key={bars} value={bars}>
                  {bars === 1 ? '1 bar' : bars + ' bars'}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            Key:{' '}
            <select
              value={settings.key}
              onChange={(event) => updateSettings({ key: event.target.value })}
            >
              {KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>{' '}
          (stored for melody later; not audible yet)
        </p>
      </fieldset>

      <fieldset>
        <legend>Recording options</legend>

        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.metronomeOn}
              onChange={(event) => updateSettings({ metronomeOn: event.target.checked })}
            />{' '}
            Metronome (M)
          </label>
        </p>

        <p>
          <label>
            Metronome volume: {Math.round(settings.metronomeVolume * 100)}%{' '}
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(settings.metronomeVolume * 100)}
              onChange={(event) =>
                updateSettings({ metronomeVolume: Number(event.target.value) / 100 })
              }
            />
          </label>
        </p>

        <p>
          <label>
            Count-in:{' '}
            <select
              value={settings.countInBars}
              onChange={(event) =>
                updateSettings({ countInBars: Number(event.target.value) as CountInBars })
              }
            >
              {COUNT_IN_OPTIONS.map((bars) => (
                <option key={bars} value={bars}>
                  {bars === 0 ? 'Off' : bars === 1 ? '1 bar' : bars + ' bars'}
                </option>
              ))}
            </select>
          </label>{' '}
          (applies on next Play)
        </p>
      </fieldset>
    </div>
  )
}
