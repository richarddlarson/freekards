# 06 — Hearts (core spec, engine-neutral)

Status: rules **[Confirmed]** (D-008). Engine details **[Confirmed]** (D-024). AI **[Confirmed]**
basic version (D-025), with tuning expected. Dialogue hooks **[Draft]**.
Shared conventions (card ids, seats, random numbers, state-machine shape) are in `10-core-logic.md`.

## 1. Players and deck
- 4 players: the human (South, seat 0) and 3 computer opponents (West 1, North 2, East 3), playing
  clockwise (South → West → North → East).
- A standard 52-card deck. Rank, high to low: A K Q J 10 9 8 7 6 5 4 3 2. No trump suit.

## 2. Rule sets (picked on the setup screen; D-008)
| Rule | Standard | Standard + J♦ |
|------|----------|---------------|
| Each heart | +1 | +1 |
| Q♠ | +13 | +13 |
| J♦ | 0 | **−10** |
| Shoot the moon | All 13 hearts + Q♠ | Same (J♦ not required) |

Settings shared by both rule sets:
- **Game end:** after a hand in which any player reaches **100 or more**. The lowest score wins.
  If two or more players tie for lowest, play further hands until there is a single lowest score.
  The Hand results dialog then says so (D-100), e.g. "The Professor has 106, but Coach and Grumbles
  are tied for lowest (60), so play continues." (players at or over the target with their scores, then
  the tied players and the tied score; the player is "You have …").
  The target score is a game option, 100 by default.
- **Passing cycle:** hand 1 left, hand 2 right, hand 3 across, hand 4 no pass, then repeat.
  Left = the next seat clockwise, right = the previous seat, across = two seats away.
  Each player chooses 3 cards to pass. All passes are revealed at the same time once every player
  has chosen.
- **Shoot the moon:** taking all 13 hearts **and** Q♠ in one hand. The shooter scores 0 for the
  hand and every other player gets +26. In the J♦ rule set, the J♦'s −10 still counts for whoever
  took it, including the shooter (shooter −10, or a non-shooter 26 − 10 = 16).

## 3. Phases (state machine)
1. `setup` (presentation only): the player chooses a rule set and opponents (see 08). The logic
   layer starts at `deal` with all scores 0.
2. `deal` (action `deal`): shuffle with the game's generator and deal 13 cards to each player, one
   at a time clockwise, starting with West. Card *i* of the shuffled deck goes to seat (1 + *i*) mod 4.
   Then go to `pass`, or straight to `play` on a no-pass hand.
3. `pass` (action `pass(seat, 3 cards)`, skipped on no-pass hands): each player selects exactly 3
   different cards from their own hand, once. When all four have chosen, the exchange happens.
4. `play` (action `play(seat, card)`): 13 tricks. Only the seat whose turn it is may play.
   - The holder of 2♣ (after passing) leads the first trick, and must lead the 2♣.
   - Players must follow the led suit if they can. Otherwise they may play any card, with two exceptions:
   - **First trick:** no hearts and no Q♠ may be played, *unless* the player holds nothing else
     that is legal (only hearts and/or Q♠). In that case any of those cards may be played.
     The J♦ is **not** restricted on the first trick, since it is not a penalty card.
   - **Leading hearts:** hearts may not be led until hearts are "broken" (a heart has been played
     on an earlier trick), *unless* the leader holds only hearts.
   - Playing Q♠ does **not** break hearts.
   - The highest card of the led suit wins the trick. The winner collects it and leads next.
5. `score` (entered automatically after trick 13): count points, apply shoot-the-moon, and add to
   the game scores. Presentation shows the hand summary, then submits `continue`.
6. `continue`: if the game is over (§2), go to `game_over` and record the winner. Otherwise go to
   `deal` for the next hand.

An action in the wrong phase, out of turn, or against the rules is rejected and changes nothing.

## 4. Logic events (consumed by presentation and dialogue)
Every event carries: `type`, `seat` (acting player, or none for table-level events), `cards`
(involved cards), and `scores` (a snapshot of the four game scores). Extra fields are listed below.

| Event | When | Seat | Cards | Extra |
|-------|------|------|-------|-------|
| `hand_started` | After the shuffle | — | — | `handNumber` |
| `cards_dealt` | After dealing | — | — | |
| `pass_direction_announced` | After dealing (also on no-pass hands) | — | — | `direction` |
| `cards_passed` | At the exchange, once per seat | passer | the 3 cards | `direction`, `from`, `to` |
| `trick_started` | Before each trick | leader | — | `trickNumber` (1–13) |
| `card_played` | Each play | player | the card | `trickNumber` |
| `hearts_broken` | First heart played in a hand (right after its `card_played`) | player | the heart | |
| `trick_won` | 4th card played | winner | the 4 cards | `trickNumber`, `trickPoints` |
| `queen_of_spades_taken` | Right after `trick_won`, if that trick held Q♠ | winner | Q♠ | |
| `jack_of_diamonds_taken` | Right after `trick_won`, if that trick held J♦ (J♦ rule set only) | winner | J♦ | |
| `moon_shot` | Scoring, if someone shot the moon | shooter | their point cards | |
| `moon_shot_blocked` | Scoring, if one player took 13 of the 14 point cards and one other player took the last one | near-shooter | — | `blocker` |
| `hand_scored` | Scoring (scores snapshot already updated) | — | — | `handPoints` |
| `game_won` | `continue` when the game is over | winner | — | |

