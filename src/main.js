// Entry point. Starts everything.
// Step 1 (skeleton): just wire up the Start button.
// Audio (Tone.js) gets started here in step 2.

const startButton = document.getElementById('start-button');
const statusText = document.getElementById('status');

startButton.addEventListener('click', function () {
  statusText.textContent = 'Start clicked.';
  console.log('Start clicked');
});
