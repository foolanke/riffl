# SPEC

## Abstract

**What it is.** A browser app that turns everyday objects into a band using only a laptop's camera and mic. Tap a water bottle and it becomes a kick drum; tap a mug and it becomes a snare. Each part is recorded one at a time and loops, so the user builds a full song layer by layer. Raw input is cleaned up automatically (snapped to the beat, replaced with studio-quality sounds), so the result sounds produced with no music skills or software knowledge.

**Final vision.** Percussion from objects, plus melodic instruments played with hand gestures, all looping together into a complete track.

**Demo goal.** In the live demo we rebuild **I Gotta Feeling** (Black Eyed Peas) from scratch, layer by layer, as a near-perfect replica. The whole build is reverse-engineered around this song: every default, sound choice and feature is chosen so this song sounds right. Song facts: 128 BPM, 4/4, key of G major, chord loop G – C – Em. When in doubt, pick whatever makes this song sound closest to the original.

**Scope of this build.** Sections 0–2 and build order steps 1–25: the foundation, project setup, and the full object-percussion workflow (mic detects hits, camera confirms them). Melody (section 3) is not designed yet and must not be built. Leave the code easy to extend with melodic layers later.

## 0. Foundations

### 0.1 Tech
| Piece | Choice | Job |
|---|---|---|
| App type | Browser app, no backend | One process to run at the demo |
| Language | TypeScript | Type checking catches mistakes early |
| UI | React | Screens and controls |
| Dev server | Vite, React + TypeScript template (`npm run dev`) | Serves on localhost; camera and mic only work on localhost or https |
| Audio | Tone.js | Beat clock, metronome, sample playback |
| Hand tracking | MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`) | Hand positions from the webcam, in the browser |
| Browser | Chrome only | The demo browser |

Hit detection is a sudden-loudness check written by hand. No audio analysis library.

**Engine vs. UI.** `audio/`, `vision/` and `project/` are plain TypeScript with no React in them. React only displays state and sends commands. Audio timing must never depend on React re-renders.

### 0.2 Offline rule
Every dependency, the hand-tracking model files, and the drum samples live inside the repo. Nothing loads from the internet at runtime.

### 0.3 Folders
```
sounds/
  CLAUDE.md          rules for agents
  docs/SPEC.md       this doc
  index.html
  src/
    main.tsx         starts the React app
    audio/           clock, metronome, mic recording, hit detection, playback
    vision/          camera, hand tracking, object boxes
    project/         project data, save/load, undo
    ui/              React components (screens and controls)
  public/
    samples/         drum sounds (.wav)
    models/          hand-tracking model files
