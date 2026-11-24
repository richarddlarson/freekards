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
  The per-game details are in each game's spec (Hearts: `06-hearts.md` §5).

## Personality
Each character has traits that affect **what they say** and, slightly, **how they play**:
- `chattiness` (0–1): how often they comment.
- `tone`: such as cheerful, grumpy, dry, competitive, or motherly.
- `risk` (0–1): play style, such as how readily they attempt to shoot the moon in Hearts or hit in Blackjack.

## Dialogue
- Dialogue is data: one JSON file per character, mapping **dialogue triggers** (below) to lists of
  lines. Every line has a stable id of the form `<characterId>.<trigger>.<n>`.
- Each line id maps to one pre-generated voice clip (D-005, D-048) at
  `assets/voices/<characterId>/<lineId>.opus`. A missing clip simply means a silent bubble.
- While a clip plays, the bubble stays up for max(2.5 s, clip + 0.6 s) and music is ducked (spec 13 §1).
  Tapping the bubble closes it and stops the clip.
- A comment is shown in a speech bubble next to the character's portrait, and its clip plays at the
  same time.

### Tone rules (apply to all writing)
- Funny, warm, and family-friendly. Teasing is gentle and never mean, crude, or insulting to the
  player. Characters make fun of themselves most of all.
- Humor comes from personality (grumpy, pompous, overconfident, and so on), never from mocking
  ethnicity, religion, disability, body type, or similar.
- Lines stay short enough to read in a bubble and to speak in about 5 seconds or less: at most 120
  characters, ideally under 80.
