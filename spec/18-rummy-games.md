# 18 — Gin Rummy and Rummy 500 (core spec, engine-neutral)

Status: **[Proposed]** first playable version (D-076 to D-081), built 2026-11-25. The owner asked
the assistant to make the choices he would normally make, and to list them for review. Shared
conventions (card ids, random numbers, state-machine shape) are in `10-core-logic.md`.

Both games are for **2 players**: the player (player 0) and one computer opponent (player 1), who
sits at the top of the table (North). A standard 52-card deck, no jokers.

## 1. Melds (both games)
- A **set** is 3 or 4 cards of the same rank.
- A **run** is 3 or more cards of the same suit in rank order.
  - **Gin Rummy:** the Ace is always low: A-2-3 is a run, Q-K-A is not.
  - **Rummy 500:** the Ace is low or high: A-2-3 and Q-K-A are both runs, K-A-2 is not.
- A card belongs to at most one meld.
- **Laying off:** adding a card to an existing meld: the missing 4th card of a set, or the next card
  at either end of a run. A lay-off can make room for another (laying off 9♥ on 6-7-8♥ lets 10♥ follow).
- **Best arrangement:** wherever the game arranges a hand into melds for the player (Gin's knock and
  the hand display), it uses the arrangement with the least **deadwood** (value of cards in no meld),
  found by trying every way of splitting the hand into melds. Ties go to the first arrangement found,
  trying cards in hand order and melds before leaving a card out.

## 2. Gin Rummy (D-076)
### 2.1 Card values
Ace 1, 2–10 face value, Jack, Queen, King 10.

### 2.2 Deal
- The **computer deals the first hand**, so the player gets the first look at the upcard and the
  first turn. The deal then **alternates** every hand (including dead hands).
- Shuffle with the game's generator. Deal 10 cards each, one at a time, starting with the
  non-dealer: card *i* goes to player (dealer + 1 + *i*) mod 2. The next card is turned face up to
  start the discard pile (the **upcard**); the rest is the face-down **stock** (31 cards).

### 2.3 The first turn (upcard)
The non-dealer may **take the upcard** or **pass**. If they pass, the dealer may take it or pass.
If both pass, the non-dealer must start by drawing from the stock. Whoever takes the upcard then
discards, and play continues with the other player.

### 2.4 A turn
1. **Draw** the top card of the stock or the top card of the discard pile.
2. **Discard** one card face up. A card just taken from the discard pile may not be discarded in the
   same turn.
3. Instead of a plain discard, a player may **knock** if, after the discard, the deadwood of the 10
   cards left is **10 or less**. A knock with no deadwood at all is **gin**.

### 2.5 Dead hand
If a discard (without a knock) leaves **2 or fewer** cards in the stock, the hand is **dead**: nobody
scores, and the next hand is dealt.

### 2.6 Scoring a knock
- The knocker's cards are arranged automatically into the best melds (§1).
- **After a knock (not after gin)**, the defender arranges their own melds and **lays off** deadwood on
  the knocker's melds, also automatically: of every way to split the defender's hand, the one leaving
  the least deadwood after lay-offs is used (breaking up a meld is sometimes better).
- **Knock:** if the defender's deadwood is more than the knocker's, the knocker scores the difference.
- **Undercut:** if the defender's deadwood is equal or less, the defender scores the difference
  **+ 25**.
- **Gin:** the knocker scores the defender's whole deadwood **+ 25**. No lay-offs.

### 2.7 Game end and bonuses
- The game ends after the hand in which a player reaches **100** points. Only one player scores in a
  hand, so there is never a tie.
- Final totals: each player adds **25 per hand won** ("box" bonus); the winner adds the **game bonus
  of 100**; if the loser won no hands (a **shutout**), the winner's total is doubled.
- The totals are shown on the game-over screen and used for "best score"; who wins is decided by
  reaching 100 first.

### 2.8 Logic events
Every event carries `type`, `player` (acting player, or none), `cards`, and `scores` (snapshot).

