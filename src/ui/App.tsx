// Top-level screen. Plain, unstyled controls until the design arrives (SPEC 0.5).
import { useEffect, useState } from 'react'
import { startAudio, playTestBeep } from '../audio/audioEngine.ts'
import { play, stop } from '../audio/clock.ts'
import { getProject, toggleLayerMutedByIndex, updateSettings } from '../project/projectStore.ts'
import { BeatDisplay } from './BeatDisplay.tsx'
import { LayerList } from './LayerList.tsx'
import { MicPanel } from './MicPanel.tsx'
import { SampleButtons } from './SampleButtons.tsx'
import { SetupControls } from './SetupControls.tsx'
import { useIsPlaying } from './hooks.ts'

export default function App() {
  const [audioStarted, setAudioStarted] = useState(false)
  const [startStatus, setStartStatus] = useState('Not started.')
  const isPlaying = useIsPlaying()

  async function handleStartClick() {
    setStartStatus('Loading sounds...')
    try {
      await startAudio()
      playTestBeep()
      setAudioStarted(true)
    } catch (error) {
      console.error(error)
      setStartStatus('Could not start audio: ' + String(error))
    }
  }

  // Keyboard shortcuts (SPEC 0.6). M and 1-9 so far.
  useEffect(function () {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        const metronomeOn = getProject().settings.metronomeOn
        updateSettings({ metronomeOn: !metronomeOn })
      }
      if (/^[1-9]$/.test(event.key)) {
        toggleLayerMutedByIndex(Number(event.key) - 1)
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
        <p>{startStatus}</p>
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
      <LayerList />
      <MicPanel />
      <SampleButtons />
      <SetupControls />
    </div>
  )
}
