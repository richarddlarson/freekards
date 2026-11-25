# 12 — Screens and the Hearts Table (core spec, engine-neutral)

Status: **[Confirmed]** first playable version (D-035, D-036). Values are implemented in the
engine-neutral layout module and may be tuned after play-testing. Any tuning is recorded here.

All coordinates are logical units on the reference table (spec 11): 1920×1280, origin top-left,
positions are element **centers**. `W` and `H` are the window's logical width and height (W ≥ 1920,
H ≥ 1280; extra space appears on wide or tall windows). `cx = W/2`, `cy = 0.46·H`.

## 1. Screen flow
```
Main menu ──Play Hearts──▶ Hearts setup ──Deal!──▶ Hearts table ──game over──▶ Game-over dialog
    ▲                        │ Back                  │ ☰ menu                     │ Play again → new table, same settings
    └────────────────────────┴───────────────────────┴── Main menu ───────────────┘
```
- **Main menu:** the "FreeKards" title, tagline "Classic card games with friendly faces", a large
  **Play Hearts** button, a 2-column grid of the other six games marked *coming soon* (disabled),
  and, along the bottom, **Sound** (opens the Sound panel, spec 13), **Settings** (the player's
  Settings panel, spec 16), and **Quit** (closes the app).
- **Hearts setup** (one panel):
  - **Rules:** Standard | Jack of Diamonds −10 (D-008).
  - **Difficulty:** Easy | Medium | Hard (D-010).
  - **Opponents:** a grid of every roster character (portrait, nickname, full name, tagline).
    Tapping a character adds them to the next free seat, in the order West → North → East, and the
    tile shows that seat. Tapping again removes them. At most 3 can be chosen. **Random** clears the
    selection and picks 3 at random when the game starts.
  - **Back** | **Deal!** (Deal! is disabled unless Random is selected or exactly 3 are chosen).
  - The choices are remembered for next time (§5).

## 2. Table layout
| Element | Position / size |
|---------|-----------------|
| Card | 183 × 256 at scale 1 (height = 20% of the reference table; D-061) |
| South hand (human) | face up, full size, bottom edge 40 from the bottom, centered on `cx`. Spacing = (min(1300, W − 480) − 183) / (n − 1), clamped to 60…80 |
| Selected or just-received card | lifted 44 |
| North hand | face down, scale 0.45 (about 82 wide), spacing 26, top edge 40 from the top, centered on `cx` |
| West / East hands | face down, scale 0.45, rotated 90° / 270°, spacing 26, centered vertically on `cy`, 40 from the left / right edge |
| Portraits (diameter 140, with a nameplate below) | North (cx − 330, 120); West (250, cy − 140); East (W − 250, cy − 140) |
| "You" nameplate | vertically level with the South hand, 80 to the left of where a full 13-card hand would begin |
| Trick slots (full size, **upright**, ±4° random tilt) | South (cx, cy + 140); West (cx − 195, cy); North (cx, cy − 140); East (cx + 195, cy) |
| Deck (dealing origin) | (cx, cy) |
| Won tricks fly toward | South (cx, H + 256); West (−256, cy); North (cx, −256); East (W + 256, cy), shrinking to 0.45 and fading out |
| Score panel | top-right corner, 40 from the edges, 330 wide |
| Menu button (☰) | 72 diameter, top-left, 40 from the edges |
| Action button (Pass) | (cx, South card top − 44 − 60) |
| Center message | (cx, cy) |
| Toast | (cx, cy − 290) |
| Speech bubble | beside the portrait toward the table center (West and North open to the right, East to the left), 88 from the portrait center, max width 440 |

Trick cards stay upright regardless of who played them, so the player never has to read a rotated card.

## 3. Timing and animation (milliseconds)
| What | Value |
|------|-------|
| Deal: one card at a time, clockwise from West, each starting 30 after the previous | flight 260, easing ease-out (cubic-bezier 0.22, 1, 0.36, 1) |
| Pause before the first deal | 400 |
| Computer "thinking" before a play | random 550–950 (× Game speed, spec 16 §4) |
| Card flight to the trick | 280 (the player's own card: per Card response, spec 16 §3) |
| Hand closes up after a play | 220 (the player's own hand: per Card response) |
| Completed trick stays visible | 900 (× Game speed) |
| Trick collected | 420, ease-in |
| Pass exchange flight | 520; received cards stay lifted for 1400, then settle in 220 |
| Human idle before an `idle.human` comment | 20 000, then at most every 60 000 |
| Toasts | 1800 (Queen/Jack: 2200; moon shot: 3000) |

All card images are loaded and decoded before the first deal, so flips never show a stale image.

## 4. Interaction
- **When a tap counts** (on release or on press), drag to play, and the player's own card timings
  all follow the player's **Card response** setting (spec 16 §3). The default, Standard, is
  described here.
- **Passing:** the center message says "Choose 3 cards to pass to the left/right/across". Tapping a
  card lifts or lowers it. A 4th tap on an unlifted card shakes it. **Pass ←/→/↑** is enabled only when
  exactly 3 cards are lifted. After the exchange, the 3 received cards appear lifted briefly.
- **Playing:** on her turn, the "You" nameplate glows and cards that can't legally be played are
  dimmed (brightness 60%). **A single tap plays a legal card**, or the player can **drag** a legal
  card up onto the table (spec 16 §3). Tapping an illegal card shakes it (240 ms) and does nothing else.
- **Esc key** (D-058), for players with a keyboard: with no dialog open, it opens the pause menu
  (the same as ☰). While paused, it resumes, or, when Sound or Settings is open on top of the
  pause menu, it closes that panel (the same as its Done button). It does nothing on the Hand results
  and Game over dialogs. Holding the key down doesn't repeat.
- **Turn indicator:** the active computer player's portrait glows, and the active player's name is
  highlighted in the score panel.
- **Toasts** (short center notices) for: hearts broken, Queen of Spades taken, Jack of Diamonds
  taken (J♦ rule set), and shooting the moon.
- **Speech bubbles** follow spec 08. Tapping a bubble closes it early.
- **Score panel:** title (with "J♦ −10" when that rule set is used), then for each player: name,
  points taken this hand, and game total. A footer shows "Hand N · Pass ←" during passing, else
  "Hand N · to 100".
- **Placeholder portraits** (until portrait art exists): a circle with a two-color radial gradient
  unique to each character and the first letter of their nickname (ignoring a leading "The").

## 5. Remembered preferences
The player's settings (spec 16) live in the profile too. Rule set, difficulty, and the opponent choice (three ids, or Random) are saved **in the active
profile** (spec 15) when **Deal!** is pressed, and restored on the setup screen. Sound levels, Mute all, and the music track choice are
saved as soon as they change (spec 13). If stored preferences are missing or unreadable, the
defaults are used: Standard, Medium, Random.

## 6. Dialogs
Dialogs dim the table (45% black) and sit 150 below the center, so speech bubbles, which stay on top,
don't cover them.
- **Hand results:** "Hand N results", an optional "X shot the moon!" note, a table of
  player / this hand (+points) / total, and a **Next hand** button (or **Final results** if the game
  is over).
- **Game over:** "You win!" or "<Nickname> wins!", the final standings sorted by score, the
  KardCoins award (spec 15 §3), and the buttons **Play again** (same settings, new deal) and
  **Main menu**.
- **Pause (☰ or Esc):** **Resume**, **Sound** (spec 13), **Settings** (spec 16), **New game**, and **Main menu**. The game is paused while it's open.

## 7. Not yet implemented
Portrait art, the About & Credits screen, saving a game in progress, and other themes.
