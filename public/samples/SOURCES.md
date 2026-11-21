# Drum sample sources

Downloaded once and committed so nothing loads from the internet at runtime (SPEC 0.2).
All files come from the oramics "sampled" collection (https://github.com/oramics/sampled),
which collects samples with public-domain or similar open licenses.

A TR-909 kit was chosen because its punchy kick, clap and open hats are the
classic dance-pop/house sound closest to I Gotta Feeling.

| File | Drum | Original file | Kit |
|---|---|---|---|
| kick.wav | Kick | DM/TR-909/Detroit/samples/kick.wav | TR-909 Detroit |
| snare.wav | Snare | DM/TR-909/Detroit/samples/snare.wav | TR-909 Detroit |
| hihat-closed.wav | Closed hi-hat | DM/TR-909/Detroit/samples/hihat-closed.wav | TR-909 Detroit |
| hihat-open.wav | Open hi-hat | DM/TR-909/Detroit/samples/hihat-open-1.wav | TR-909 Detroit |
| clap.wav | Clap | DM/TR-909/Detroit/samples/clap-1.wav | TR-909 Detroit |
| crash.wav | Crash | DM/TR-909/Detroit/samples/cymbal.wav | TR-909 Detroit |
| tom.wav | Tom | DM/TR-909/Detroit/samples/tom-h.wav | TR-909 Detroit |
| shaker.wav | Shaker | DM/LM-2/samples/cabasa.wav | LinnDrum LM-2 |

Licenses:
- **TR-909 Detroit:** free kit by F9 Audio
  (source: http://www.flstudiomusic.com/2016/09/download-free-909-kits-stems-f9-audio.html).
  The oramics page does not name an exact license. Confirm before any public/commercial release.
- **LinnDrum LM-2:** marked Public Domain (source: http://machines.hyperreal.org/manufacturers/Linn/LinnDrum/).

## Extras for hip-hop/trap (added at the team's request, not in SPEC 1.7)

| File | Drum | Original file | Kit |
|---|---|---|---|
| 808.wav | 808 | DM/TR-808/samples/01.BD.808.wav | Roland TR-808 |

The Hi-hat roll reuses hihat-closed.wav.
The oramics page does not name an exact license for the TR-808 set either. Confirm before any public/commercial release.

## Piano (melody instrument, SPEC 3.5)

`piano/*.mp3`: Salamander Grand Piano by Alexander Holm, CC-BY 3.0
(https://archive.org/details/SalamanderGrandPianoV3), downloaded once from the
Tone.js-hosted copy (https://tonejs.github.io/audio/salamander/). Every 3 semitones
from A3 to C7; Tone.Sampler fills in the notes between. CC-BY needs credit to the
author in any public release.
