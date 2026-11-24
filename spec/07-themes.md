# 07 — Themes (core spec, engine-neutral)

Status: architecture **[Confirmed]** (D-009). Details **[Proposed]**.

## Concept
A **theme** is a self-contained bundle of visual (and optionally audio) assets plus a JSON manifest.
The game draws everything visual through the active theme and never hard-codes an asset. The player
chooses a theme in Settings, and the change takes effect immediately.

## What a theme provides
- Card faces: 52 cards, plus optional jokers for future games.
- Card backs: one or more; the player picks one.
- Table surface (felt or background) and the border or trim around it.
- Interface look: buttons, panels, dialogs, score sheet, and speech-bubble style.
- Fonts and a color palette.
- Character portraits: one per roster character, with a few expressions (neutral, happy, annoyed, smug).
  If a theme has no portrait for a character, the default theme's portrait is used.
- Optional: theme-specific music and sound effects. Without them the default audio set is used.

## Manifest (draft schema)
```json
{
  "id": "classic-casino",
  "name": "Classic Casino",
  "version": 1,
  "cards": { "faces": "cards/faces/{rank}{suit}.svg", "backs": ["cards/backs/red.svg", "cards/backs/blue.svg"],
             "aspect": 0.714 },
  "table": { "surface": "table/felt.png", "trim": "table/trim.png" },
  "palette": { "primary": "#…", "accent": "#…", "text": "#…", "bubble": "#…" },
  "fonts": { "ui": "fonts/…", "score": "fonts/…" },
  "portraits": "portraits/{characterId}/{expression}.png",
  "audio": { "music": null, "sfx": null }
}
```
`{rank}` is one of `A 2–9 T J Q K`. `{suit}` is one of `S H D C`.

## Planned themes
1. **Classic Casino** (first): green felt, traditional card faces, wood and brass trim, realistic portraits.
2. **Bright Illustrated** (after basic gameplay works): cheerful, flat, cartoon style.
