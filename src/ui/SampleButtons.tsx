// One test button per drum sound (SPEC step 7).
import { DRUMS } from '../audio/drums.ts'
import { playDrum } from '../audio/samples.ts'

export function SampleButtons() {
  return (
    <fieldset>
      <legend>Drum sounds</legend>
      {DRUMS.map((drum) => (
        <button key={drum.name} onClick={() => playDrum(drum.name)}>
          {drum.label}
        </button>
      ))}
    </fieldset>
  )
}
