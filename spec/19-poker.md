# 19 — Poker (core spec, engine-neutral)

Status: **[Proposed]** first version (D-088 to D-093), chosen by the assistant at the owner's request
(R-002, R-010). Five-Card Draw is the first variant. Hand ranking (§1), pots (§2.5), and fixed-limit
betting (§2.3) are shared, so later variants (Five- and Seven-Card Stud, Texas Hold'em) reuse them.

Poker is the first game played **for KardCoins**: chips at the table are the player's own coins
(spec 15 §3), and the computer players bring their own coins too (§3, spec 15 §6).

## 1. Hand ranking (D-088)
A hand is 5 cards. From more than 5 cards (later variants), the best 5 count. No wild cards. Aces are
high, except in the 5-high straight A-2-3-4-5 (the "wheel"), the lowest straight. Suits never break ties.

| Rank | Hand | Ties broken by | Name shown |
|------|------|----------------|------------|
| 9 | Straight flush (Ace high = royal flush) | top card | "Royal flush", "Straight flush, 9 high" |
| 8 | Four of a kind | the four, then the kicker | "Four of a kind, Queens" |
| 7 | Full house | the three, then the pair | "Full house, Kings full of 4s" |
| 6 | Flush | all five cards, highest first | "Flush, Ace high" |
| 5 | Straight | top card (5 for the wheel) | "Straight, 10 high" |
| 4 | Three of a kind | the three, then kickers | "Three of a kind, 7s" |
| 3 | Two pair | higher pair, lower pair, kicker | "Two pair, Jacks and 5s" |
| 2 | One pair | the pair, then kickers | "Pair of 9s" |
| 1 | High card | all five cards | "Ace high" |

Rank names: 2–10 as numbers, then Jack, Queen, King, Ace (plural: "2s", "10s", "Jacks", …).
**Score** for comparing: start with the category (0 for high card … 8 for straight flush), then for
each of the 5 tie-break ranks (0 when fewer) multiply by 15 and add the rank. Higher wins; equal ties.

## 2. Five-Card Draw (D-088)
### 2.1 Players and seats
- Four seats: the player at South (seat 0) and three computer players at West, North, and East (seats
  1–3), in the 4-player seat order of spec 10 §2. Play goes clockwise.
- A seat may be **empty** (a player left and nobody took the seat). A hand needs at least 2 players
  with chips. Players join and leave only between hands.

### 2.2 The deal
- The **dealer button** moves one seat clockwise every hand, to the next player with chips. For the
  first hand it goes to a random player (the game's generator).
- Each player with chips puts in the **ante** (or all their chips, if fewer).
- Shuffle a full deck with the game's generator. Deal 5 cards each, one at a time, starting left of
  the button.

### 2.3 Betting (fixed limit)
- Two betting rounds: before the draw (bets and raises are the **small bet**) and after it (the **big
  bet**, twice the small bet). Each starts with the first player left of the button who can act.
- With no bet yet, a player may **check** or **bet**. Facing a bet, a player may **fold**, **call**, or
  **raise** (by one bet). Folding is not offered when checking is possible.
- At most **a bet and three raises** per round (the cap).
- A player without enough chips to call **calls all in** for what they have. A bet or raise that a
  player can't fully afford puts **all in**; if it is more than the current bet it counts as a raise
  and reopens the betting (a simplification of casino rules).
- No bet or raise is offered when nobody else could answer it (everyone else is all in or folded).
- The round ends when every player who can still act has acted since the last bet or raise and has
  put in the same amount; or when only one player is left. A bet nobody matched is **returned**.

### 2.4 The draw
After the first round, starting left of the button, each player still in (all-in players too)
**discards any number of cards, 0 to 5**, and is dealt that many from the deck. Keeping all five is
**standing pat**. If the deck runs short (only possible with more than 4 players), the discards are
shuffled into a new deck.

### 2.5 Showdown and pots
- If everyone but one player folds, that player wins everything without showing.
- Otherwise, after the second round all players still in show their hands.
- **Side pots:** everything put in this hand is split by all-in levels. For each distinct amount put
  in by a player still in, from smallest to largest, a pot holds every player's chips up to that
  level (above the previous level). It can be won by the players still in who put in at least that
  level. Consecutive pots with the same players are merged.
- Each pot goes to the best hand among those who can win it. **Ties split** the pot; an odd chip goes
  to the tied winner nearest the left of the button.
- A player left with no chips is **out** (spec §3.3).

### 2.6 Logic events
| Event | When | Fields |
|-------|------|--------|
| `hand_started` | A new hand | `handNumber`, `button` |
| `ante` | Each ante | `seat`, `amount`, `allIn` |
| `dealt` | After the deal | |
| `bet_action` | Each fold, check, call, bet, or raise | `seat`, `kind`, `amount`, `allIn`, `round` (0 or 1) |
| `bet_returned` | An unmatched bet comes back at the end of a round | `seat`, `amount` |
| `round_over` | A betting round ends | `round` |
| `drew` | A player draws | `seat`, `count` |
| `showdown` | Hands are shown | each live seat's cards and hand value |
| `pot_won` | Each pot is paid | `potIndex`, `amount`, `winners`, `shares`, `handName` (null without a showdown) |
| `hand_over` | After the pots | |
| `busted` | A player in the hand is left with no chips | `seat` |
| `sat` / `left` | A player joins or leaves between hands | `seat`, `chips` |

Phases: `idle` → `deal` → `bet1` → `draw` → `bet2` → `hand_over` → `deal` … (a hand ends early in
`hand_over` when one player is left). A public **betting log** (seat, kind, round, amount) is kept for
the hand. Chips are conserved: the chips in front of the players plus everything put in this hand
never change during a hand. An action out of turn, in the wrong phase, or against the rules is
rejected and changes nothing.

## 3. Stakes, buy-in, and cashing out (D-088, D-090)
### 3.1 Stakes
| Stakes | Ante | Small bet | Big bet | Buy-in | Minimum buy-in |
|--------|------|-----------|---------|--------|----------------|
| Low (`low`) | 5 | 10 | 20 | 200 | 50 |
| Medium (`medium`) | 10 | 20 | 40 | 500 | 100 |
| High (`high`) | 25 | 50 | 100 | 1,000 | 250 |

## 5. Computer player (D-089)
Sees only its own cards and public information (the betting log, how many cards each player drew, the
pot). Each player has its own seeded generator. Skill and risk come from the character model (spec 08).

### 5.1 Betting
1. **Read roll:** a roll below skill means it reads the table this decision.
2. **Chance of winning (equity):** deal out random hands for the players still in, from the cards it
   can't see, **60 + 160 × skill** times (rounded). Before the draw, everyone (itself too) then draws
   by the standard strategy (§5.2) and gets random replacements. After the draw, each other player's
   five cards are dealt again with that player's actual number of discards. Count a win as 1 and a tie
   shared among k tied players as 1/k; equity is the average.
   - **With a read**, a sampled starting hand must fit what the player showed (up to 20 tries, then
     any hand is used): if they bet or raised before the draw, at least a pair or a hand that keeps 4
     cards; after the draw, a hand whose standard strategy discards exactly as many cards as they drew.
     If they bet or raised after the draw and the sampled final hand has no pair, their draw is dealt
     again once.
   - **Without a read**, the equity gets random noise: ± up to 0.15.
3. **Decision**, with n other players still in, fair = 1 / (n + 1), and
   bar(share) = fair + (1 − fair) × share − risk × 0.08 + 0.05 × raises already made this round:
   - May check: **bet** if equity ≥ bar(0.2). Otherwise, after the draw with at most two others left,
     **bluff** (bet) with chance risk × 0.18. Otherwise check.
   - Facing a bet: **raise** if raising is allowed, equity ≥ bar(0.35), and a roll < 0.9. Else **call**
     if equity ≥ pot odds − 0.02 + (1 − risk) × 0.04, where pot odds = to call ÷ (pot + to call).
     Else, before the draw, facing at most one small bet, make a **loose call** with chance
     risk × 0.25. Else **fold**.
   - A bet made with equity below fair is marked a **bluff** (for dialogue).

### 5.2 Drawing (standard strategy)
| Hand | Keep | Draw |
|------|------|------|
| Straight or better | everything (stand pat) | 0 |
| Three of a kind | the three | 2 |
| Two pair | both pairs | 1 |
| One pair | the pair | 3 |
| Four to a flush | the four | 1 |
| Four in a row, open at both ends (not A-2-3-4 or J-Q-K-A) | the four | 1 |
| Otherwise, with a Jack or higher | the highest card | 4 |
| Otherwise | nothing | 5 |

Variations for the computer's own draw: a player with risk ≥ 0.7 breaks a pair of 6s or lower to draw
to a four-card flush; one with risk ≥ 0.6 keeps an Ace kicker with a pair half the time (draws 2).
With a pair and a failed skill roll, it also keeps its highest other card (draws 2).

### 5.3 Measured
AI-only games at Low stakes, 4 players (skill 0.3, 0.55, 0.8, 0.55; risk 0.3, 0.6, 0.9, 0.2), 100
hands: 80% of hands reach a showdown. Before the draw, of 485 decisions: 53% check, 11% bet, 3%
raise, 17% call, 16% fold. Discards per draw: 0 (1%), 1 (11%), 2 (25%), 3 (26%), 4 (34%), 5 (3%). About
6 ms per decision on a desktop. One player against three weaker ones (150 hands, risk 0.4 all):
skill 0.9 vs 0.15 wins 13.3 chips a hand; 0.8 vs 0.55 wins 3.7; 0.8 vs 0.3 wins 7.7.
The simulation test checks that hands finish with legal moves and that chips are conserved after
every action, and that a strong player wins chips from weak ones.