| Event | When | Player | Cards | Extra |
|-------|------|--------|-------|-------|
| `hand_started` | After the shuffle | dealer | — | `handNumber` |
| `cards_dealt` | After dealing | — | — | |
| `upcard_turned` | After dealing | — | the upcard | |
| `upcard_passed` | A player passes the upcard | passer | — | |
| `drew` | Taking the upcard or drawing | drawer | the card | `source`: `stock` or `discard` |
| `discarded` | A plain discard | player | the card | |
| `knocked` / `gin` | A knock / gin (the discard goes on the pile) | knocker | the discard | `knocked`: `deadwoodValue` |
| `laid_off` | After a knock, if the defender laid off | defender | the cards | |
| `undercut` | After a knock, if undercut | defender | — | |
| `hand_dead` | §2.5 | — | — | |
| `hand_scored` | End of every hand (after the above) | winner, or none | — | `result` |
| `game_won` | `continue` once the game is over | winner | — | `result` (bonuses, §2.7) |

The hand `result` holds the kind (`knock`, `undercut`, `gin`, `dead`), the knocker, the winner, both
players' melds, deadwood and deadwood values, the defender's lay-offs, the points, the bonus, and the
total. Phases: `deal` → `upcard` → (`draw` → `discard`)… → `hand_over` → `continue` → `deal` or
`game_over`. An action in the wrong phase, out of turn, or against the rules is rejected and changes nothing.

### 2.9 Computer player (D-078)
Sees only its own hand and public information. Each player has its own seeded generator. Skill and
risk come from the character model (spec 08). Before each draw and discard decision it rolls: **memory** is on if a
roll is below skill, and a second roll below skill means it plays its best choice.
- **Memory** means it remembers the buried discards and the cards the opponent picked up;
  without memory, it knows only its own hand and the top discard.
- **Taking a discard (or the upcard):** take it if, after the best discard, the card is part of a
  meld and the deadwood goes down, or the deadwood goes down to 10 or less (a knock is possible).
  After a failed roll, it takes a wanted card only 60% of the time.
- **Knocking** (not affected by the rolls): with each possible discard, compute the deadwood left. If the lowest is 0, go gin.
  Otherwise knock if it is at most **10** while the stock has 20+ cards, **7** while it has 12–19, and
  **4** after that (the opponent's hand improves as the hand goes on, so late knocks risk an
  undercut). A risk-taker (chance = risk × 0.5) with 3 or less deadwood and 16+ cards in the stock
  waits for gin instead. Ties go to discarding the higher card.
- **Discarding:** score every legal discard (lower is better): the deadwood left, minus **2.5 per live
  partial meld** in that deadwood (a pair, or two cards of a suit one or two apart, whose completing
  cards are not all known to be gone), **+5** if (with memory) the opponent picked up a card of the
  same rank or a suited card within 2, and −1 if the opponent threw away a card of the same rank or a
  suited neighbor. Ties go to the higher card. With a failed skill roll: 50% the second best, else a
  random legal card.
- **Measured** (AI-only games to 100, 300 per row, risk 0.3/0.6):

  | Skill (both) | Hands per game | Turns per hand | Knock | Gin | Undercut | Dead |
  |--------------|----------------|----------------|-------|-----|----------|------|
  | 0.30 (Easy) | 8.0 | 20.0 | 68% | 4% | 1% | 27% |
  | 0.55 (Medium) | 7.5 | 16.0 | 84% | 5% | 1% | 10% |
  | 0.80 (Hard) | 8.3 | 13.5 | 90% | 5% | 3% | 3% |

  Skill 0.95 beats 0.1 in 99% of games, 0.8 beats 0.55 in 78%, and 0.8 beats 0.3 in 94%. The
  simulation test checks that 200 games finish with legal moves and consistent scoring, and that a
  strong player wins more than 60% against a weak one.

## 3. Rummy 500 (D-077)
### 3.1 Card values
Ace **15**, 10, Jack, Queen, King **10**, 2–9 face value. The Ace is worth 15 in any meld, low or high.

### 3.2 Deal
- The **computer deals the first hand** (the player goes first); the deal alternates every hand.
- Deal 13 cards each, one at a time, starting with the non-dealer. The next card starts the discard
  pile face up; the rest is the stock (25 cards). The non-dealer takes the first turn.
- The **discard pile is spread out** so every card in it can be seen, oldest at the left.

