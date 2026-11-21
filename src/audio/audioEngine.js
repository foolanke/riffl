// Starts and owns the audio side of the app (Tone.js).
// Tone.js is installed from npm and bundled by Vite, so nothing loads
// from the internet at runtime (SPEC 0.2).
import * as Tone from 'tone';

// Browsers keep audio locked until the user clicks something.
// Tone.start() unlocks it, so it must be called from a click handler.
export async function startAudio() {
  await Tone.start();
  console.log('Audio started, sample rate:', Tone.getContext().sampleRate);
}

// A short beep to prove sound is coming out.
// G4 because the demo song is in G major.
export function playTestBeep() {
  const synth = new Tone.Synth().toDestination();
  synth.triggerAttackRelease('G4', '8n');

  // Free the synth once the beep has finished ringing.
  setTimeout(function () {
    synth.dispose();
  }, 1000);
}
