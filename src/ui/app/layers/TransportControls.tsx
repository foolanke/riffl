// Layers panel header controls (not in the design yet, design.md 10 Q7:
// built from the Tick glyph, Label text and the outline button 5.5).
//
// BeatReadout: "BAR 1 · BEAT 3" plus a tick that flashes white on every
// beat (SPEC step 4). The clock calls onBeat exactly when each beat is
// heard; we write straight to the DOM so React doesn't re-render per beat.
//
// TransportButtons: PLAY / STOP for the saved loop, and UNDO (same as Z).
import { useEffect, useRef } from 'react'
import { onBeat, play, stop } from '../../../audio/clock.ts'
import { undoLastTake } from '../../../project/projectStore.ts'
import { useIsPlaying, useProject } from '../../hooks.ts'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { useCameraLagCheck, useMicLagCheck, useRecorder } from '../hooks/engineState.ts'

const FLASH_MS = 100
const STOPPED_TEXT = 'Stopped'

export function BeatReadout() {
  const tickRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(function () {
    let flashTimer: number | undefined
    const unsubscribe = onBeat(function (info) {
      const tick = tickRef.current
      const text = textRef.current
      if (!tick || !text) {
        return
      }
      window.clearTimeout(flashTimer)
      if (info === null) {
        // Stopped.
        text.textContent = STOPPED_TEXT
        text.classList.remove('is-playing')
        tick.classList.remove('is-flash')
        return
      }
      if (info.isCountIn) {
        text.textContent = `Count-in · Beat ${info.beat}`
      } else {
        text.textContent = `Bar ${info.bar} · Beat ${info.beat}`
      }
      text.classList.add('is-playing')
      tick.classList.add('is-flash')
      flashTimer = window.setTimeout(function () {
        tick.classList.remove('is-flash')
      }, FLASH_MS)
    })
    return function () {
      unsubscribe()
      window.clearTimeout(flashTimer)
    }
  }, [])

  return (
    <div className="beat-readout">
      <div className="beat-tick" ref={tickRef} />
      <span className="beat-readout-text text-label" ref={textRef}>
        {STOPPED_TEXT}
      </span>
    </div>
  )
}

export function TransportButtons() {
  const isPlaying = useIsPlaying()
  const hasLayers = useProject().layers.length > 0
  const recorder = useRecorder()
  const micCheck = useMicLagCheck()
  const cameraCheck = useCameraLagCheck()

  // A take or a lag check drives the clock itself; play/stop would break it.
  const isTakeRunning = recorder.status !== 'idle'
  const isCalibrating = micCheck.status !== 'idle' || cameraCheck.status !== 'idle'

  return (
    <>
      <OutlineButton
        disabled={isTakeRunning || isCalibrating}
        onClick={() => {
          if (isPlaying) {
            stop()
          } else {
            play()
          }
        }}
      >
        {isPlaying ? 'Stop' : 'Play'}
      </OutlineButton>
      <OutlineButton title="Undo last take (Z)" disabled={isTakeRunning || !hasLayers} onClick={undoLastTake}>
        Undo
      </OutlineButton>
    </>
  )
}
