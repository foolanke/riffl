// Audio bar (design.md 5.10). Past takes keep no audio, so the "waveform"
// shows one bar per 16th step where the layer plays and a dot elsewhere.
// The red line follows the loop position, moved every frame straight on
// the DOM node so React doesn't re-render 60 times a second.
import { useEffect, useRef } from 'react'
import { getLoopProgress } from '../../../audio/clock.ts'
import type { Layer } from '../../../project/projectStore.ts'
import { useIsPlaying, useProject } from '../../hooks.ts'
import { formatMinutesSeconds, getLoopSeconds, getStepMap, getStepsInLoop } from './layerItems.ts'

export function AudioBar(props: { layer: Layer | null }) {
  const settings = useProject().settings
  const isPlaying = useIsPlaying()
  const nowLineRef = useRef<HTMLDivElement>(null)
  const stepMap = getStepMap(props.layer, getStepsInLoop(settings))

  useEffect(function () {
    let frameId = 0
    function draw() {
      if (nowLineRef.current) {
        nowLineRef.current.style.left = getLoopProgress() * 100 + '%'
      }
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="audio-bar">
      <div className="audio-bar-wave">
        <div className="audio-bar-steps">
          {stepMap.map((isOn, step) => (
            <div key={step} className="audio-bar-slot">
              <div className={isOn ? 'audio-bar-hit' : 'audio-bar-dot'} />
            </div>
          ))}
          {isPlaying ? <div className="audio-bar-now" ref={nowLineRef} /> : null}
        </div>
        <span className="audio-bar-time text-label color-muted">{formatMinutesSeconds(getLoopSeconds(settings))}</span>
      </div>
    </div>
  )
}
