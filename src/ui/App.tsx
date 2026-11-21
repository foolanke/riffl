// Top-level screen. Plain, unstyled controls until the design arrives (SPEC 0.5).
import { useEffect, useState } from 'react'
import { startAudio, playTestBeep } from '../audio/audioEngine.ts'
import { play, stop } from '../audio/clock.ts'
import { getProject, updateSettings } from '../project/projectStore.ts'
import { BeatDisplay } from './BeatDisplay.tsx'
import { SetupControls } from './SetupControls.tsx'
import { useIsPlaying } from './hooks.ts'

export default function App() {
  const [audioStarted, setAudioStarted] = useState(false)
  const isPlaying = useIsPlaying()

  async function handleStartClick() {
    await startAudio()
    playTestBeep()
    setAudioStarted(true)
  }

  // Keyboard shortcuts (SPEC 0.6). Only M exists so far.
  useEffect(function () {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        const metronomeOn = getProject().settings.metronomeOn
        updateSettings({ metronomeOn: !metronomeOn })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return function () {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!audioStarted) {
    return (
      <div>
        <h1>Sounds</h1>
        <button onClick={handleStartClick}>Start</button>
        <p>Not started.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Sounds</h1>
      <p>
        <button onClick={play} disabled={isPlaying}>
          Play
        </button>{' '}
        <button onClick={stop} disabled={!isPlaying}>
          Stop
        </button>
      </p>
      <BeatDisplay />
      <SetupControls />
    </div>
  )
}
