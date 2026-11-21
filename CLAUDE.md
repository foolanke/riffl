# Rules for agents

- Read `docs/SPEC.md` before doing anything. It is the source of truth.
- The demo goal is a near-perfect live rebuild of I Gotta Feeling (Black Eyed Peas). When choosing sounds or defaults, pick what makes that song sound closest to the original.
- Read `docs/design.md` before creating or changing any UI component. It is the source of truth for how the UI looks (tokens, layout, components, copy). SPEC wins on behaviour, design.md wins on visuals. Use the SVGs in `docs/design/assets/` as-is, and never resolve the open questions in design.md section 10 on your own: ask the human.
- Two pages, one engine. The designed app is at `/` (`index.html` → `src/ui/app/`); build all designed UI there. The test page is at `/test.html` (`test.html` → `src/main.tsx` → `src/ui/App.tsx` and its panels). Keep the test page untouched and working at all times: never edit `test.html`, `src/main.tsx` or the test page's components in `src/ui/*.tsx`. Engine changes (`audio/`, `vision/`, `project/`) must be additive and must not change how the test page behaves. Both pages share the same auto-saved project.
- Never change `docs/SPEC.md`, `docs/design.md` or this file. If the spec or design is unclear or seems wrong, stop and ask the human.
- Build one feature at a time. When it's done, stop and tell the human exactly how to test it. Do not start the next feature until the human says the current one passes.
- Keep code plain and readable: TypeScript, explicit loops, clear names, short comments explaining why.
- Follow the offline rule (SPEC 0.2): no runtime loading from the internet.
- Run `git pull` before starting any task. After a feature passes, commit with a clear message and `git push`.
