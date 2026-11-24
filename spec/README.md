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

Later documents get the next free number. Planned ones include architecture, the rules for each game,
characters and dialogue, art and audio, and build and release.

## Conventions

- Markdown only, so the spec is readable in plain text and diffs cleanly in git.
- Numbered prefixes (`NN-name.md`) set the reading order.
- When a decision overrides an earlier one, the earlier entry in `02-decisions.md` is marked
  **Superseded by D-xxx** and left in place rather than deleted.