### 3.3 A turn
1. **Draw:** the top card of the stock, **or any card in the discard pile together with every card
   above it** (all of them go into the hand).
   - A card from **below the top** may be taken only if it can be used **right away**: in a new meld
     with cards in the hand (including the other cards picked up), or laid off on a meld on the table.
     The player's **next meld or lay-off must use that card**, and no discard is allowed until it has
     been used.
   - The **top card** taken alone has no such rule, but it may not be discarded again in the same
     turn (unless it is the last card in the hand).
2. **Meld and lay off** as often as wanted: put down a new set or run from the hand, or lay off one
   card on any meld on the table, the player's own or the opponent's. Every card a player puts on the
   table scores for that player, whoever started the meld.
3. **Discard** one card face up to end the turn.

### 3.4 End of a hand
- A player **goes out** by getting rid of their last card, with a meld, a lay-off, or a discard. A
  final discard is not required.
- If the stock is empty after a discard, the hand ends (the player who drew the last stock card
  finishes that turn).

### 3.5 Scoring
Each player scores the value of every card they put on the table this hand, **minus** the value of
the cards left in their hand. A hand score can be negative.

### 3.6 Game end
After a hand, if either player has **500 or more** and the scores differ, the higher score wins.
If the scores are tied, another hand is played.

### 3.7 Logic events
| Event | When | Player | Cards | Extra |
|-------|------|--------|-------|-------|
| `hand_started` | After the shuffle | dealer | — | `handNumber` |
| `cards_dealt`, `upcard_turned` | After dealing | — | (the upcard) | |
| `drew_stock` | Drawing from the stock | drawer | the card | |
| `took_discard` | Taking from the discard pile | taker | the cards taken (lowest first) | `index` |
| `melded` | A new meld | player | the meld (in run order) | `meld` (index), `points` |
| `laid_off` | A lay-off | player | the card | `meld`, `meldOwner`, `points` |
| `discarded` | A discard | player | the card | |
| `went_out` | A player's hand is empty | player | — | |
| `stock_empty` | §3.4 | — | — | |
| `hand_scored` | End of the hand | — | — | `result`: melded, in hand, the cards left, total, by player |
| `game_won` | `continue` once the game is over | winner | — | |

Phases: `deal` → (`draw` → `play`)… → `hand_over` → `continue` → `deal` or `game_over`.

### 3.8 Computer player (D-078)
Same skill and memory rolls as Gin (§2.9). With memory it remembers which cards the opponent picked
up from the pile. Its **meld plan** for a hand is the best arrangement (most points down), then every
lay-off it can make on the table and on its own new melds, chaining run extensions first.
- **Drawing:** for each discard-pile card it may take, compare the plan's points after taking it
  (with the required card forced into a meld or lay-off) against the plan now. Subtract **0.4 per
  point** of picked-up cards that would stay in the hand (**1.0** when the opponent has 4 cards or
  fewer, since being caught costs them), add **2 per extra card** while the stock has 15+ cards, and
  subtract 4 for any pick-up from below the top. It takes the best option scoring above 0, or draws
  from the stock. After a failed skill roll it takes a good option only half the time.
- **Melding:** after drawing, it first uses any required card, then puts down every meld and lay-off
  in its plan, one at a time. A weaker player sometimes overlooks one: each is skipped with chance
  0.5 × (1 − skill), until its next turn.
- **Discarding:** it throws the card with the highest score: its value (× 1.5 when the opponent has 4
  cards or fewer), −6 per live partial meld it forms with the rest of the hand, −8 (with memory) if
  the opponent picked up a card of the same rank or a suited card within 2, and −30 if it fits a meld
  on the table (never hand the opponent an easy lay-off). Ties go to the higher value. With a failed
  skill roll: 50% the second best, else a random legal card.
- **Measured** (AI-only games to 500, 150 per row):

  | Skill (both) | Hands per game | Turns per hand | Hands ended by going out | Points per player per hand |
  |--------------|----------------|----------------|--------------------------|----------------------------|
  | 0.30 (Easy) | 4.1 | 22.3 | 97% | 125 |
  | 0.55 (Medium) | 4.3 | 20.2 | 99% | 120 |
  | 0.80 (Hard) | 4.4 | 18.7 | 100% | 116 |

  Rummy 500 has more luck in it than Gin: skill 0.95 beats 0.1 in 82% of games, 0.8 beats 0.55 in
  55%, and 0.8 beats 0.3 in 69%. The simulation test checks that 100 games finish with consistent
  scoring and that a strong player wins more than 60% against a weak one.
