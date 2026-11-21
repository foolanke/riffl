# DESIGN

The source of truth for how riffl **looks**. `docs/SPEC.md` is the source of truth for what riffl **does**. If the two conflict, SPEC wins on behaviour and this file wins on visuals. Open conflicts are listed in section 10; ask the human before resolving them.

- **Figma file:** `k3lHVZ79KCxlqD1UXKJESe` ("riffl"), section **hifi** (node `54:159`, 4944 × 4256 on canvas)
  https://www.figma.com/design/k3lHVZ79KCxlqD1UXKJESe/riffl?node-id=54-159
- **Reference renders:** `docs/design/reference/` (`state-0-no-layers.png`, `state-1-snare.png`, `state-2-hand-piano.png`, `components.png`)
- **Exported assets:** `docs/design/assets/` (all SVGs, exported from Figma and committed to satisfy the offline rule, SPEC 0.2)

**How to read this file**
- All measurements are CSS pixels at the 1440 × 1024 design size.
- Box notation: `padding 8 / 16` means 8px top and bottom, 16px left and right. `padding 8` means all four sides. `pl 8 pr 4 py 4` means left / right / vertical.
- "Row" = `display:flex; flex-direction:row; align-items:center`. "Column" = `display:flex; flex-direction:column; align-items:flex-start`.
- "Fill" = `flex: 1 0 0; min-width: 1px` (or `min-height: 1px` in a column). "Hug" = shrink-wraps its content.
- Node IDs in `code` let you look up any element in Figma. `I74:172;77:591` is an element inside a component instance.

---

## 1. Design language at a glance

- Pure black canvas, white type, grey 1px outlines. No gradients, no shadows, no blur, no transparency except the camera overlays and the explicit opacities in 2.1.
- A technical, HUD-style look: thin rules, tick marks (`|`), dotted timelines, corner brackets, music staff.
- **All text is UPPERCASE** Space Grotesk Medium with slightly open letter-spacing. The one exception is the RIFFL wordmark (Clash Display).
- Red (`#FF0000`) only appears in two places: the record icon and the "now" line in a waveform. Do not use red anywhere else.
- Containers have an 8px radius. Small chips and tags have a 4px radius.
- Every text node in Figma has `white-space: nowrap` and `word-break: break-word`; nothing wraps. Text never truncates in the design, so containers must hug or fit their text.

---

## 2. Tokens

Put these in one CSS file (for example `src/ui/tokens.css`) as custom properties, and use only these values.

### 2.1 Colour

| Token | Value | Used for |
|---|---|---|
| `--color-bg` | `#000000` | Page background, panel fill (panels have no explicit fill; they show the black page), text on white surfaces, playhead-handle fill |
| `--color-fg` | `#FFFFFF` | Primary text, icons, brand badge border and dividers, HUD and piano-overlay border, ticks, filled Download button, note heads and stems, waveform bars, playhead dashes, end barline |
| `--color-fg-muted` | `#D9D9D9` | Secondary text (hint, empty state, "BPM", ruler times, "LAYER 01", waveform time, note names), filled Bar step, Dot step on, recorded-tap dots |
| `--color-line` | `#6C6C6C` | Panel / card / button / select / strip borders, metronome rule, dotted rules (ruler and waveform), staff lines, time-signature barline, Dot step off stroke, rest count labels, disabled text and icon |
| `--color-surface` | `#444444` | Filled button background (Record, disabled Download), BPM chip, piano black keys |
| `--color-record` | `#FF0000` | Record icon stroke, waveform playhead bar (Figma writes it as `red`) |
| `--color-overlay` | `rgba(0,0,0,0.6)` | Background of anything placed on top of the camera (HUD strip, hint pill, piano overlay) |
| `--color-key-border` | `rgba(255,255,255,0.4)` | Piano white-key outline |
| `--color-key-active` | `rgba(217,217,217,0.35)` | Fill of the piano key currently sounding (`#D9D9D9` at 35%) |

Opacity variations in use:
- HUD strip session text (`SESSION 01`): white text with `opacity: 0.6` on the text node.
- Tap ripple rings: white stroke at `stroke-opacity` 1.0 / 0.5 / 0.25 (inner → outer).

### 2.2 Typography

Fonts must be bundled locally (SPEC 0.2). Neither is in the repo yet; see section 10.

| Font | Weight | Figma font name | Source / licence |
|---|---|---|---|
| **Space Grotesk** | Medium (500) | `Space Grotesk:Medium` | Google Fonts, SIL OFL. Bundle the `.woff2` in `public/fonts/`. |
| **Clash Display** | Semibold (600) | `Clash Display Variable:Semibold` | Fontshare (Indian Type Foundry), free licence. Bundle the `.woff2` in `public/fonts/`. Used **only** for the wordmark. Not italic. |

Text styles (the first three are Figma text styles):

| Style | Family | Size | Weight | Letter-spacing | Transform | Line-height | Rendered box height |
|---|---|---|---|---|---|---|---|
| `riffl/Label` | Space Grotesk | 12px | 500 | 0.12em = **1.44px** | uppercase | normal | **15px** |
| `riffl/Item` | Space Grotesk | 16px | 500 | 0.03em = **0.48px** | uppercase | normal | **20px** |
| `riffl/Title` | Space Grotesk | 18px | 500 | 0.03em = **0.54px** | uppercase | normal | **23px** |
| Wordmark | Clash Display | 32px | 600 | 0.03em = **0.96px** | none (typed "RIFFL") | normal | ≈ 41px |

- Figma writes the letter-spacing as a percentage (12 and 3). In CSS use the px or em values above.
- The Figma style lists line-height as "100", but the exported layout uses `line-height: normal`. Use `normal`: every box height in this file was measured with it. The "rendered box height" column is what a line of that style measures in the layout. If your font files give different heights, set `line-height` to those px values so the boxes match.
- The time-signature digits use the Item style.

Where each style is used:
- **Label (12):** section titles (SETUP, LAYERS in the sidebar), HUD strip, hint and empty-state text, METRONOME / BPM, track-row "LAYER 0N", ruler times, waveform time, object tag, piano octave labels, score counts and note names, playhead time, session footer.
- **Item (16):** button labels, select values, layer card number and instrument, track-row instrument name, BPM value, time-signature digits.
- **Title (18):** the "LAYERS" header of the bottom panel only.

### 2.3 Spacing, radius, borders, sizes

