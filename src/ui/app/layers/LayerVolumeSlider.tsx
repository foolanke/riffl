// A layer's volume slider (the human asked for one on each sidebar card
// and each Layers panel row). Not in the design: built from the Settings
// slider's style (thin line, small white thumb). 0-100 on screen, 0-1 in
// the project. Playback reads it on the next 16th, like mute.
import { getLayerVolume, setLayerVolume } from '../../../project/projectStore.ts'
import type { Layer } from '../../../project/projectStore.ts'

export function LayerVolumeSlider(props: { layer: Layer | null; number: string; showValue?: boolean }) {
  const layer = props.layer
  // A draft has nothing to play yet, so its slider sits at full and is disabled.
  const percent = layer ? Math.round(getLayerVolume(layer) * 100) : 100
  return (
    <>
      <input
        className="settings-range layer-volume-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={layer === null}
        aria-label={'Volume of layer ' + props.number}
        title={'Volume ' + percent}
        onChange={(event) => {
          if (layer) {
            setLayerVolume(layer.id, Number(event.target.value) / 100)
          }
        }}
        onPointerUp={(event) => event.currentTarget.blur()} // so Space records instead of moving this
      />
      {props.showValue ? <span className="layer-volume-value text-label color-muted">{percent}</span> : null}
    </>
  )
}
