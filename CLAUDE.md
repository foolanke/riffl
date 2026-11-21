# Rules for agents

- Read `docs/SPEC.md` before doing anything. It is the source of truth.
- The demo goal is a near-perfect live rebuild of I Gotta Feeling (Black Eyed Peas). When choosing sounds or defaults, pick what makes that song sound closest to the original.
- Never change `docs/SPEC.md` or this file. If the spec is unclear or seems wrong, stop and ask the human.
- Build one feature at a time. When it's done, stop and tell the human exactly how to test it. Do not start the next feature until the human says the current one passes.
- Keep code plain and readable: TypeScript, explicit loops, clear names, short comments explaining why.
- Follow the offline rule (SPEC 0.2): no runtime loading from the internet.
- Run `git pull` before starting any task. After a feature passes, commit with a clear message and `git push`.