Order within one action: `hand_started`, `cards_dealt`, `pass_direction_announced` (then
`trick_started` on no-pass hands); `cards_passed` ×4, then `trick_started`; `card_played`,
[`hearts_broken`], and when the trick completes `trick_won`, [`queen_of_spades_taken`],
[`jack_of_diamonds_taken`], then either `trick_started` or [`moon_shot` | `moon_shot_blocked`]
followed by `hand_scored`.

## 5. AI (D-025)
The computer player sees only public information plus its own hand: its cards, every card played
so far, the cards each player has taken, and the rules state. Each player has its own seeded random
generator (spec 10 §3). Skill and risk come from the character model (spec 08).

### 5.1 Skill roll (every play decision)
1. If only one card is legal, play it.
2. Roll `r` and `m` (two random values in [0, 1)).
   - **Memory** is on for this decision if `m < skill`. Without memory, the AI ignores which cards
     have been played (it treats Q♠ as unknown and can't spot a moon attempt).
3. Score every legal card with the heuristics below (lower is better). Ties go to the lower rank.
4. If `r < skill`, play the best card. Otherwise, with chance 0.5 play the second-best card, else
   a uniformly random legal card.

### 5.2 Passing
Each card gets a **danger** score, and the 3 highest are passed:
- start with the card's rank (2–14);
- hearts: +4;
- Q♠: +20 if holding fewer than 4 spades (counting Q♠ itself), otherwise −10 (keep it, it's guarded);
- A♠ or K♠: +12 if not holding Q♠ and holding fewer than 4 spades, otherwise +0;
- spades below the queen: −8 (low spades protect against the queen);
- a club or diamond in a suit of 3 or fewer cards: +5 (to work toward a void);
- J♦: −6 (worth keeping; harmless in Standard);
- noise: + random × 12 × (1 − skill).

### 5.3 Moon attempt
On its first play decision of each hand, the AI decides whether to try to shoot the moon. It tries
only if it holds at least 6 cards of rank Q or higher, at least 4 hearts, and A♥, **and** a roll is
below `risk × skill`. It gives up as soon as any other player has taken a point card. While
trying: lead its highest card, win tricks with its highest card (or duck with its lowest if it can't
win), and discard its lowest non-point card (point cards last).

### 5.4 Leading (score per card; lower is better)
- start with the rank; hearts +3; Q♠ +40;
- with memory, if Q♠ is still in another hand: spades below Q get −6 (to flush the queen out), and
  K♠ or A♠ get +30;
- a club or diamond from a suit of 2 or fewer cards: −2;
- J♦ in the J♦ rule set: +15.

### 5.5 Following suit
Let "winning card" be the highest card of the led suit played so far.
- **Moon block** (skill ≥ 0.5 and memory): if exactly one other player has taken point cards (at
  least 5 of them), this card would win, the trick holds a heart, and the trick totals 3 points or
  fewer, then win it: score −200 − rank.
- **Ducking** (card below the winning card): score −rank, so the highest safe card is preferred.
  Q♠ gets a further −20 (dump it under a higher spade).
- **Would win, playing last:** if the trick would total below 0 points (it holds the J♦), score
  −100 − rank (grab it). Otherwise score 50 − rank (win with the highest card to get rid of it),
  +100 if the card is Q♠.
- **Would win, not playing last:** score 60 + rank (the lowest winning card, since later players
  may beat it). +100 for Q♠. With memory and Q♠ still out, K♠ or A♠ get +40. In the J♦ rule set,
  J♦ gets −20.

### 5.6 Discarding (void in the led suit)
- If a suspected moon shooter (§5.5) is currently winning the trick: point cards 500 + rank,
  anything else −rank.
- J♦ in the J♦ rule set: +200 (keep it).
- Q♠: −1000 (dump it first).
- With memory and Q♠ still out: K♠ or A♠ get −500 − rank.
- Hearts: −100 − rank (highest heart first).
- Anything else: −rank, with a further −3 if the suit has 2 or fewer cards left.

### 5.7 Measured behavior (for tuning reference)
- Across 300 simulated 4-AI games (skills 0.3, 0.55, 0.8, 0.95, risk 1): 3,156 hands, 32 moon shots,
  101 blocked moon shots.
- Over 150 games, skill-0.95 players finish with lower (better) total scores than skill-0.05 players.
  This is checked by a test.
