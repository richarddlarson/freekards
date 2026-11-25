# 17 — Spades (core spec, engine-neutral)

Status: **[Confirmed]** first playable version (D-070 to D-074), built 2026-11-25 while the owner was
away. He asked the assistant to make the choices he would normally make and to list them for
review. Each such choice is marked *(owner to review)*. Shared conventions (card ids, seats, random
numbers, state-machine shape) are in `10-core-logic.md`.

## 1. Players, partnerships, and deck
- 4 players in two **partnerships** that sit across from each other: **You (South, seat 0) and your
  partner (North, seat 2)** against **West (seat 1) and East (seat 3)**. Play is clockwise
  (South → West → North → East), as in Hearts.
- Team index = seat mod 2: team 0 is South + North ("us"), team 1 is West + East ("them").
- A standard 52-card deck, ranked A K Q J 10 9 8 7 6 5 4 3 2. **Spades are always trump.**

## 2. Game options (setup screen)
| Option | Choices | Default |
|--------|---------|---------|
| Game to | 300 or 500 points | **300** |
| Difficulty | Easy, Medium, Hard (spec 08) | Medium |

- 500 is the classic target, but between evenly matched Medium players it takes about 14 hands,
  twice as long as a typical Hearts game. 300 takes about 7.5 hands, close to Hearts, so it is the
  default and 500 is offered as the full-length game. *(owner to review)*
- **Nil** bids are always allowed. **Blind nil** (bidding nil before seeing your cards) is not offered
  in this version. *(owner to review)*
- There is no minimum team bid. *(owner to review)*

## 3. Phases (state machine)
1. `setup` (presentation only): options, partner, and opponents (§8). The logic layer starts at
   `deal` with both team scores 0 and both bag counts 0.
2. `deal` (action `deal`): the **dealer** for hand 1 is **South** (so the player sees all three
   other bids before making hers on the first hand). The dealer moves one seat clockwise each hand.
   Shuffle with the game's generator and deal 13 cards each, one at a time clockwise, starting with
   the dealer's left: card *i* of the shuffled deck goes to seat (dealer + 1 + *i*) mod 4. Then go
   to `bid`. *(owner to review: first dealer)*
3. `bid` (action `bid(seat, n)`, n = 0–13, where **0 means Nil**): starting with the dealer's left
   and going clockwise, each player bids once, in turn. After the 4th bid, go to `play`.
4. `play` (action `play(seat, card)`): 13 tricks.
   - The player to the **dealer's left** leads the first trick.
   - Players must follow the led suit if they can. Otherwise they may play any card, including a
     spade (trumping).
   - **Spades may not be led until spades are "broken"** (a spade has been played to an earlier
     trick), unless the leader holds only spades. The first trick may be led with any non-spade.
   - The trick is won by the highest spade in it, or, if it holds no spade, by the highest card of
     the led suit. The winner leads the next trick.
5. `score` (entered automatically after trick 13): score both teams (§4) and add to the totals.
   Presentation shows the hand summary, then submits `continue`.
6. `continue`: if the game is over (§5), go to `game_over` and record the winning team. Otherwise
   go to `deal` for the next hand.

An action in the wrong phase, out of turn, or against the rules is rejected and changes nothing.

## 4. Scoring (each team, each hand)
- **Contract** = the sum of the two partners' bids, leaving out any Nil bid.
- **Counted tricks** = tricks won by the partners who did not bid Nil.
- If the contract is above 0:
  - **Made** (counted tricks ≥ contract): +10 × contract, plus +1 per extra trick (each extra
    trick is also a **bag**).
  - **Set** (counted tricks < contract): −10 × contract.
