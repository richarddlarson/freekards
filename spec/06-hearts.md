# 06 — Hearts (core spec, engine-neutral)

Status: rules **[Confirmed]** (D-008). AI and dialogue hooks **[Draft]**.

## 1. Players and deck
- 4 players: the human (South) and 3 computer opponents (West, North, East), playing clockwise
  (South → West → North → East).
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
- **Passing cycle:** hand 1 left, hand 2 right, hand 3 across, hand 4 no pass, then repeat.
  Each player chooses 3 cards to pass. All passes are revealed at the same time once every player
  has chosen.
- **Shoot the moon:** the shooter scores 0 for the hand and every other player gets +26. In the
  J♦ rule set, the J♦'s −10 still counts for whoever took it (including the shooter).

## 3. Phases (state machine)
1. `setup`: the player chooses a rule set and opponents (see 08). Scores reset to 0.
2. `deal`: shuffle and deal 13 cards to each player, one at a time clockwise, starting with West.
3. `pass` (skipped on no-pass hands): each player selects exactly 3 cards, then the exchange happens.
4. `play`: 13 tricks.
   - The holder of 2♣ leads the first trick, and must lead the 2♣.
   - Players must follow the led suit if they can. Otherwise they may play any card, with two exceptions:
   - **First trick:** no hearts and no Q♠ may be played, *unless* the player holds nothing else
     that is legal.
   - **Leading hearts:** hearts may not be led until hearts are "broken" (a heart has been played
     on an earlier trick), *unless* the leader holds only hearts.
   - Playing Q♠ does **not** break hearts.
   - The highest card of the led suit wins the trick. The winner collects it and leads next.
5. `score`: count points, apply shoot-the-moon, and show the hand summary.
6. If the game is over, go to `game_over` (winner announcement, statistics update). Otherwise
   return to `deal`.

## 4. Logic events (consumed by presentation and dialogue)
`hand_started`, `cards_dealt`, `pass_direction_announced`, `cards_passed`, `trick_started`,
`card_played`, `hearts_broken`, `trick_won`, `queen_of_spades_taken`, `jack_of_diamonds_taken`,
`moon_shot`, `moon_shot_blocked` (someone was one card short of shooting the moon), `hand_scored`,
`game_won`.
Each event carries the acting player, the cards involved, and a snapshot of the relevant scores.

## 5. AI
To be specified: pass selection, lead, follow, and discard heuristics, plus how skill level
(08-characters.md) changes them.
