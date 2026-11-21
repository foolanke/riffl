// The layer card's sound picker (design.md 5.8): drums (SPEC 1.7) and melody
// instruments (SPEC 3.5) in one Select. A draft can pick either; a recorded
// layer keeps its kind, since a retake records the same kind.
import { DRUMS } from '../../../audio/drums.ts'
import type { DrumName } from '../../../audio/drums.ts'
import { INSTRUMENTS } from '../../../audio/instruments.ts'
import type { InstrumentName } from '../../../audio/instruments.ts'
import { Select } from '../components/Select.tsx'
import type { LayerSound } from './layerItems.ts'

interface SoundSelectProps {
  sound: LayerSound | null
  showDrums: boolean
  showInstruments: boolean
  disabled: boolean
  onChange: (sound: LayerSound) => void
}

export function SoundSelect(props: SoundSelectProps) {
  return (
    <Select
      label="Sound"
      value={props.sound ? encodeSound(props.sound) : ''}
      disabled={props.disabled}
      onChange={(value) => props.onChange(decodeSound(value))}
    >
      {props.showDrums ? (
        <optgroup label="DRUMS">
          {DRUMS.map((drum) => (
            <option key={drum.name} value={'drum:' + drum.name}>
              {drum.label.toUpperCase()}
            </option>
          ))}
        </optgroup>
      ) : null}
      {props.showInstruments ? (
        <optgroup label="MELODY">
          {INSTRUMENTS.map((instrument) => (
            <option key={instrument.name} value={'melody:' + instrument.name}>
              {instrument.label.toUpperCase()}
            </option>
          ))}
        </optgroup>
      ) : null}
    </Select>
  )
}

// The option value: "drum:kick" or "melody:pluck".
function encodeSound(sound: LayerSound): string {
  return sound.kind === 'drum' ? 'drum:' + sound.drum : 'melody:' + sound.instrument
}

function decodeSound(value: string): LayerSound {
  const name = value.slice(value.indexOf(':') + 1)
  if (value.startsWith('melody:')) {
    return { kind: 'melody', instrument: name as InstrumentName }
  }
  return { kind: 'drum', drum: name as DrumName }
}
