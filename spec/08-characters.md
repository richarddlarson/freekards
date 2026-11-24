# 08 — Characters and Difficulty (core spec, engine-neutral)

Status: model **[Confirmed]** (D-010). Numbers and roster **[Proposed]**.

## Difficulty model
- A global **baseline**, chosen by the player in Settings and on the game setup screen:
  Easy = 0.30, Medium = 0.55, Hard = 0.80.
- Each character has a **skill adjustment** between −0.15 and +0.15.
- **Effective skill** = clamp(baseline + adjustment, 0.05, 0.98).
- Each game's AI uses effective skill to decide:
  - how often it picks its best-evaluated move instead of a plausible weaker one;
  - how much it remembers (for example, counting which cards have been played);
  - how far ahead it plans (for example, spotting or blocking a shoot-the-moon attempt).
  The per-game details are in each game's spec.

## Personality
Each character has traits that affect **what they say** and, slightly, **how they play**:
- `chattiness` (0–1): how often they comment.
- `tone`: such as cheerful, grumpy, dry, competitive, or motherly.
- `risk` (0–1): play style, such as how readily they attempt to shoot the moon in Hearts or hit in Blackjack.

## Dialogue
- Dialogue is data: one JSON file per character, mapping game events (see each game's event list) to
  lists of lines. A line is picked at random, avoiding recent repeats.
- Every line has an id, and each id maps to a pre-generated voice clip (D-005).
- A comment is shown in a speech bubble next to the character's portrait and its clip plays at the
  same time. Only one character speaks at a time, and a global cooldown keeps the table from
  getting too chatty.

## Roster
To be decided: 6–8 original characters (names, looks, personalities, skill adjustments, voices).