- **Spacing values in use:** 2, 3, 4, 6, 8, 12, 15, 16, 32 px.
  - 2: track label line gap, session footer line gap
  - 3: waveform bar gap
  - 4: BPM chip gap and padding, waveform remaining-dot gap, playhead dash gap, object tag vertical padding
  - 6: ruler dot gap, gap between a ruler label and its dots
  - 8: the default gap and padding
  - 12: metronome strip gap, HUD strip gap, layers-header gap, select right padding, logo cell vertical padding, session footer vertical padding
  - 15: camera overlay inset (from inside the 1px border)
  - 16: page padding, column gaps, panel padding, horizontal padding of most controls, track-row gap
  - 32: sidebar section gap
- **Radius:** **8** on every panel, card, button, select, strip, overlay and pill. **4** on the BPM chip, object tag, and the outer corners of the first and last white key of each octave. **2** on black-key bottom corners. **1** on all 2px dots and waveform bars. **24** only on the session footer's bottom-right corner.
- **Borders:** always **1px solid**, drawn inside the box (`box-sizing: border-box`). `--color-line` by default. `--color-fg` (white) for the brand badge, HUD strip and piano overlay. `--color-key-border` for white keys. Filled buttons, the hint pill and the object tag have **no** border.
- **Minimum heights:** buttons, selects and card headers **40**. Metronome strip **48**. Time ruler **20**.
- **Default component widths in the library:** 289 (Record, Select, Metronome strip, Brand badge, Session footer, Layer cards, Audio bar, Download). On screens they all stretch to the sidebar's inner width: 321 − 2×1 border − 2×16 padding = **287**.

### 2.4 Icons

All icons are SVGs with round caps and joins, white unless noted. Use the files in `docs/design/assets/` exactly as exported; do not redraw or resize them. Inside buttons the icon sits in a wrapper box of the same size, with content centred and `overflow: hidden`.

| Name | Figma node | File | Box | Stroke width | Colour | Geometry |
|---|---|---|---|---|---|---|
| Chevron down | `71:8` | `icon-chevron-down.svg` | 16 | 1.2 | white | `M4 6 L8 10 L12 6` |
| Chevron right | `75:337` | `icon-chevron-right.svg` | 16 | 1.2 | white | `M6 12 L10 8 L6 4` |
| Plus | `71:11` | `icon-plus.svg` | 16 | 1.2 | white | lines 3.33→12.67, both axes |
| Arrow right | `71:14` | `icon-arrow-right.svg` | 16 | 1.2 | white | shaft 3.33→12.67 at y 8, head from (8,3.33) |
| Chevrons right | `71:17` | `icon-chevrons-right.svg` | 16 | 1.2 | white | two chevrons at x 4–7.33 and 8.67–12 |
| Circle | `71:27` | `icon-circle.svg` | 16 | 1.2 | white | circle r 6.67 centred |
| Upload | `75:349` | `icon-upload.svg` | 16 | 1.2 | white | tray from y 10, arrow up to y 2 |
| Record | `75:340` | `icon-record.svg` | 20 | 1.5 | **#FF0000** | outer circle r 8.33, inner dot r 0.83 (both stroked) |
| Timer | `75:344` | `icon-timer.svg` | 20 | 1.5 | white | top bar 8.33→11.67 at y 1.67, dial r 6.67 at (10, 11.67), hand to (12.5, 9.17) |
| Infinity | `71:21` | `icon-infinity.svg` | 20 | 1.5 | white | figure-eight, loops centred at x 5 and 15 |
| Audio waveform | `71:24` | `icon-audio-waveform.svg` | 20 | 1.5 | white | rounded zig-zag wave |
| Download | `96:838` | `icon-download.svg` | 20 | 1.5 | **#000000** | tray from y 12.5, arrow down from y 2.5 |
| Download (disabled) | `96:844` | `icon-download-disabled.svg` | 20 | 1.5 | **#6C6C6C** | same geometry |
| Sidebar | `96:950` | `icon-sidebar.svg` | 24 | 1.5 | white | rounded rect 2.75→21.25 × 4.75→19.25 (r 2.5), divider at x 9.5. Figma description: "Sidebar open/close toggle." |
| Logo mark | `71:75` | `logo-mark.svg` | 51 × 28.5 | filled | white | layered-arc "Subtract" shape |

Other graphic assets:

| Asset | Node | File | Size | Geometry |
|---|---|---|---|---|
| Tap ripple | `71:162` | `tap-ripple.svg` | 96 × 96 | circles r 47.25 (25%), r 31.25 (50%), r 15.25 (100%), 1.5 stroke; centre dot r 4 filled |
| Playhead handle | `90:840` | `playhead-handle.svg` | 12 × 14 | path `M1 1 H11 V9 L6 13 L1 9 V1 Z`, fill black, stroke white 1.2, round join |
| Note head | `85:603` | `note-head.svg` | 11 × 8 | ellipse rx 5.5 ry 4, fill white |
| Corner TL / TR / BL / BR | `71:168` / `71:170` / `71:172` / `71:174` | `corner-*.svg` | 20 × 20 | 18px L-shape, 2px white stroke, inset 1px |
| Step dot off | `77:586` | `step-dot-off.svg` | 64 × 40 | circle r 5.25 at centre, 1.5 stroke #6C6C6C, no fill (outer diameter 12) |
| Step dot on | `77:588` | `step-dot-on.svg` | 64 × 40 | circle r 6 at centre, fill #D9D9D9 |
| Recorded tap | `84:612` | (CSS) | 12 × 12 | circle r 6, fill #D9D9D9 |

### 2.5 Primitive glyphs (draw in CSS)

| Glyph | Node | Spec |
|---|---|---|
| Glyph/Tick | `71:28` | 1 × 16, white fill |
| Rule (metronome) | `71:67` | height 1, fill, `--color-line` |
| Dot (ruler, waveform remaining) | `98:837` | 2 × 2, `--color-line`, radius 1 |
| Waveform bar | `89:1022` | 2 wide × variable height (2–56), white, radius 1 |
| Playhead dash | `90:843` | 1 × 4, white; dashes 4px apart |
| Staff line | `85:570` | height 1, full width, `--color-line` |
| Stem | `85:604` | 1.5 × 26, white |
| Divider (brand badge) | `71:85` | 1 wide, full height (`align-self: stretch`), white |

---

## 3. Layout

### 3.1 Page frame (`74:37`, `74:123`, `74:270`)

Desktop only, designed at **1440 × 1024**. The app fills the viewport. On the Figma canvas the frames sit 1540px apart, each with a caption above it (Label-sized heading text, 23px tall): "State 0 — No layers (setup)", "State 1 — Layers (snare)", "State 2 — Layer (hand piano)".

