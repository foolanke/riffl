// Entry point. Starts everything.
import { startAudio, playTestBeep } from './audio/audioEngine.js';

const startButton = document.getElementById('start-button');
const statusText = document.getElementById('status');

startButton.addEventListener('click', async function () {
  await startAudio();
  playTestBeep();
  statusText.textContent = 'Audio started.';
});
