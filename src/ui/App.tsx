// Top-level screen. Plain, unstyled controls until the design arrives (SPEC 0.5).
import { useState } from 'react'
import { startAudio, playTestBeep } from '../audio/audioEngine.ts'

export default function App() {
  const [audioStarted, setAudioStarted] = useState(false)

  async function handleStartClick() {
    await startAudio()
    playTestBeep()
    setAudioStarted(true)
  }

  return (
    <div>
      <h1>Sounds</h1>
      <button onClick={handleStartClick}>Start</button>
      <p>{audioStarted ? 'Audio started.' : 'Not started.'}</p>
    </div>
  )
}
