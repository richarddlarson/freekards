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

## 3. Stakes, buy-in, and cashing out (D-088, D-090, D-096)
### 3.1 Stakes
| Stakes | Ante | Small bet | Big bet | Buy-in | Minimum buy-in |
|--------|------|-----------|---------|--------|----------------|
| Low (`low`) | 1 | 5 | 10 | 100 | 25 |
| Medium (`medium`) | 2 | 10 | 20 | 200 | 50 |
| High (`high`) | 5 | 20 | 40 | 400 | 100 |

At every level the big bet is twice the small bet, the buy-in is 20 small bets, and the minimum is 5.

### 3.2 Buying in and cashing out
Chips are KardCoins moved from each player's balance to the table and back (spec 15 §6.3): the
player and every regular sit down with the buy-in, or their whole balance if it is less but at
least the minimum. Leaving returns everyone's chips. Chips are saved after every hand.

### 3.3 Players running out of chips (D-092)
- **A regular** left with no chips after a hand buys more (another buy-in from their balance) with
  chance equal to their risk trait, if they can afford the minimum ("<Name> buys more chips").
  Otherwise they **leave** ("<Name> leaves the table"), and a regular who isn't at the table and can
  afford the minimum, chosen at random, **takes the seat** ("<Name> sits down"). If nobody can, the
  seat stays empty. A busted regular who left can come back later in the same session.
- **The player** left with no chips sees "You're out of chips" with **Buy N chips** (from her
  balance; disabled, with an explanation, if it is below the minimum) and **Leave table**.
- If everyone else has left and nobody can sit down, the player sees "Everyone else has left the
  table" and leaves.

## 4. Screens (D-092)
### 4.1 Setup
- Reached from **Play Poker** on the main menu (spec 12 §1). Title "Poker". Rows:
  - **Game:** Five-Card Draw (the only choice for now), with "More poker games are coming".
  - **Stakes:** Low · Medium · High. Under it: "Ante 1 · Bets 5 and 10 · You sit down with 100 of
    your 500 KardCoins", or, below the minimum, "… You need at least 25 KardCoins to sit down (you
    have 20)" in red, and **Sit down** is disabled.
  - **Difficulty:** Easy · Medium · Hard.
  - **Opponents:** **Random** (up to three regulars who can afford the stakes) or **1 to 3 chosen**
    regulars, seated West, North, East in the order picked. Each tile shows the regular's KardCoins;
    a regular below the stakes' minimum is dimmed, can't be picked, and is marked "Short on coins".
    Changing the stakes drops picks who can't afford them.
- Buttons: **Back**, **Rules**, **Sit down**. The choices are saved in the profile (spec 15 §2).

### 4.2 The table
- Seats, portraits, the score panel, and the ☰ and ? buttons are where Hearts has them (spec 12 §2).
  Opponents' cards are face-down fans at their edge, as in Hearts.
- **The player's cards:** five face-up cards along the bottom, centers **150** apart, sorted by rank
  (the Card order setting decides the direction), then suit. A card chosen to throw away lifts **44**.
- **Chip stacks** (each player's chips) with the amount under them: the player's **600** right of the
  center, at the hand's height + 30; West's and East's **230** below their portrait and **60** toward the
  center (clear of their cards and nameplates); North's **235** left of the portrait and **50** below
  its center (D-094, D-096).
- **Bets** for the current round sit in front of each player: **205** below the center (the
  player), **430** left and right (West, East), **215** above (North). The **pot** is at the center.
- The **dealer button**, a white "D" disc 54 across, sits beside the dealer's bet spot and slides to
  the next dealer (500 ms).
- **Action tags** under each regular's chips (114 below the stack's anchor, leaving room for a second
  row of stacks; above the "You" plate for the player) show their last
  action: "Check", "Call 10", "Bet 10", "Raise to 20" (gold), "Fold" (dimmed), "Draws 3", "Stands pat",
  "All in", "Out of chips".
- **Score panel:** "Five-Card Draw", "Ante 1 · Bets 5 / 10", then each seat's name and chips
  ("Empty seat" and "—" for an empty one; a folded player's name dimmed), and "Hand N · Pot N".
- **The action bar** sits above the player's cards (52 above a lifted card's top): a prompt and
  buttons, as in the rummy games.
  - Betting: the prompt is the player's hand name and "Your bet" or "N to call", e.g. "Pair of Jacks ·
    10 to call". Buttons, as allowed: **Fold** (secondary), **Check**, **Call N**, **Bet N**,
    **Raise to N** (the round total she would have in), with " (all in)" when it takes all her chips.
  - Drawing: "Pair of Jacks · Tap the cards to throw away" (then "Throw away 2 cards"); **Draw N**
    (disabled with none chosen) and **Stand pat** (secondary). Tapping a card lifts or lowers it
    (on press with Card response: Instant, otherwise on release).
  - Between hands: "Ready for the next hand?" with **Next hand** and **Leave table** (secondary).
