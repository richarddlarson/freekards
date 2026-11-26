# 10 — Core Logic Conventions (core spec, engine-neutral)

Status: **[Confirmed]** (D-022, D-023). These conventions are shared by every game. A port to
another runtime must reproduce them exactly, so that saved games, seeds, and test vectors stay compatible.

## 1. Cards
- A card is identified by a two-character id: **rank character + suit character**.
  - Rank characters: `2 3 4 5 6 7 8 9 T J Q K A`, with numeric ranks 2–14 (ace high unless a game says otherwise).
  - Suit characters: `C` clubs, `D` diamonds, `S` spades, `H` hearts.
  - Examples: `QS` = Queen of Spades, `TD` = Ten of Diamonds, `2C` = Two of Clubs.
- The same ids name card-face image files in themes (spec 07).
- **Canonical deck order** (before shuffling): suits in the order C, D, S, H; within each suit 2 → A.
  Index 0 = `2C`, index 51 = `AH`.
- **Display sort** for a face-up hand (D-065): grouped by suit in the order **H, S, D, C**, left to
  right (♥ ♠ ♦ ♣: colors alternate red, black, red, black, and the suits that matter most in Hearts
  come first), ascending rank within each suit. It is separate from the canonical deck order above,
  which stays C, D, S, H so seeded deals don't change. The player's **Card order** setting
  (spec 16 §2, D-054) can make it descending within each suit; the suit groups never move.

## 2. Seats
- 4-player games use seats 0–3 in **clockwise play order**:
  0 = South (always the human), 1 = West, 2 = North, 3 = East.
- "Next player" = seat + 1 (mod 4). The player to your **left** is the next player clockwise.
- **2-player games** (Gin Rummy, Rummy 500) use players 0 (the human) and 1 (the computer), who
  sits at the top of the table. Play alternates; "next player" = 1 − player.
- In partnership games (Spades), partners sit across: seats 0 + 2 are team 0 (the player's team),
  seats 1 + 3 are team 1 (team = seat mod 2).

## 3. Random numbers (determinism)
- All randomness comes from a **seeded Mulberry32** generator, whose whole state is one unsigned
  32-bit integer. One step:
  ```
  state  = (state + 0x6D2B79F5) mod 2^32
  t      = state
  t      = imul32(t XOR (t >>> 15), t OR 1)
  t      = t XOR (t + imul32(t XOR (t >>> 7), t OR 61))      (32-bit wraparound)
  value  = ((t XOR (t >>> 14)) as unsigned 32-bit) / 2^32    in [0, 1)
  ```
  Test vector: starting from state 0, the first two values are `0.26642920868471265` and
  `0.0003297457005828619`.
- `int(n)` = floor(value × n).
- **Shuffle** = Fisher–Yates: for i from (length − 1) down to 1, j = int(i + 1), swap items i and j.
- A game's shuffle generator state is part of the saved game state. Each computer player has its
  **own** generator, seeded separately, so its decisions don't disturb the shuffle sequence.

## 4. Logic layer shape
- Each game is a **pure state machine**: `apply(state, action) → (new state, events)`.
  - The state is plain data (serializable for save games). The input state is never modified.
  - An illegal action is rejected with a rule error and changes nothing.
  - Events (each game's spec lists them) drive presentation: animation, sound, and dialogue.
- Presentation never changes the game state directly. It only submits actions.
- Computer players are separate objects that read the state (public information plus their own
  hand only) and return an action.
