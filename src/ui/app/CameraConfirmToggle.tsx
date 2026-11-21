// Camera confirmation on/off (SPEC 1.4 safety toggle). On: a drum take with
// an object keeps only mic hits with a hand in the object's box. Off: mic
// only, in case lighting or hand tracking fails during the demo.
// Not in the design (design.md 10 Q7): built like the metronome strip (5.4)
// with the same on/off switch.
import { useSyncExternalStore } from 'react'
import { getRecorderState, setCameraConfirmOn, subscribeToRecorder } from '../../audio/recorder.ts'

export function CameraConfirmToggle() {
  const isOn = useSyncExternalStore(subscribeToRecorder, getRecorderState).cameraConfirmOn

  return (
    <div className={'camera-confirm-strip' + (isOn ? '' : ' is-off')}>
      <button
        className={'toggle-switch' + (isOn ? ' is-on' : '')}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="Camera confirmation"
        title="Camera confirmation on/off (off = mic only)"
        onClick={(event) => {
          setCameraConfirmOn(!isOn)
          event.currentTarget.blur() // so Space records instead of pressing this
        }}
      >
        <span className="toggle-switch-knob" />
      </button>
      <span className="camera-confirm-name text-label">Camera check</span>
      <div className="metronome-rule" />
      <span className="text-label color-muted">{isOn ? 'Hand in box' : 'Mic only'}</span>
    </div>
  )
}