```
┌─────────────────────────────────────────────────────────────── 1440 ┐
│ pad 16                                                               │
│ ┌──────────── Main 1071 (fill) ─────────────┐ 16 ┌─ Sidebar 321 ─┐  │
│ │ Camera 1071 × 686 (fill)                   │    │ Brand badge 57 │  │
│ │                                            │    │ 32             │  │
│ │                                            │    │ …sections…     │  │
│ └────────────────────────────────────────────┘    │                │  │
│ 16                                                 │ spacer (fill)  │  │
│ ┌──── Layers panel 1071 × 290 ───────────────┐   │ Download 40    │  │
│ └────────────────────────────────────────────┘   └── 992 tall ────┘  │
│ pad 16                                                               │
└──────────────────────────────────────────────────────────────── 1024 ┘
```

| Box | Node | Size at 1440×1024 | Styling |
|---|---|---|---|
| Root | `74:37` | 1440 × 1024 | `background #000; display:flex; flex-direction:row; align-items:flex-start; gap:16; padding:16` |
| Main | `74:38` | 1071 × 992 | fill width, full height, column, gap 16, `overflow:hidden`, no border |
| Camera panel | `74:39` | 1071 × 686 | fill height, full width, 1px `--color-line` border, radius 8, `overflow:hidden`, `position:relative` |
| Camera image | — | fills camera | `position:absolute; inset:0; object-fit:cover; border-radius:8; pointer-events:none` |
| Layers panel | `74:60` | 1071 × **290** (fixed) | column, gap 16, padding 16, 1px `--color-line` border, radius 8. `overflow:hidden` in state 0. In states 1–2 not clipped, because the playhead is positioned inside. |
| Sidebar | `74:73` | **321** × 992 | full height, column, **gap 32**, padding 16, 1px `--color-line` border, radius 8, `overflow:hidden` |
| Sidebar spacer | `74:110` | 1 × fill | `flex:1 0 0`; pushes Download to the bottom |

Derived inner sizes:
- Layers panel inner (inside padding + border): 1037 × 256. The header takes 40, the gap 16, and the content area **200**.
- Sidebar inner: 287 wide (321 − 2 borders − 32 padding). Download's top sits at y 935 inside the sidebar (992 − 1 border − 16 padding − 40 height).
- Camera inner for overlays: 1069 × 684.

### 3.2 Camera overlays

Everything on the camera is absolutely positioned inside the camera panel. Offsets are measured from the inside of the 1px border, so `15` sits 16px from the outer edge.

| Overlay | Node | Position | Size in mock |
|---|---|---|---|
| HUD strip | `71:87` instance | `top:15; left:15` | hugs (≈276 × 34 for `SETUP / CAMERA`) |
| Hint pill (state 0) | `74:58` | `bottom:15`, horizontally centred (left 329 in mock) | hugs (≈413 × 31) |
| Piano overlay (melody layer) | `74:291` | `bottom:15; left:15`, width 1039 (= camera inner − 2×15), height **132** | |
| Object marker (state 1) | `71:167` instance | mock: `bottom:25; left:519`; really wherever the user drew the box (SPEC 1.2) | 180 × 440 |
| Tap ripple (state 1) | `71:162` instance | mock: `bottom:167; left:911` (on the hand) | 96 × 96 |
| Tap ripple (state 2) | `71:162` instance | mock: `bottom:4; left:438.55` (centred on the sounding key) | 96 × 96 |

The camera image is mirrored for melody (SPEC 3.2). The overlays themselves are **not** mirrored; text must stay readable. Overlay stacking order from bottom to top: image, HUD strip, object marker / piano overlay, hint pill, tap ripple.

---

## 4. Screens (states)

There is one screen whose contents change with the project state. The three Figma frames are three states of that screen.

### 4.1 State 0: no layers / setup (`74:37`)

Reference: `docs/design/reference/state-0-no-layers.png`

**Camera**
- HUD strip: `SESSION 01 | SETUP / CAMERA`.
- Hint pill (`74:58`), bottom-centre: `POINT THE CAMERA AT AN OBJECT, THEN PRESS RECORD`.
  - Row, padding 8 / 16, radius 8, background `--color-overlay`, **no border**, `overflow:hidden`.
  - Text: Label, `--color-fg-muted`.

**Layers panel**
- Header row (`74:61`): row, gap 12, full width, `overflow:hidden`, 40 tall (set by the button).
  - `LAYERS` (Title, white, 67 × 23) · spacer (fill, 1px tall, invisible) · **ADD LAYER** outline button (144 × 40, hug).
- Empty state (`74:71`): fills the remaining 1037 × 200, row, centred both ways, `overflow:hidden`.
  - `NO LAYERS YET. RECORD ONE TO START YOUR LOOP.` (Label, `--color-fg-muted`, 350 × 15).

**Sidebar** (top to bottom, gap 32)
1. Brand badge (287 × 57) at y 17.
2. Section **SETUP** (`74:88`, 287 × 119) at y 106: column, gap 8, `overflow:hidden`.
   - Section title (287 × 15) · **Record button** (287 × 40) · **Metronome strip** (287 × 48).
3. Spacer (fill, 646 tall in the mock).
4. **Download button, disabled** (287 × 40) at y 935.

### 4.2 State 1: one percussion layer (`74:123`)

Reference: `docs/design/reference/state-1-snare.png`

