# FreeKards Specification

FreeKards is a desktop card-game collection for Windows and Linux, on both x64 and ARM64. It replaces
a 2012 Hoyle Card Games title that will not run on ARM-based Windows tablets.

**The rule for this folder:** `/spec` is the single source of truth. If everything else in the repo were
lost, someone should be able to rebuild the app from these documents alone. Every decision about
look, feel, behavior, build, packaging, install, runtime, or development process goes here.

## Document index

| File | Purpose |
|------|---------|
| [00-provenance.md](00-provenance.md) | The original kick-off prompt, kept verbatim. Never edited. |
| [01-requirements.md](01-requirements.md) | What the app must do: goals, platforms, games, features. |
| [02-decisions.md](02-decisions.md) | Decision log, one numbered entry per decision, with the reasoning. |
| [03-open-questions.md](03-open-questions.md) | Questions not yet answered. Each moves to the decision log once answered. |
| [04-process.md](04-process.md) | How work on this project is done, including the rules the AI assistant follows. |
| [05-portability.md](05-portability.md) | How the spec is split into engine-neutral core documents and runtime files. |
| [06-hearts.md](06-hearts.md) | Hearts rules, phases, events, and AI. |
| [07-themes.md](07-themes.md) | Theme system and theme manifest. |
| [08-characters.md](08-characters.md) | Character roster, personality, difficulty model, and dialogue. |
| [09-licensing-and-sbom.md](09-licensing-and-sbom.md) | MIT license, third-party license policy, SBOM, and Credits screen. |
| [runtimes/electron.md](runtimes/electron.md) | Electron-specific stack, packaging, installers, and CI. |

Every document except those in `runtimes/` is **engine-neutral** (see 05). Later documents get the
next free number. Planned ones include architecture, Hearts rules and AI, characters and dialogue,
art and audio, and screen flow and layout.

## Conventions

- Markdown only, so the spec is readable in plain text and diffs cleanly in git.
- Numbered prefixes (`NN-name.md`) set the reading order.
- When a decision overrides an earlier one, the earlier entry in `02-decisions.md` is marked
  **Superseded by D-xxx** and left in place rather than deleted.