```

### 0.4 Project data
The whole project (settings, objects, layers, hits) is one plain data object. Save, load and undo work by copying that object.

Saved two ways: automatically in the browser after every change, and as a downloadable file that can be loaded on another laptop.

### 0.5 Screens
The screen design is being done separately. Until it arrives, use plain, unstyled, functional React components (buttons, sliders, dropdowns, text). Do not spend time on layout or styling.

### 0.6 Keyboard
| Key | Action |
|---|---|
| Space | Record a take |
| Z | Undo last take |
| 1–9 | Mute/unmute layer 1–9 |
| M | Metronome on/off |

## 1. Percussion

### 1.1 Concept
One physical object = one drum sound = one take. The user records drums one object at a time, building the beat layer by layer.

### 1.2 Setting up an object
1. User picks a drum sound from the list (1.7).
2. User drags a box around the object on the camera view.
3. Objects are assumed to stay still on the table, so the box is fixed. No moving-object tracking.

### 1.3 Recording a take
1. User presses a key.
2. 1-bar count-in.
3. Records exactly one loop, then stops on its own.
4. Hits are snapped to the beat (1.5) and the new layer starts looping immediately.

What plays during recording:
- Nothing recorded yet: metronome only.
- Existing layers: those layers play, with the metronome optional.
- User can mute existing layers and record against the metronome alone.

The user hears the object's real sound acoustically while playing. Drum samples are heard from the next loop onward.

### 1.4 Detecting hits
- **Mic decides when.** The mic recording gives the exact time of each hit.
- **Camera confirms where.** A mic hit is kept only if a hand was inside the object's box around that moment (roughly ±100ms). Mic sounds with no hand at the object, like talking or other tables, are discarded.
- **No added delay.** Both checks run after the take ends, on the recorded audio and camera frames, so confirmation never slows playback.
- **Sensitivity slider.** Sets how loud a sound must be to count as a hit, so it can be tuned for a quiet room or a loud hall.
- **Safety toggle.** Camera confirmation can be switched off (mic only) in case lighting or camera tracking fails during the demo.

### 1.5 Snapping to the beat
After the take, every kept hit is moved to the nearest grid position (default: 16th notes). Two hits landing on the same position merge into one.

**Snapping is hidden from the user.** Users should feel the take is theirs, not that AI corrected it. Nobody taps like a metronome, so the sound is snapped (percussion has to be on the beat), but the screen never shows it.
- **What you hear:** the snapped hits. Playback always uses the grid positions.
- **What you see:** the raw hits, drawn where the user actually tapped (after lag correction, 2.5). They look slightly uneven and human, not locked to grid dots.
- Each layer stores both: the raw hit times (for the screen) and the snapped grid positions (for playback). Undo, retake and save/load keep both.
- The UI never shows grid dots, snapped positions, "nearest 16th" labels or timing offsets for hits.

### 1.6 Layers, undo, retakes
- Every take creates a new layer. Recording the kick twice gives two kick layers.
- Each layer can be muted or deleted.
- **Undo** deletes the most recent take.
- **Retake** redoes one specific layer.

### 1.7 Drum sounds
Kick, snare, closed hi-hat, open hi-hat, clap, crash, tom, shaker.

A recorded hit always plays as the selected drum sample. The object's real sound is never used.

Samples: choose a punchy dance-pop kit that matches I Gotta Feeling. Download high-quality, free-to-use samples once into `public/samples/` and commit them (offline rule, 0.2). Never load them from the internet at runtime. If no good sample is found for a sound, generate a placeholder with Tone.js and flag it to the human.

### 1.8 Later (not now)
- Object recognition label ("bottle") on the camera view: cosmetic.
- Option to use the object's real recorded sound instead of a sample (risk: background noise).

## 2. Project setup

### 2.1 New project
Before starting, the user chooses:
- **Tempo:** 60–180 BPM.
- **Time signature:** 4/4, 3/4, 6/8.
- **Loop length:** 1, 2, or 4 bars. Every take is exactly this long.
- **Key:** stored with the project; used by melody (section 3).

### 2.2 Recording options
Changeable at any time:
- **Metronome:** on/off, volume.
- **Count-in:** off, 1 bar, or 2 bars.

### 2.3 Fixed by us (not user-facing)
- **Snap resolution:** 16th notes. Hidden from the user (1.5).

### 2.4 Defaults
New projects open with the demo song's settings: 128 BPM, 4/4, key of G major.

### 2.5 Lag check
Every laptop's mic hears sound slightly late, typically tens of milliseconds. Uncorrected, every hit is recorded late and can snap to the wrong grid position.

One-time calibration per laptop, about 10 seconds: the user taps along to the metronome, the app measures the average delay and subtracts it from all future hits. Saved, so it isn't repeated per project. Can be re-run from settings.

## 3. Melody
*Placeholder: not yet designed. Do not build.*

Known requirement: I Gotta Feeling's main instrumental part is a chord loop (G – C – Em), so the melody design must support playing chords, not only single notes.

## 4. Build order

Build in small steps, bottom up, most critical first. **One step at a time.** After each step, stop and tell the human how to test it. Only continue when the human says it passes. Never combine steps.

The mic-only drum loop (parts A–C) must fully work before any camera work (part D). The camera is a confirmation layer on top.

### Part A: Clock
1. **Skeleton.** Vite project, folders from 0.3, page with a Start button. *Done when:* `npm install && npm run dev` serves the page on localhost.
2. **Audio on.** Start button starts Tone.js. *Done when:* clicking Start plays a test beep.
3. **Metronome.** Fixed 128 BPM, 4/4, accented beat 1. Play/stop. *Done when:* clicks are steady for 2 minutes with no drift; play/stop works repeatedly.
4. **Beat display.** Current bar and beat, a flash on every beat, loop progress bar (fixed 2-bar loop). *Done when:* the display matches what you hear and resets exactly at the loop restart.
5. **Project data.** The project data object (0.4) holds the settings; the clock reads from it. *Done when:* changing tempo or loop length in the data changes what plays.
6. **Setup controls.** Controls for everything in 2.1 and 2.2. *Done when:* each control audibly changes behavior.

### Part B: Sound out
7. **Samples.** All 8 drum sounds (1.7) in `public/samples/`, each with a test button. *Done when:* every sound plays and sounds good.
8. **Layer playback.** A hardcoded test layer plays its hits on the grid. *Done when:* it loops in time with the metronome.
9. **Layer list.** Each layer shown with mute and delete; keys 1–9 toggle mute. *Done when:* muting and deleting work instantly.

### Part C: Mic drums
10. **Mic level.** Mic access with the settings needed for hit detection (echo cancellation on, noise suppression and auto gain off), plus a live level meter. *Done when:* the meter jumps on desk taps.
11. **Live hit flash.** Hit detection with the sensitivity slider; screen flashes per hit. *Done when:* firm taps flash and normal talking doesn't.
12. **Record one loop.** Space → count-in → records exactly one loop of mic audio, starting and stopping on the loop boundary → stops. *Done when:* the recording plays back and is exactly one loop long.
13. **Find hits.** Detect hit times in the recording and list them. *Done when:* tapping 4 even beats lists 4 times close to the beats.
14. **Snap and play.** Pick a drum from a dropdown; hits snap to the grid and become a new looping layer. *Done when:* a sloppy take comes back in time with the chosen drum.
15. **Lag check.** Calibration from 2.5. *Done when:* two runs agree within ~15ms, and taps then land in the right slots.
16. **Recording over layers.** Record while existing layers play; option to mute them and use the metronome alone. *Done when:* a second take lines up with the first, and playback from the speaker creates no phantom hits.
17. **Undo and retake.** Z deletes the last take; retake redoes a chosen layer. *Done when:* both work without disturbing other layers.
18. **Save and load.** Auto-save in the browser plus download/load file. *Done when:* a page refresh keeps everything, and a downloaded file loads on another browser and sounds identical.

### Part D: Camera
19. **Camera feed.** Webcam shown on screen. *Done when:* the feed is smooth.
20. **Hand tracking.** Dots drawn on hand positions. *Done when:* dots follow the hand smoothly.
21. **Object boxes.** Drag a box around an object and assign it a drum. *Done when:* boxes stay put and show their drum.
22. **Hand-in-box.** A box lights up while a hand is inside it. *Done when:* lighting is reliable when tapping the object.
23. **Camera confirmation.** During a take, save hand positions with timestamps; after the take, keep only mic hits with a hand in the box (1.4); add the on/off toggle. *Done when:* tapping the object records hits, while talking or clapping away from it doesn't.
24. **Object-based takes.** Selecting an object sets the drum for the take. *Done when:* the full flow works: set up object → Space → play → new layer with that object's drum.

### Part E: Tap view
25. **Raw hit view.** Each layer stores its raw hit times next to its snapped positions (1.5). Each layer is shown as a loop-long strip with a mark at every raw hit time, plus a playhead. Remove any on-screen snapped-step or timing-offset text. *Done when:* a sloppy take shows uneven marks where you actually tapped, sounds perfectly in time, and a refresh or loaded file shows the same marks.
