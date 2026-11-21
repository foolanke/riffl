// One test button per drum sound (SPEC step 7), and the pump on/off
// switch so the house pump can be compared by ear (masterBus.ts).
import { useSyncExternalStore } from 'react'
import { DRUMS } from '../audio/drums.ts'
import { getPumpOn, setPumpOn, subscribeToPump } from '../audio/masterBus.ts'
import { playDrum } from '../audio/samples.ts'

export function SampleButtons() {
  const pumpOn = useSyncExternalStore(subscribeToPump, getPumpOn)

  return (
    <fieldset>
      <legend>Drum sounds</legend>
      {DRUMS.map((drum) => (
        <button key={drum.name} onClick={() => playDrum(drum.name)}>
          {drum.label}
        </button>
      ))}
      <p>
        <label>
          <input
            type="checkbox"
            checked={pumpOn}
            onChange={(event) => {
              setPumpOn(event.target.checked)
              event.target.blur()
            }}
          />{' '}
          Pump: melody ducks on every kick (house sidechain)
        </label>
      </p>
    </fieldset>
  )
}
