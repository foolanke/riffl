// Camera confirmation on/off (SPEC 1.4 safety toggle). On: a drum take with
// an object keeps only mic hits with a hand in the object's box. Off: mic
// only, in case lighting or hand tracking fails during the demo.
// Not in the design (design.md 10 Q7): built like the metronome strip (5.4)
// with the same on/off switch.
import { setCameraConfirmOn } from '../../../audio/recorder.ts'
import { Rule } from '../components/Glyphs.tsx'
import { ToggleSwitch } from '../components/ToggleSwitch.tsx'
import { useRecorder } from '../hooks/engineState.ts'

export function CameraConfirmToggle() {
  const isOn = useRecorder().cameraConfirmOn

  return (
    <div className={'camera-confirm-strip' + (isOn ? '' : ' is-off')}>
      <ToggleSwitch
        on={isOn}
        label="Camera confirmation"
        title="Camera confirmation on/off (off = mic only)"
        onChange={setCameraConfirmOn}
      />
      <span className="camera-confirm-name text-label">Camera check</span>
      <Rule />
      <span className="text-label color-muted">{isOn ? 'Hand in box' : 'Mic only'}</span>
    </div>
  )
}
