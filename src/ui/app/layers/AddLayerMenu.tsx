// ADD LAYER (design.md 5.5, in the sidebar): a button that drops down the
// sounds a layer can have, drums (SPEC 1.7) and melody instruments (SPEC 3.5),
// in labelled groups. Picking one makes the layer with that sound; Escape or a
// click outside adds nothing. A layer's sound is chosen only here, once.
import { DRUMS } from '../../../audio/drums.ts'
import type { DrumName } from '../../../audio/drums.ts'
import { INSTRUMENTS } from '../../../audio/instruments.ts'
import type { InstrumentName } from '../../../audio/instruments.ts'
import { Dropdown } from '../components/Dropdown.tsx'
import type { DropdownGroup } from '../components/Dropdown.tsx'
import { ICONS } from '../icons.ts'
import type { LayerSound } from './layerItems.ts'

interface AddLayerMenuProps {
  onAdd: (sound: LayerSound) => void
}

export function AddLayerMenu(props: AddLayerMenuProps) {
  const drumOptions = []
  for (const drum of DRUMS) {
    drumOptions.push({ value: 'drum:' + drum.name, text: drum.label })
  }
  const melodyOptions = []
  for (const instrument of INSTRUMENTS) {
    melodyOptions.push({ value: 'melody:' + instrument.name, text: instrument.label })
  }
  const groups: DropdownGroup[] = [
    { label: 'Drums', options: drumOptions },
    { label: 'Melody', options: melodyOptions },
  ]

  return (
    <Dropdown
      variant="menu"
      label="Add layer"
      value=""
      groups={groups}
      triggerClassName="button-filled button-add-layer text-item"
      onChange={(value) => props.onAdd(decodeSound(value))}
    >
      <img src={ICONS.plus} alt="" />
      Add layer
    </Dropdown>
  )
}

// The option value: "drum:kick" or "melody:pluck".
function decodeSound(value: string): LayerSound {
  const name = value.slice(value.indexOf(':') + 1)
  if (value.startsWith('melody:')) {
    return { kind: 'melody', instrument: name as InstrumentName }
  }
  return { kind: 'drum', drum: name as DrumName }
}