- **Showdown:** each regular's hand moves face up, upright at scale **0.55** with cards **62** apart,
  to a spot **450** left or right of the center (West, East) or **255** above it (North), with the hand
  name under it. The player's hand name shows above her cards. The winners' labels turn gold, and a
  center message reads "Dot wins 120 with Two pair, Kings and 5s" ("You win …", "Dot and Gus split
  …", "… the side pot of …"; without a showdown just "Dot wins 40").
- **Toasts** (below the pot): "<Name> folds", "<Name> stands pat", seat changes, and "You'll leave
  after this hand".
- **Pause menu:** Resume, Rules, Sound, Settings, **Leave table**. Between hands it leaves at once;
  during a hand the player folds (or checks when she can, and stands pat) for the rest of it, then
  leaves.
- **Leaving:** a dialog titled "Nice session!", "Breaking even", or "Better luck next time", with the
  coin mark and the result counting from 0 to "+N" or "−N" (red) over 1.2 s, "Sat down with 100, left
  with 145 · 12 hands, won 4 · best hand: Flush, Ace high", the balance, and **Play again** (back to
  the setup) and **Main menu**. Sounds: `game.win` (or `game.lose` for a loss) and `chips.win`.

### 4.3 Chips (D-091)
- **Values and colors:** 1 white (blue spots), 5 red, 25 green, 100 black, 500 purple, 1,000 gold
  (brown spots, marked "1K"). Each chip is drawn seen at an angle (spec 07 §Poker chips).
- **Piles:** an amount is drawn with the fewest chips, largest value first, in stacks of at most 8
  of one value (each chip **84** wide and 58.8 tall, stacks 9 apart; D-094, D-096), each chip 8.4
  above the one below with a small fixed sideways jitter, and the amount in a dark pill under the
  stacks (26 px; the pot's 30 px, in gold).
- **Rows** (D-096): a pile is at most 3 stacks wide. With more stacks they go in balanced rows (4 as
  2 + 2, 5 as 3 + 2), each row centered, each further back row 36 higher. The first stacks (the
  largest values, which are the shortest) go in the front row, so the taller stacks of small chips
  behind them still show; back rows are drawn (and built) first. The amount sits under the front row.
- **A player's stack** (not bets or the pot) keeps some small chips, like a cashier's buy-in
  (D-095, D-096): from 20 up it holds 4 chips of 1, from 50 up also 4 chips of 5, and from 250 up
  also 4 chips of 25; the rest uses the fewest chips. So no value under 100 ever needs more than one
  stack of 8: 100 is 3 × 25, 4 × 5, 5 × 1; 200 is 1 × 100, 3 × 25, 4 × 5, 5 × 1; and 400 is 2 × 100,
  7 × 25, 4 × 5, 5 × 1.
- **Building a stack** (D-095): when the player sits down, every seat's stack is built chip by chip,
  the player's first, then West, North, East, each seat starting 380 ms after the last. Within a pile,
  stacks go left to right and each from the bottom up, a chip every 55 ms; each chip drops from 70
  above, fading in, over 260 ms (ease-in), with a 5-unit bounce, and a `chips.stack` click as it lands.
  The amount appears when the last chip lands. A regular who sits down or buys more chips, and the
  player buying more chips, build their own stack the same way. All these times × Game speed.
- **Flying chips** (D-097): a pile for the amount (fewest chips) leaves the source pile at once and
  slides to the destination (cubic-bezier 0.33, 0, 0.2, 1), arcing up by 12% of the distance (at most
  40) and growing to 1.1× at the middle of the flight, with a soft drop shadow; when it lands the
  destination pile is redrawn with the chips added.

### 4.4 Timing and sounds
| Moment | Animation | Sound |
|--------|-----------|-------|
| Sitting down, buying chips | stacks build chip by chip (§4.3), about 2 s for four seats | `chips.stack` |
| Antes | stacks → pot, 420 ms, all together | `chips.bet` |
| Deal | shuffle (900 ms), then cards from the pot one at a time, 70 ms apart, 260 ms flights | `card.shuffle`, `card.deal` |
| Bet, call | stack → bet spot, 420 ms | `chips.bet` |
| Raise | stack → bet spot, 420 ms | `chips.raise` |
| Check | (tag only), 150 ms pause | — |
| Fold | cards → center, fading, 360 ms | — |
| Round ends | every bet → pot, 450 ms | `chips.collect` |
| Unmatched bet | bet spot → stack, 420 ms | — |
| Draw | discards → center, fading, 300 ms; new cards from the center, 300 ms | `card.deal` |
| Showdown | hands move and turn face up, 420 ms, then a 1,000 ms pause (× Game speed) | `card.place` |
| Pot paid | pot → each winner's stack, 650 ms, then a 900 ms pause (× Game speed) | `chips.win` |

Computer players "think" for the usual time before each action (spec 12 §3, × Game speed).

### 4.5 Dialogue
The regulars talk through the poker triggers (spec 08 §Poker triggers).

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
AI-only games at test stakes of ante 5, bets 10 and 20 (the tests keep these fixed), 4 players
(skill 0.3, 0.55, 0.8, 0.55; risk 0.3, 0.6, 0.9, 0.2), 100 hands: 80% of hands reach a showdown. Before the draw, of 485 decisions: 53% check, 11% bet, 3%
raise, 17% call, 16% fold. Discards per draw: 0 (1%), 1 (11%), 2 (25%), 3 (26%), 4 (34%), 5 (3%). About
6 ms per decision on a desktop. One player against three weaker ones (150 hands, risk 0.4 all):
skill 0.9 vs 0.15 wins 13.3 chips a hand; 0.8 vs 0.55 wins 3.7; 0.8 vs 0.3 wins 7.7.
With the table stakes of D-096 (stacks of 5 buy-ins, 100 hands each): about 72% of hands reach a
showdown at every level, and the average pot is 40 at Low, 79 at Medium, and 186 at High; before the
draw, about half of all decisions are checks and a fifth folds.
The simulation test checks that hands finish with legal moves and that chips are conserved after
every action, and that a strong player wins chips from weak ones.
