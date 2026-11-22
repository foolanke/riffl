// Metronome strip (design.md 5.4): on/off switch, METRONOME, rule, BPM chip, BPM.
// The BPM chip sets the tempo (SPEC 2.1, 60-180). The switch turns the
// metronome on and off, like the M key (SPEC 2.2, 0.6). It takes the timer
// icon's place: the strip has no spare width for both (human's request).
import { MAX_TEMPO_BPM, MIN_TEMPO_BPM, updateSettings } from '../../../project/projectStore.ts'
import { useProject } from '../../hooks.ts'
import { ChipSelect } from '../components/ChipSelect.tsx'
import type { ChipOption } from '../components/ChipSelect.tsx'
import { Rule } from '../components/Glyphs.tsx'
import { ToggleSwitch } from '../components/ToggleSwitch.tsx'

function buildTempoOptions(): ChipOption[] {
  const options: ChipOption[] = []
  for (let bpm = MIN_TEMPO_BPM; bpm <= MAX_TEMPO_BPM; bpm++) {
    options.push({ value: String(bpm), text: String(bpm) })
  }
  return options
}

const TEMPO_OPTIONS = buildTempoOptions()

export function MetronomeStrip() {
  const settings = useProject().settings

  return (
    <div className={'metronome-strip' + (settings.metronomeOn ? '' : ' is-off')}>
      <ToggleSwitch
        on={settings.metronomeOn}
        label="Metronome (M)"
        title="Metronome on/off (M)"
        onChange={(on) => updateSettings({ metronomeOn: on })}
      />
      <span className="metronome-name text-label">Metronome</span>
      <Rule />
      <ChipSelect
        label="Tempo"
        value={String(settings.tempoBpm)}
        options={TEMPO_OPTIONS}
        onChange={(value) => updateSettings({ tempoBpm: Number(value) })}
      />
      <span className="text-label color-muted">BPM</span>
    </div>
  )
}
