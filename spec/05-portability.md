# 05 — Portability: Engine-Neutral Spec Structure

## Goal
FreeKards may be rebuilt on other runtimes later (for example Godot). Trying out different
runtimes is one of the owner's stated goals (D-004). The spec is therefore split into two layers:

1. **Core spec (engine-neutral):** everything about *what* the app is and does. Game rules, AI
   behavior, characters and dialogue, screen flow, layout, animation timing, audio behavior,
   settings, save data, and the asset catalog.
2. **Runtime specs (`spec/runtimes/<runtime>.md`):** everything about *how* one particular runtime
   implements the core spec. Language, frameworks, project layout, build tooling, packaging,
   installers, CI, and runtime-specific workarounds.

A port to a new runtime means writing a new `spec/runtimes/<new>.md` and implementing the unchanged
core spec. If a port uncovers something the core spec left unclear, the fix goes into the core spec,
not the runtime file.

## Rules for writing core spec documents
- **No runtime vocabulary.** Do not mention DOM, CSS, React, Electron, Node, GDScript, or scene trees.
  Describe behavior, not implementation.
- **Rules as state machines.** Each game is specified as phases, legal actions in each phase,
  transitions, and scoring, precise enough to write a rules engine from without guessing.
- **AI as heuristics in plain language or pseudocode.** For example: "When void in the led suit,
  discard the Queen of Spades if held; else the highest heart; else the highest card."
- **Numbers, not adjectives.** Animation durations in milliseconds, easing named by standard curve
  (ease-out cubic and so on), layout in proportions of the table area (e.g. "south hand centered,
  bottom edge at 96% of table height"), and audio levels in dB or 0–1 gain.
- **Data in neutral formats.** Dialogue lines, character definitions, and the asset catalog are
  JSON (or YAML) files whose schemas are documented in the spec, so any engine can load them as-is.
- **Canonical content data** (characters, dialogue) lives in `spec/content/` and is loaded by
  every runtime directly (D-031).
- **Assets are shared.** Card art (SVG masters plus PNG exports), sound effects, music, and voice clips
  live in a runtime-neutral `assets/` tree, and the core spec documents them.

## Implementation guidance (applies to every runtime)
- Keep **game logic** (rules, scoring, AI, dialogue triggers) separate from **presentation**
  (rendering, animation, audio playback, input). The logic layer has no dependency on the UI or the
  runtime and is driven only by actions and events.
- The logic layer emits **events** (e.g. `card_played`, `trick_won`, `queen_of_spades_taken`,
  `moon_shot`). Presentation reacts to those events with animation, sound, and character comments.
  The event list is part of the core spec.
- Game logic is deterministic given a random-number seed, so tests and bug reports can be replayed exactly.

## Current runtime files
| Runtime | File | Status |
|---------|------|--------|
| Electron | [runtimes/electron.md](runtimes/electron.md) | Active (first implementation) |