- **Nil:** +100 if the Nil bidder wins no tricks, −100 if they win any. Tricks a Nil bidder wins
  **do not count toward the partner's contract**; each is worth +1 and counts as a **bag** for the
  team. *(owner to review: some house rules count them toward the partner's bid instead)*
- **Bags:** each team keeps a running bag count. When it reaches 10 or more, the team loses 100
  points and 10 is taken off its bag count (repeated if needed).
- Hand total = contract points + bag points + Nil points + bag penalty.

Example: you bid 4 and your partner bids 3 (contract 7). You win 5 tricks and your partner wins 4:
9 counted tricks, so +70 + 2 = 72, and 2 bags.

## 5. Game end
After each hand, the game is over if either team has **reached the target** (≥ 300 or 500) or has
**fallen to −200 or below**, **and** the two team scores differ. The team with the higher score
wins. If the scores are tied, play another hand. *(owner to review: the −200 "mercy" rule)*

## 6. Logic events (consumed by presentation and dialogue)
Every event carries `type`, `seat` (acting player, or none), `cards`, and `scores` (a snapshot of
the two team scores). Extra fields:

| Event | When | Seat | Cards | Extra |
|-------|------|------|-------|-------|
| `hand_started` | After the shuffle | dealer | — | `handNumber` |
| `cards_dealt` | After dealing | — | — | |
| `bid_made` | Each bid | bidder | — | `bid` (0 = Nil) |
| `bidding_complete` | After the 4th bid | — | — | `bids` (four numbers) |
| `trick_started` | Before each trick | leader | — | `trickNumber` (1–13) |
| `card_played` | Each play | player | the card | `trickNumber` |
| `spades_broken` | First spade played in a hand (right after its `card_played`) | player | the spade | |
| `trick_won` | 4th card played | winner | the 4 cards | `trickNumber`, `trumped` (won with a spade on a non-spade lead) |
| `nil_failed` | Right after `trick_won`, the first time a Nil bidder wins a trick | the Nil bidder | — | |
| `hand_scored` | Scoring (scores snapshot already updated) | — | — | `results` (per team, §4 breakdown) |
| `bag_penalty` | Right after `hand_scored`, for each team that lost 100 for bags | — | — | `team` |
| `game_won` | `continue` when the game is over | — | — | `team` |

Per-team `results`: `contract`, `counted` (tricks), `made` (contract > 0 and made), `contractPoints`,
`bags` (bags added this hand), `nils` (each Nil bidder's seat and whether it was made),
`nilPoints`, `bagPenalty` (0 or −100 per penalty), `total`.

## 7. AI (D-071)
The computer player sees only public information plus its own hand: its cards, every bid, every
card played so far, and the tricks each player has won. Each player has its own seeded generator.
Skill and risk come from the character model (spec 08).

### 7.1 Bidding: estimated tricks
For each **side suit** (not spades) of length *n*:
- Ace: +1 (+0.8 instead if *n* ≥ 6, because it is likely to be trumped).
- King: +0.8 if *n* ≥ 2 (+0.9 if the Ace is also held); +0.1 if it is a singleton.
- Queen: +0.5 if *n* ≥ 3 and the Ace or King is also held; +0.25 if *n* ≥ 3 otherwise.

Spades, with *s* = number of spades held:
- A♠ +1; K♠ +1 if *s* ≥ 2, else +0.5; Q♠ +1 if *s* ≥ 3, else +0.3; J♠ +0.5 if *s* ≥ 4.
- Every spade beyond the third that was not counted as an honor above: +0.8.
- **Ruffing:** "spare" spades = spades not counted above. Each void side suit: +0.9 per spare spade,
  up to 2. Each singleton side suit: +0.6 if at least one spare spade is left after voids.

Bid = round(estimate − 0.5 + noise), where noise = (roll − 0.5) × 3 × (1 − skill), clamped to 1–13.
The **−0.5 hedge** shades every bid down, because a bag costs far less than being set. Measured
over 200 games per setting: with no hedge, Hard-skill teams made only 74% of their contracts and
games took 14 hands; with 0.5, 91% and 12.2 hands. Larger hedges added bag penalties and made games
longer again.
If the partner bid Nil, add 1 (the AI will be protecting the Nil). If the partner and the AI together
would bid more than 13, the AI bids 13 − partner's bid.

### 7.2 Bidding Nil
The AI considers Nil only if the estimate is below 1.2, it holds no Ace and no K♠, its spades are
at most 3 and none above 9, it holds no Queen or King in a side suit of 2 or fewer cards, and its
partner has not bid Nil. It then bids Nil if a roll is below 0.3 + 0.5 × risk.

### 7.3 Playing: skill roll
Same as Hearts (spec 06 §5.1): if only one card is legal, play it. Roll `r` and `m`. **Memory** is on
if `m < skill`. Score every legal card (lower is better; ties go to the lower rank). If `r < skill`,
play the best card. Otherwise, with chance 0.5 play the second-best, else a random legal card.

Definitions used below:
- **Outstanding** cards: with memory, every card not in the AI's hand and not yet played; without
  memory, every card not in its hand (so only Aces look certain).
- A card is a **boss** if no outstanding card of its suit is higher.
- **Winning now:** the card would beat the trick as it stands.
- **Team need** = the team's contract − its counted tricks so far. **Opponents' need** likewise.

### 7.4 Playing: priorities, in order
1. **Own Nil (intact):** lose every trick. Leading: the lowest card (rank). Following or void:
   a card that is not winning now scores −100 − rank (the highest safe card goes first); a winning card
   scores 100 + rank (the lowest).
2. **Partner's Nil (intact), partner still to play this trick:** win the trick high, so the partner
   can duck: winning cards score −50 − rank; others score rank. Leading: the highest card (−rank).
3. **Partner's Nil (intact), partner has played and is winning now:** overtake with the lowest card
   that beats them (−100 + rank); otherwise rank.
4. **An opponent's Nil (intact):** if that opponent is still to play this trick, play low (rank);
   if they have played and are winning now, never overtake: cards that are not winning score −rank
   (the highest that stays under), winning cards 100 + rank. Leading: the lowest card (rank).
5. **Normal play**, with "want the trick" = team need > 0, or opponents' need > 0 and the tricks
   left − opponents' need ≤ 2 (a chance to set them).
   - **Leading:** if wanting tricks: a side-suit boss scores −30 − rank (with memory, not in a suit
     an opponent has shown void in); a boss spade −20 (when leading spades is legal); a King without
     the Ace in a suit of 2 or fewer cards +8; other cards rank − 0.5 × suit length (low from long
     suits). If not wanting tricks (avoiding bags): rank, with boss cards +20.
   - **Following suit:** if the partner is winning now with a boss card, or the AI plays last and
     the partner is winning: rank (play low). Else if wanting the trick: a winning card scores
     −50 + rank if playing last, −60 + rank if it is a boss, otherwise −40 + rank; other cards
     score rank. If not wanting the trick: cards that are not winning now score −rank (the highest
     that ducks), winning cards 50 + rank.
   - **Void in the led suit:** if the partner is winning now (with a boss, or the AI plays last):
     side-suit cards score rank − 3 × (suit length ≤ 2), spades 30 + rank. Else if wanting the trick:
     the lowest spade that wins now, −50 + rank; side-suit cards rank. Else: side-suit cards −rank
     (throw high cards away), spades 50 + rank.

### 7.5 Measured behavior (for tuning reference)
Measured on 2026-11-25 with AI-only games to 500 (300 games per row; risk 0.3/0.6/0.9/0.2):

| Skill (all four) | Hands per game | Contracts made | Nil bids per game | Nils made |
|------------------|----------------|----------------|-------------------|-----------|
| 0.30 (Easy) | 16.3 | 84% | 1.33 | 38% |
| 0.55 (Medium) | 14.0 | 88% | 1.07 | 51% |
| 0.80 (Hard) | 12.4 | 91% | 0.97 | 65% |

- To 300 (Medium): 7.5 hands per game.
- A skill-0.95 partnership beats a skill-0.1 partnership in 99% of games; skill 0.8 beats 0.55 in 69%.
- The simulation test checks that 200 games finish with legal moves and consistent scoring, that
  a strong partnership wins more than 65% against a weak one, and that most contracts are made.

## 8. Screens (presentation; layout details in spec 12 §1 and §8)
- **Setup:** Game to (300 | 500), Difficulty, and a **Partner and opponents** grid of every roster
  character. Tapping a character fills the next free seat in the order **Partner (North) → West →
  East**, and the tile's badge names that seat. **Random** picks all three at random.
  **Back** | **Deal!**.
- **Bidding:** after the deal, the player's cards are face up. Each player's bid appears in a small
  badge by their name as it is made ("Bid 3", or "Nil"). On her turn, a bid panel above her hand
  shows "Your bid", the bids so far, a row of buttons **Nil, 1–13**, and a **Suggested: N** hint
  (the AI's own estimate for her hand). She taps a number to select it, then **Bid N** to confirm.
  *(owner to review: the suggestion hint)*
- **Play:** as in Hearts, with each badge showing "Bid 3 · Won 1" and spades broken announced with a
  toast. A failed Nil is announced with a toast: "<Name>'s Nil is broken!".
- **Score panel:** "Spades · to 500", then one row per team: **"You & <partner>"** and
  **"<West> & <East>"**, each with Bid, Won, Score, and Bags. The footer shows "Hand N · Dealer: <name>".
- **Hand summary:** a table per team: Bid, Won, Contract (+70 / −70), Bags (+2), Nil (+100 / −100,
  if any), Bag penalty (−100, if any), This hand, Total, and the team's running bag count.
- **Game over:** "You and <partner> win!" or "<West> and <East> win!", the final team scores, the
  KardCoins award (spec 15 §3), **Play again** and **Main menu**.