- Running jokes (Gus's goose, Bernie's cousin Darlene, Reginald's ancestors) are encouraged.

### Triggers [Confirmed] (implemented, D-036)
A trigger is `<scope>.<event>.<perspective>`, or `<scope>.<event>` where perspective doesn't apply.
**Perspective** is relative to the speaking character: `self` (it happened to the speaker),
`human` (it happened to the human player), or `other` (it happened to another computer player).

| Trigger | Fires when | Weight |
|---------|-----------|--------|
| `game.start` | A new game begins | 0.5 |
| `game.won.self` / `.human` / `.other` | Game over; the winner relative to the speaker | 1.0 |
| `hand.good.self` / `.human` | That player scored the fewest points this hand (Hearts) or otherwise did best | 0.3 |
| `hand.bad.self` / `.human` | That player scored the most points this hand | 0.4 |
| `idle.human` | The human has not acted for 20 s on their turn (at most once per 60 s) | 0.6 |
| `hearts.queen_taken.self` / `.human` / `.other` | `queen_of_spades_taken` | 1.0 |
| `hearts.queen_given.self` | The speaker played Q♠ onto a trick won by someone else | 0.7 |
| `hearts.hearts_broken.self` / `.other` | `hearts_broken` (`.other` covers the human too) | 0.3 |
| `hearts.jack_taken.self` / `.human` | `jack_of_diamonds_taken` (J♦ rule set) | 0.6 |
| `hearts.moon_shot.self` / `.human` / `.other` | `moon_shot` | 1.0 |
| `hearts.moon_blocked.self` / `.human` | `moon_shot_blocked`, from the near-shooter's side | 0.8 |
| `hearts.moon_block.self` | `moon_shot_blocked`, where the speaker was the blocker | 0.8 |
| `hearts.pass.received` | After the pass exchange, the speaker received cards from the human | 0.2 |

Later games add their own `<game>.*` triggers. A character with no lines for a trigger stays silent.

### Who speaks [Confirmed] (implemented, D-036)
1. When a logic event happens, collect every computer character with lines for the matching
   trigger. A character with a `self` trigger is preferred over the others.
2. Candidates are grouped by weight and the groups are tried from highest to lowest. Within a group,
   each candidate rolls and speaks if `random < chattiness × weight`. If several succeed, one is chosen
   at random, preferring those with a `.self` trigger. If none succeed, the next lower group is tried.
3. **Only one character speaks at a time.** After a bubble closes there is a **6 s table cooldown**
   before the next comment. Triggers with weight 1.0 skip the cooldown, but still wait for the
   current bubble to finish.
4. The chosen line is picked at random from that trigger's lines, avoiding the speaker's last 3 lines.
5. **Bubble duration** = max(2.5 s, clip length + 0.6 s). With voices off it is
   2.5 s + 50 ms per character of text, at most 7 s. Tapping a bubble closes it early.
6. Comments never pause or slow down the game logic. The presentation shows them alongside play.

## Character data
- **Canonical location:** `spec/content/characters/` (D-031). There is one `<id>.json` per character,
  plus `roster.json`, which lists the ids in display order. Runtimes load these files directly;
  they are not copied elsewhere.
- **Schema** (`schemaVersion: 1`):

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Stable lowercase id; used in line ids, file names, and portrait paths |
| `name`, `nickname` | string | Display name, and the short name shown at the table |
| `kind` | string | `human` for now. Reserved for future non-human characters (animals, robots, and so on) |
| `gender` | string | `male` / `female` (and others later); used to choose voices |
| `ageRange` | string | For portrait art and voice selection |
| `tagline` | string | One line shown on the opponent picker |
| `bio` | string | A short paragraph shown in the character's details |
| `look` | string | Art brief for portraits (any theme) |
| `traits.tone` | string | Personality summary |
| `traits.chattiness`, `traits.risk` | 0–1 | See Personality above |
| `traits.skillAdjust` | −0.15…+0.15 | See Difficulty model above |
| `voice.description`, `voice.pitch`, `voice.pace` | string | Brief for choosing or tuning the text-to-speech voice |
| `voice.tts` | object, optional | The chosen synthetic voice (D-048): `engine` (`piper`), `model` (Piper voice name), optional `speaker` (multi-speaker models), `lengthScale` (pace, >1 slower), optional `noiseScale`. With no `tts`, the character has no voice clips |
| `lines` | object | trigger → array of `{ id, text }` |

## Roster (D-030)
The first six characters are all human: three men and three women, each with a comedic personality.
More characters, including non-human kinds, will be added later with input from the main player.

| Id | Name ("nickname") | Gender | Personality | Chattiness | Risk | Skill adj. |
|----|-------------------|--------|-------------|-----------|------|-----------|
| `gus` | Gus Pettigrew ("Grumbles") | M | Grumpy retired mail carrier, sure the deck is rigged, secret softie | 0.60 | 0.30 | +0.10 |
| `dot` | Dolores Finchley ("Dot") | F | Sweet knitting grandma, polite and utterly ruthless | 0.55 | 0.60 | +0.15 |
| `chad` | Chad Brightwater ("Coach") | M | Overconfident life coach, sports-announcer self-narration, loses often | 0.80 | 0.90 | −0.15 |
| `marguerite` | Prof. Marguerite Quill ("The Professor") | F | Absent-minded probability professor who loses her glasses (on her head) | 0.65 | 0.20 | +0.05 |
| `bernie` | Bernadette Kowalski ("Bernie") | F | Chatty diner waitress, calls everyone "hon", tells stories about cousin Darlene | 0.90 | 0.50 | −0.05 |
| `reginald` | Reginald Fairweather III ("Reggie") | M | Pompous self-declared near-aristocrat, monocle, very sore loser | 0.70 | 0.40 | 0.00 |

Full bios, art briefs, voice briefs, and every line are in each character's JSON file.

## Voices (D-047, D-048)
Chosen by the owner from auditions. All models qualify under D-047.

| Character | Piper voice | Speaker | Pace (lengthScale) | Data license / credit |
|-----------|-------------|---------|--------------------|-----------------------|
| Gus | en_US-john-medium | — | 1.15 | Public domain (LibriVox) |
| Dot | en_GB-cori-high | — | 1.10 | Public domain (LibriVox) |
| Chad | en_GB-vctk-medium | p345 | 0.85 | CC BY 4.0 (VCTK, CSTR, University of Edinburgh) |
| Marguerite | en_GB-alba-medium | — | 0.95 | CC BY 4.0 (University of Edinburgh) |
| Bernie | en_GB-vctk-medium | p225 | 0.90 | CC BY 4.0 (VCTK, CSTR, University of Edinburgh) |
| Reginald | en_GB-vctk-medium | p273 | 1.00 | CC BY 4.0 (VCTK, CSTR, University of Edinburgh) |

Chad needed a second audition round (10 more candidates, mostly North American VCTK speakers).
Rejected during auditions: hifi_tts_92 for Marguerite, because it was trained on the same reader as
Dot's cori voice, so the two would sound alike.
