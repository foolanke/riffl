// Metronome strip (design.md 5.4): on/off switch, METRONOME, rule, BPM chip, BPM.
// The BPM chip sets the tempo (SPEC 2.1, 60-180). The switch turns the
// metronome on and off, like the M key (SPEC 2.2, 0.6). It takes the timer
// icon's place: the strip has no spare width for both (human's request).
import { MAX_TEMPO_BPM, MIN_TEMPO_BPM, updateSettings } from '../../project/projectStore.ts'
import { useProject } from '../hooks.ts'
import { ICONS } from './icons.ts'

function buildTempoList(): number[] {
  const tempos: number[] = []
  for (let bpm = MIN_TEMPO_BPM; bpm <= MAX_TEMPO_BPM; bpm++) {
    tempos.push(bpm)
  }
  return tempos
}

const TEMPOS = buildTempoList()

export function MetronomeStrip() {
  const settings = useProject().settings

  return (
    <div className={'metronome-strip' + (settings.metronomeOn ? '' : ' is-off')}>
      <button
        className={'toggle-switch' + (settings.metronomeOn ? ' is-on' : '')}
        type="button"
        role="switch"
        aria-checked={settings.metronomeOn}
        aria-label="Metronome (M)"
        title="Metronome on/off (M)"
        onClick={(event) => {
          updateSettings({ metronomeOn: !settings.metronomeOn })
          event.currentTarget.blur() // so Space records instead of pressing this
        }}
      >
        <span className="toggle-switch-knob" />
      </button>
      <span className="metronome-name text-label">Metronome</span>
      <div className="metronome-rule" />
      <div className="bpm-chip">
        <select
          className="text-item"
          aria-label="Tempo"
          value={settings.tempoBpm}
          onChange={(event) => {
            updateSettings({ tempoBpm: Number(event.target.value) })
            event.target.blur() // so Space records instead of opening the list
          }}
        >
          {TEMPOS.map((bpm) => (
            <option key={bpm} value={bpm}>
              {bpm}
            </option>
          ))}
        </select>
        <img src={ICONS.chevronDown} alt="" />
      </div>
      <span className="text-label color-muted">BPM</span>
    </div>
  )
}