**Camera**
- HUD strip: `SESSION 01 | LAYER 01 / SNARE` (the active layer).
- **Object marker** around the tapped object (a water bottle in the mock), tag `OBJECT · SNARE`.
- **Tap ripple** where a hit was detected (on the user's hand, at the right edge of the mock).

**Layers panel**
- Header row: the same as state 0.
- **Tracks** (`74:171`): column, gap 8, full width, hug height (86), `position:relative`.
  1. **Time ruler**, 1037 × 20.
  2. **Track row, Percussion (step dots)**, 1037 × 58: `LAYER 01 / SNARE`. Steps 3 and 7 are **on**, the other six off.
  3. **Playhead** (absolute): `left:494; top:3; bottom:0`, width 12 (83 tall).
- The remaining 106px of the 200 content area stays empty (black).

**Sidebar** (gap 32)
1. Brand badge at y 17.
2. **Metronome strip** (287 × 48) at y 106, now on its own with no SETUP title.
3. Section **LAYERS** (`74:214`, 287 × 349) at y 186: column, gap 8, `overflow:hidden`.
   - Section title `LAYERS` (287 × 15).
   - **Layer card, Expanded**: `01 SNARE` (287 × 260), with a Snare-variant waveform and Select `SNARE`.
   - **Layer card, Collapsed**: `02 PIANO` (287 × 58).
4. Spacer (336 tall).
5. **Download button, enabled** at y 935.

Note: the sidebar lists `02 PIANO` in state 1, but the layers panel shows only one track. This is a mock inconsistency; the sidebar and the panel must list the same layers.

### 4.3 State 2: melody layer active, hand piano (`74:270`)

Reference: `docs/design/reference/state-2-hand-piano.png`

**Camera**
- HUD strip: `SESSION 01 | LAYER 02 / PIANO`.
- **Piano overlay** along the bottom: octaves `C4`, `C5`, `C6`, matching the three columns of SPEC 3.2. The **3rd white key of the C5 octave (E5)** is filled with `--color-key-active`.
- **Tap ripple** centred on that key (horizontally on the key, vertically low over the overlay).
- No object marker is shown while a melody layer is active.

**Layers panel**
- **Tracks** (`74:350`): column, gap 8, 1037 × **200** (exactly fills the content area).
  1. Time ruler, 1037 × 20.
  2. **Track row, Score**, 1037 × 106: `LAYER 02 / PIANO`. Notes: C5 on count `1`, E5 on the 2nd `&`, G5 on the 3rd `&` (slots 1, 4 and 6 of 8). All other slots are rests.
  3. **Track row, Percussion (recorded taps)** (`84:590`), 1037 × 58: `LAYER 01 / SNARE`, five taps.
  4. **Playhead** (absolute): `left:516; top:3; bottom:0` (197 tall).
- **The newest layer is listed first.**

**Sidebar**
- The same structure as state 1. Expanded card `02 PIANO` (Piano-variant waveform, Select `PIANO`), then collapsed `01 SNARE`. **The active layer's card comes first.**

---

## 5. Components

Each entry gives the Figma node, its structure, and exact styling. "Default" means the component's own size in the library; on screens most stretch to full width.

### 5.1 Brand badge (`71:73`)
- Default 289 × 57; on screen 287 × 57 (full sidebar width).
- 1px **white** border, radius 8, `overflow:hidden`. Row, `align-items:flex-start`, with every cell `align-self:stretch`, so all cells are full height.
- Cells, left to right:
  1. **Logo cell** (`71:74`): hug width (51 + 2×16 = 83), padding 12 / 16, content centred, `overflow:hidden`. Contains `logo-mark.svg` at 51 × 28.5.
  2. **Divider** (`71:85`): 1px wide, white.
  3. **Wordmark cell** (`71:81`): fill width, **white background**, padding 8 / 16, content centred, `overflow:hidden`. Text `RIFFL`: Clash Display Semibold 32, letter-spacing 0.96px, **black**. This cell's text sets the badge height: 41 + 2×8 = 57.
  4. **Divider** (`71:86`): 1px wide, white.
  5. **Sidebar toggle cell** (`71:82`): hug width (24 + 2×16 = 56), padding 8 / 16, column, content centred, `overflow:hidden`. Contains `icon-sidebar.svg` at 24. Clickable; it opens and closes the sidebar. Its collapsed state is not designed yet (section 10).

### 5.2 Section title (`74:89`)
- Full width, 15 tall. Row, padding 0 / 8 (8px left and right, nothing top and bottom), `overflow:hidden`.
- Label style, **white**. Text: `SETUP` (43 wide) or `LAYERS` (50 wide).
- The section container (`74:88`, `74:214`) is a column, **gap 8**, full width, `overflow:hidden`.

### 5.3 Record button (`71:40`)
- Default 289 × 40; full width on screens.
- Min-height 40, padding 8, radius 8, background `--color-surface`, **no border**.
- Row, centred horizontally and vertically, gap 8:
  - Icon wrapper (`71:44`): 20 × 20, content centred, `overflow:hidden`, containing `icon-record.svg` (20, red).
  - `RECORD` (Item, white).
- Used in SETUP (state 0) and inside an expanded layer card (record or retake that layer).

### 5.4 Metronome strip (`71:60`)
- Default 289 × 48; full width on screens.
- Min-height 48, padding 8 / 16, 1px `--color-line` border, radius 8. Row, gap 12.
- Children, left to right:
  1. Icon wrapper (`71:65`): 20 × 20, centred, `overflow:hidden`, containing `icon-timer.svg` (20).
  2. `METRONOME` (Label, **white**).
  3. Rule (`71:67`): fill width, 1px tall, `--color-line`.
  4. **BPM chip** (`71:68`): hug size, background `--color-surface`, radius 4, padding **pl 8, pr 4, py 4**, row, gap 4, `overflow:hidden`.
     - Value `120` (Item, white) · `icon-chevron-down.svg` (16).
     - Height ≈ 28 (20 text + 8 padding).
  5. `BPM` (Label, `--color-fg-muted`).
- The BPM chip opens a tempo picker covering 60–180 (SPEC 2.1). The mock shows `120`. Show the project's real tempo; the default is **128** (section 10).

### 5.5 Button / Outline plus: ADD LAYER (`71:57`)
- Hug width, default 144 × 40.
- Min-height 40, padding 8 / 16, 1px `--color-line` border, radius 8, transparent background.
- Row, gap 8:
  - Icon wrapper (`71:58`): 16 × 16, centred, `overflow:hidden`, containing `icon-plus.svg`.
  - `ADD LAYER` (Item, white).

### 5.6 Button / Outline upload: SET AUDIO (`71:52`), library only
- Hug width, default 140 × 40. Exactly as 5.5, but with the icon wrapper `71:53` containing `icon-upload.svg` (16), and the label `SET AUDIO`.
- **It does not appear on any screen.** Don't build it until a feature needs it.

### 5.7 Download button (`96:849`)

| State | Node | Background | Icon | Text |
|---|---|---|---|---|
| Default | `96:837` | `#FFFFFF` | `icon-download.svg` (black) | `DOWNLOAD`, Item, **black** |
| Disabled | `96:843` | `--color-surface` | `icon-download-disabled.svg` (#6C6C6C) | `DOWNLOAD`, Item, `#6C6C6C` |

- Default 289 × 40; full width on screens.
- Min-height 40, padding 8, radius 8, no border. Row, centred, gap 8. The icon is 20 × 20 with no wrapper.
- Disabled while the project has no layers. It saves the project file (SPEC 0.4, step 18).
- This is the **only** white-filled button. It is the primary action.

### 5.8 Select (`71:46`)
- Default 289 × 40; full width on screens.
- Min-height 40, 1px `--color-line` border, radius 8, padding **pl 16, pr 12, py 8**. Row, gap 8.
- Value (Item, white) · spacer (fill, 1px tall) · `icon-chevron-down.svg` (16).
- Used as the **instrument / drum picker** in an expanded layer card (instance node `71:125`). The values are the drum sounds (SPEC 1.7) and the melody instruments (SPEC 3.5), shown uppercase.

### 5.9 Layer card (`71:110` Expanded, `71:140` Collapsed)

**Shell (both):** full width (default 289), 1px `--color-line` border, radius 8, padding 8, column.

**Header (both)** (`71:111` / `71:141`): full width, min-height 40, padding 8, radius 8, row, gap 8, `overflow:hidden`.
- Number `01` (Item, white) · instrument `SNARE` (Item, white): two separate text nodes, 8 apart.
- Spacer (fill, 1px tall).
- Chevron (16): `icon-chevron-down.svg` when expanded, `icon-chevron-right.svg` when collapsed.

**Collapsed:** header only. Height 8 + 40 + 8 + 2 borders = **58**. Library defaults: number `02`, instrument `SNARE`. Clicking it expands that card and makes it the active layer.

**Expanded:** header, then **Body** (`71:118`): full width, column, padding 8, gap 8, `overflow:hidden`.
1. Record button (5.3), full width, 40.
2. Audio bar (5.10), full width, 90.
3. Select (5.8) showing this layer's instrument, 40.

Height: 1 + 8 + 40 + (8 + 40 + 8 + 90 + 8 + 40 + 8) + 8 + 1 = **260**. At the 287 card width the header is 269 wide (287 − 2 border − 16 padding) and the body content is 253 wide (another 16 of body padding).

Layer numbers are two digits with a leading zero (`01`, `02` …).

### 5.10 Audio bar / waveform (`89:1097`, variants `Sound=Piano` `76:347`, `Sound=Snare` `89:1019`)
- Default 289 × 90; full width in the card.
- 1px `--color-line` border, radius 8, padding 16, column, `overflow:hidden`. Height 1 + 16 + **56** + 16 + 1 = 90.
- **Waveform row** (`76:351` / `89:1020`): full width, height 56, row, **gap 3**, `overflow:hidden`. Children in order:
  1. **Bars** group (`76:352`): hug, row, gap 3, `overflow:hidden`. 32 bars in the mock, each 2 wide, white, radius 1, vertically centred, heights 2–56 taken from the audio's loudness.
  2. **Playhead** (`76:385`): 2 × 56, `--color-record`, radius 1.
  3. **Remaining** (`76:386`): fill width, row, **gap 4**, `overflow:hidden`. A row of 2 × 2 `--color-line` dots (radius 1), as many as fit (40 in the mock).
  4. **Time** (`76:350`): e.g. `00:07` (Label, `--color-fg-muted`).
- Mock bar heights, for reference only:
  - **Snare:** 3, 4, 2, 2, 3, **44**, 28, 18, 10, 8, 4, **38**, 22, 14, 8, 6, 4, 4, 4, **50**, 30, 20, 14, 8, 4, 4, **34**, 22, 14, 8, 4, 4. Sharp spikes with fast decay.
  - **Piano:** 4, 14, 28, 26, 12, 8, 22, 36, 44, 48, **52**, 46, 30, 22, 26, 28, 30, 36, 44, 34, 18, 12, 10, 12, 18, 34, 46, 40, 34, 30, 28, 34. A smooth swelling envelope.
- Draw the real waveform; don't copy the mock heights.

### 5.11 Time ruler (`98:830`)
- Default 960 × 20; full width (1037) in the panel.
- Min-height 20, padding 0 / 16 (16px left and right, nothing top and bottom). Row, **gap 16**. This matches the track row's padding and gap, so the columns line up.
- Children:
  1. **Label column** (`98:831`): 140 wide, 1 tall, empty.
  2. **Tick column** (`98:832`): 1 × 1, empty (aligns with the track row's Glyph/Tick).
  3. **Scale** (`98:833`): fill, row, **gap 8**, `overflow:hidden`.
- **Scale:** 8 equal steps (`98:834` … `98:992`), each fill and `overflow:hidden`.
  - Odd steps (1, 3, 5, 7): row, gap 6. They contain a time label (Label, `--color-fg-muted`) and then a Dots row (fill, gap 6, `overflow:hidden`).
  - Even steps (2, 4, 6, 8): only the Dots row.
  - Dots: 2 × 2, `--color-line`, radius 1. Each Dots row has 20 dots in the mock and clips what doesn't fit.
- Mock labels: `00:00:00`, `00:00:50`, `00:01:00`, `00:01:50`. These are placeholders; see section 10.

### 5.12 Track row (`77:604`, variants `Type=Melodic` `71:148`, `Type=Percussion` `77:590`, `Type=Score` `85:677`)

**Shared shell:**
- Default 960 wide; full width (1037) in the panel.
- 1px `--color-line` border, radius 8, padding 8 / 16. Row, **gap 16**, `align-items:center`.
- **Track label** (`77:591`): **140** wide, column, **gap 2**, `overflow:hidden`. Height 15 + 2 + 20 = 37.
  - `LAYER 01` (Label, `--color-fg-muted`).
  - `SNARE` (Item, white).
- **Glyph/Tick:** 1 × 16, white.
- **Content:** fill width, `overflow:hidden`. Its contents depend on the variant.

| Variant | Node | Row height | Content |
|---|---|---|---|
| **Melodic** (bars) | `71:148` | 58 | **Steps** (`71:153`): row, gap 8, `align-items:flex-start`. 8 **Step** cells `Shape=Bar`, each fill × 40. |
| **Percussion** (step dots) | `77:590` | 58 | **Steps** (`77:595`): row, gap 8, `align-items:flex-start`. 8 **Step** cells `Shape=Dot`, each fill × 40. Used in state 1. |
| **Percussion, recorded taps** | `84:590` | 58 | **Taps** (`84:595`): fill × 40, `position:relative`, `overflow:hidden`. Each hit is a **12px `#D9D9D9` circle**, `top:14` (vertically centred), `left` = its time in the loop × content width. Used in state 2. |
| **Score** | `85:677` | **106** | **Staff** (`85:682`): row, `align-items:flex-start`, no gap, `overflow:hidden`. See 5.14. Height 8 + 88 + 8 + 2 = 106. |

- Content width in the panel: 1037 − 2 borders − 32 padding − 140 − 16 − 1 − 16 = **830**.
- Mock tap x positions (left edge, out of 830): 137.70, 268.64, 417.38, 552.51, 694.97.
- The Melodic (bars) variant is in the library but not on any screen. State 2 draws melody with the Score variant (section 10).

### 5.13 Step (`71:39`)

Default 64 × 40; in track rows each step is fill × 40 (about 97 wide at 830 content width).

| Shape | State | Node | Look |
|---|---|---|---|
| Bar | Off | `71:37` | 1px `--color-line` border, radius 8, transparent |
| Bar | On | `71:38` | Fill `#D9D9D9`, radius 8, no border |
| Dot | Off | `77:586` | Centred circle, r 5.25, 1.5px `#6C6C6C` stroke, no fill (`step-dot-off.svg`) |
| Dot | On | `77:588` | Centred filled circle, r 6, `#D9D9D9` (`step-dot-on.svg`) |

The SVG uses `preserveAspectRatio="none"`, so stretching it to a wider cell would turn the dot into an oval. Draw the dot in CSS (12px circle centred in the cell) instead.

### 5.14 Score track and Score step (`85:676`)

A melody layer is drawn as a single staff line of music. Every part is 88 tall.

- **Staff lines:** five 1px `--color-line` lines at **y = 28, 36, 44, 52, 60** (8px apart), spanning `left:0; right:0`. In beat slots they span `right:-0.5` so slots join without gaps. From top to bottom they are F5, D5, B4, G4, E4 (treble clef positions; no clef is drawn).
- **Time signature block** (`85:691`): **36** wide.
  - Staff lines.
  - Barline: 1 × 33 `--color-line` at x 0, y 28.
  - Digits `4` over `4` (Item, white) at left 15; top digit at y 26, bottom digit at y 42.
- **Beat slots** (`85:700` …): 8 equal slots (fill), one per eighth note, counted `1 & 2 & 3 & 4 &`. Each slot is a Score step:
  - Count label at `top:4`, `left: calc(50% − 3px)` (≈ centred), Label style. **White** if the slot has a note, `--color-line` if it's a rest.
  - **Note head:** `note-head.svg` (11 × 8), `left:50%; transform:translateX(-50%)`, `top` = note centre − 4. Note centre y = `60 − 4 × (diatonic steps above E4)`:

    | Note | E4 | F4 | G4 | A4 | B4 | C5 | D5 | E5 | F5 | G5 |
    |---|---|---|---|---|---|---|---|---|---|---|
    | centre y | 60 | 56 | 52 | 48 | 44 | 40 | 36 | 32 | 28 | 24 |
    | head top | 56 | 52 | 48 | 44 | 40 | 36 | 32 | 28 | 24 | 20 |

  - **Stem:** 1.5 × 26, white, `transform:translateX(-50%)`.
    - Notes **below B4** (E4–A4): stem **up**, `left: calc(50% + 4.75px)`, `top` = centre − 26. Example: G4 top 26.
    - **B4 and above**: stem **down**, `left: calc(50% − 5px)`, `top` = centre. Example: C5 top 40, E5 32, G5 24.
  - **Note name** at `top:70`, `left: calc(50% − 8px)` (≈ centred), Label style, `--color-fg-muted` (e.g. `C5`).
  - A **rest** slot has only the staff lines and the count label in `--color-line`. No rest symbol is drawn.
- **End barline** (`85:756`): 6 wide, `overflow:hidden`. Staff lines, plus a 1px white line at x 0 and a 3px white line at x 3, both 33 tall from y 28 (a final double barline).
- Library variants (`Note=`): Rest `85:569`, E4 `85:576`, F4 `85:586`, G4 `85:596`, A4 `85:606`, B4 `85:616`, C5 `85:626`, D5 `85:636`, E5 `85:646`, F5 `85:656`, G5 `85:666`. The library examples all use count `1`.
- Notes outside E4–G5 (SPEC goes from C4 to C7) aren't designed: no ledger lines, no octave marks (section 10).

### 5.15 Playhead (`90:839`)
- Default 12 × 160. Column, `align-items:center`.
- Placed `position:absolute` inside Tracks: `top:3; bottom:0`, so it starts 3px below the top of the ruler and runs to the bottom of the last row.
- **Handle** (`90:840`): `playhead-handle.svg` (12 × 14): a black-filled shield/pin with a 1.2px white outline, pointing down.
- **Line** (`90:842`): fill height, 1px wide, column, `align-items:center`, **gap 4**, `overflow:hidden`. 1 × 4 white dashes (80 in the component, clipped to fit). In CSS: `border-left: 1px dashed` won't match exactly, so use `repeating-linear-gradient(#fff 0 4px, transparent 4px 8px)`.
- **Time label** (`90:923`): `00:00:75`, Label style, white, `position:absolute; left:-68; top:0`. It's shown in the library component but **hidden on the screens**.
- Its `left` = (label 140 + tick 1 + 2 × 16 gaps + 16 row padding + 1 border) + loop progress × content width − 6 (to centre the 12px handle). The mocks use 494 and 516. It moves smoothly with the clock (SPEC step 4).

### 5.16 HUD strip (`71:87`)
- Hug, default 276 × 34.
- Padding 8 / 16, 1px **white** border, radius 8, background `--color-overlay`. Row, **gap 12**.
- Children: Tick · `SESSION 01` (Label, white, **opacity 0.6**, node `101:1196`) · Tick · context label (Label, white, node `71:89`) · Tick. Each Tick is the Glyph/Tick (1 × 16 white).
- Context label: `SETUP / CAMERA` when there are no layers (the library default), otherwise `LAYER 0N / INSTRUMENT` for the active layer.

### 5.17 Object marker (`71:167`)
- Default 180 × 440 (the box the user drew; SPEC 1.2). `position:relative`, no fill, no outline.
- Four `corner-*.svg` brackets (20 × 20, 2px white), pinned to the corners: TL `top:0; left:0`, TR `top:0; right:0`, BL `bottom:0; left:0`, BR `bottom:0; right:0`.
- **Tag** (`71:176`): `position:absolute; top:-32; left:0`. White background, radius 4, padding **4 / 8**, row, `overflow:hidden`. Text: Label style, **black**, `OBJECT · SNARE` (the drum assigned to the object, SPEC 1.2). Tag height 15 + 8 = 23, which leaves a 9px gap above the box.
- SPEC step 22 needs a "lit" look while a hand is inside the box. It isn't designed yet (section 10).

### 5.18 Tap ripple (`71:162`)
- `tap-ripple.svg`, 96 × 96: concentric circles of r 47.25 (white 25%), r 31.25 (white 50%), r 15.25 (white 100%), all 1.5px stroke, plus a filled white centre dot of r 4.
- Shown centred on each detected hit or pinch. Motion isn't designed; a suggested animation is in section 8.

### 5.19 Piano overlay (`74:291`)
- 1039 × **132**, `bottom:15; left:15`. Padding 8, row, **gap 8**, `align-items:flex-start`, background `--color-overlay`, 1px white border, radius 8, `overflow:hidden`.
- Three **octave** blocks (`74:292` C4, `74:306` C5, `74:320` C6): each fill width × full height (116), `position:relative`, `overflow:hidden`. Each is **335.67** wide at 1440 ((1039 − 2 − 16 − 16) / 3).
- In each octave (absolute positions, top 0):
  - **7 white keys:** width **47.952** (octave / 7), height **116**, 1px `--color-key-border` outline, transparent. Lefts: 0, 47.95, 95.90, 143.86, 191.81, 239.76, 287.71.
    - The first key has 4px top-left and bottom-left corners. The last key has 4px top-right and bottom-right corners. The middle keys are square.
  - **5 black keys:** width **26.374** (55% of a white key), height **67.28** (58% of 116), fill `--color-surface`, 2px bottom-left and bottom-right corners, top-aligned. Lefts: **34.77, 82.72, 178.62, 226.57, 274.53**. Each is centred on the C|D, D|E, F|G, G|A and A|B boundaries (white × n − black / 2).
  - Black keys draw above white keys.
  - **Octave label** at `left:8; top:95`: Label style, white (`C4` / `C5` / `C6`).
- **Active key:** fill `--color-key-active` on every white key that is sounding (one per hand, or three for the chord pad). The border stays the same.
- SPEC 3.3 uses white keys only, so the black keys are decorative and never light up. Compute positions as percentages so the overlay scales with the camera width.

### 5.20 Session footer (`71:99`), library only
- Default 289 × 58. Padding 12 / 16, 1px `--color-line` border. Corner radii: top-left 8, top-right 8, bottom-left 8, **bottom-right 24**. Row, **gap 16**.
- Children:
  - Session column (`71:100`): column, gap 2, `overflow:hidden`, all Label style. `SESSION 01` (white) above `4/4 · 120 BPM` (`--color-fg-muted`).
  - Spacer (fill).
  - Tick · `icon-infinity.svg` (20) · `icon-audio-waveform.svg` (20).
- **Not used on any screen.** Don't build it until it's placed.

### 5.21 Glyph/Strip (`71:29`), library only
- 112 × 16, row, gap 8. A 40 × 1 white rule, then `icon-arrow-right.svg`, `icon-chevrons-right.svg` and `icon-circle.svg` (16 each). Decorative; not on any screen.

---

## 6. Component inventory (library frame `71:5`, 3000 × 1058)

| Component | Node | Default size | On screens? |
|---|---|---|---|
| Icon/Chevron down | `71:8` | 16 × 16 | yes |
| Icon/Plus | `71:11` | 16 × 16 | yes |
| Icon/Arrow right | `71:14` | 16 × 16 | no |
| Icon/Chevrons right | `71:17` | 16 × 16 | no |
| Icon/Infinity | `71:21` | 20 × 20 | no |
| Icon/Audio waveform | `71:24` | 20 × 20 | no |
| Icon/Circle | `71:27` | 16 × 16 | no |
| Glyph/Tick | `71:28` | 1 × 16 | yes |
| Glyph/Strip | `71:29` | 112 × 16 | no |
| Step (4 variants) | `71:39` | 64 × 40 each | Dot yes, Bar no |
| Record button | `71:40` | 289 × 40 | yes |
| Select | `71:46` | 289 × 40 | yes |
| Button/Outline upload | `71:52` | 140 × 40 | no |
| Button/Outline plus | `71:57` | 144 × 40 | yes |
| Metronome strip | `71:60` | 289 × 48 | yes |
| Brand badge | `71:73` | 289 × 57 | yes |
| HUD strip | `71:87` | 276 × 34 | yes |
| Session footer | `71:99` | 289 × 58 | no |
| Layer card/Expanded | `71:110` | 289 × 260 | yes |
| Layer card/Collapsed | `71:140` | 289 × 58 | yes |
| Tap ripple | `71:162` | 96 × 96 | yes |
| Object marker | `71:167` | 180 × 440 | yes |
| Icon/Chevron right | `75:337` | 16 × 16 | yes |
| Icon/Record | `75:340` | 20 × 20 | yes |
| Icon/Timer | `75:344` | 20 × 20 | yes |
| Icon/Upload | `75:349` | 16 × 16 | no |
| Track row (3 variants) | `77:604` | 960 × 58 / 58 / 106 | Percussion and Score yes, Melodic no |
| Score step (11 variants) | `85:676` | 64 × 88 each | yes (inside Score) |
| Audio bar (2 variants) | `89:1097` | 289 × 90 each | yes |
| Playhead | `90:839` | 12 × 160 | yes (time label hidden) |
| Download button (2 states) | `96:849` | 289 × 40 each | yes |
| Icon/Sidebar | `96:950` | 24 × 24 | yes |
| Time ruler | `98:830` | 960 × 20 | yes |

---

## 7. Content and copy

- Every string is uppercase. Type it uppercase in the source as well as applying `text-transform`, so the copy matches Figma exactly.
- Separators: ` / ` (space-slash-space) between levels (`LAYER 01 / SNARE`, `SETUP / CAMERA`). ` · ` (space, middle dot U+00B7, space) between attributes (`OBJECT · SNARE`, `4/4 · 120 BPM`).
- Numbers:
  - Layers: two digits with a leading zero (`01`). The card shows the bare number (`01 SNARE`). Track rows and the HUD show `LAYER 01`.
  - Session: `SESSION 01`.
  - Waveform time: `MM:SS` (`00:07`).
  - Ruler and playhead time: `00:00:00` format (meaning unclear, section 10).
- Exact strings from the design:
  - `SETUP`, `LAYERS`, `RECORD`, `ADD LAYER`, `DOWNLOAD`, `METRONOME`, `BPM`, `SET AUDIO`
  - `SESSION 01`, `SETUP / CAMERA`, `LAYER 01 / SNARE`, `LAYER 02 / PIANO`
  - `POINT THE CAMERA AT AN OBJECT, THEN PRESS RECORD`
  - `NO LAYERS YET. RECORD ONE TO START YOUR LOOP.` (ends with a full stop)
  - `OBJECT · SNARE`
  - Octave labels `C4`, `C5`, `C6`. Counts `1 & 2 & 3 & 4 &`.
- Instrument names are uppercase versions of SPEC 1.7 / 3.5: `KICK`, `SNARE`, `CLOSED HI-HAT`, `OPEN HI-HAT`, `CLAP`, `CRASH`, `TOM`, `SHAKER`, `PLUCK`, `PAD`, `SYNTH LEAD`, `PIANO`, `BASS`, `CHORD PAD`. Only `SNARE` and `PIANO` appear in the mocks; check that the long names (`CLOSED HI-HAT`) fit the 140px track label and the select.

---

## 8. Interaction states (not in Figma: defaults until designed)

The file has no hover, focus, pressed, recording or muted states, and no motion. Until the designer provides them, use these minimal defaults, which follow the existing palette and add no new colours:

| Situation | Default treatment |
|---|---|
| Hover on an outline button, select or collapsed card | Border changes from `--color-line` to `--color-fg-muted` |
| Hover on a filled button (Record) | Background `#555` |
| Keyboard focus | 1px white `outline` with 2px `outline-offset` |
| Pressed | `opacity: 0.8` |
| Disabled | The Download-disabled style: `--color-surface` fill, `--color-line` text and icon, `cursor: default` |
| Count-in / recording in progress | Record label changes to `RECORDING` and the red icon pulses (opacity 1 ↔ 0.4, once per beat) |
| Muted layer (SPEC 1.6) | Track row and layer card at `opacity: 0.4` |
| Tap ripple | Scale 0.6 → 1 and fade 1 → 0 over about 400ms, ease-out |
| Card expand / collapse | Instant (no animation) |
| Playhead | Linear, driven by the audio clock, never by CSS transitions |
| Cursor | `pointer` on buttons, selects, card headers, BPM chip and sidebar toggle |

These are placeholders. Replace them when the designer delivers real states.

---

## 9. Implementation notes

- **Stack:** React + plain CSS (CSS modules or one stylesheet plus tokens). **Do not** add Tailwind. The Figma export is Tailwind; translate it.
- **Box model:** set `box-sizing: border-box` everywhere. All sizes in this file include the 1px border.
- **Assets:** copy SVGs from `docs/design/assets/` into `public/icons/` (or import them) when building. Never load from Figma URLs (SPEC 0.2). Keep each SVG's root `width` and `height`.
- **Fonts:** add `@font-face` for the local `.woff2` files with `font-display: block`, so a demo never flashes a fallback font. Fallback stack: `"Space Grotesk", system-ui, sans-serif`.
- **Engine vs UI** (SPEC 0.1): the playhead, waveform playhead and tap ripples must read clock/position from the engine, for example with `requestAnimationFrame` reading `Tone.Transport`, and not from React state updates on every tick.
- **Layout:** build with flexbox as described in sections 3 and 5. Only camera overlays, the object tag and corners, the piano keys, score glyphs, recorded taps and the playhead use absolute positioning.
- **Repeated dots and dashes** (ruler, waveform remaining, playhead line): Figma uses dozens of separate nodes. In code, draw them with a `repeating-linear-gradient` or a single SVG pattern; the visual result must match the size and gap values above.
- The mock's camera image (a classroom with a water bottle) is a placeholder; render the live webcam there.

---

## 10. Open questions and gaps (ask the human before deciding)

These are differences between the Figma file and SPEC, or SPEC features with no design yet. **Do not resolve these on your own.**

1. **BPM default:** the mock shows `120`; SPEC 2.4 requires **128**. *Assumption: show the live tempo, default 128.*
2. **Ruler and playhead labels** (`00:00:00`, `00:00:50`, `00:01:00`, `00:01:50`, `00:00:75`) don't match any real unit for a 1–4 bar loop at 128 BPM. Should the ruler show bar.beat (`1.1`, `1.3`, `2.1`, `2.3`) or seconds?
3. **Step resolution:** track rows show **8 steps** (eighth notes), but SPEC snaps to **16th notes** (a 2-bar 4/4 loop has 32 steps). Should the number of steps follow loop length × 16, or stay at 8 and group?
4. **Two percussion views:** state 1 uses the step-dot grid and state 2 uses free-positioned "recorded taps". Which one is the final design? Do both apply, e.g. taps before snapping and dots after?
5. **Melody display:** the score only covers E4–G5 and eighth notes. SPEC plays C4–C7 in 16ths. How should notes outside that range, held notes (lengths over one step), chords (chord pad) and the bass (2 octaves down) be shown?
6. **Layers panel overflow:** two layers already fill the 200px content area (state 2). What happens with 3 or more layers: scroll, shrink rows, or a taller panel?
7. **Missing SPEC controls with no design:**
   - Mute / unmute and delete per layer (1.6), and the undo and retake affordances (1.6, step 17).
   - Time signature, loop length, key (2.1). Only BPM is designed.
   - Metronome on/off and volume, count-in (2.2). The metronome strip only has BPM.
   - Sensitivity slider and camera-confirmation toggle (1.4).
   - Mic lag check and camera lag check screens (2.5, 3.8).
   - Mic level meter (step 10) and live hit flash (step 11).
   - Load project file (step 18). Only Download is designed.
   - The count-in display and beat/bar readout (step 4).
8. **Melody guide (SPEC 3.9):** column borders over the camera, note names on fingertips, the current note shown large, and the selected instrument aren't designed. The piano overlay partly covers this.
9. **Object marker "hand inside" highlight** (step 22) isn't designed.
10. **Sidebar toggle:** the icon exists, but the collapsed-sidebar layout doesn't.
11. **ADD LAYER vs RECORD:** what does ADD LAYER do before recording? Does it create an empty layer with an instrument picker, or start the object-box flow?
12. **State 1 mock inconsistency:** the sidebar lists `02 PIANO`, but the layers panel shows only layer 01.
13. **Fonts:** Space Grotesk (OFL) and Clash Display (Fontshare licence) have to be downloaded once and committed. Confirm the Clash Display licence is fine for the project.
14. **Unused library parts:** Session footer, SET AUDIO button, Glyph/Strip, Bar-shape steps, the playhead time label. Keep them for later, or drop them?
15. **Smaller screens:** only 1440 × 1024 is designed. What should happen on a smaller demo laptop (for example 1280 × 800)? Scale everything, or let the camera shrink?
