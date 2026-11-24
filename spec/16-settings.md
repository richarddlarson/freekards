# 16 — Player Settings (core spec, engine-neutral)

Status: **[Confirmed]** first version (D-053 to D-056), from roadmap R-005. More settings will be
added here as play-testing turns them up. Each new setting gets a decision entry, a section below,
a default, and a repair rule.

## 1. The Settings panel (D-053)
- **Belongs to the player.** Settings are stored in the active profile (spec 15), so each person on
  a shared tablet has their own. Device-wide things (sound levels, music track) stay in the Sound
  panel (spec 13).
- **Where:** a **Settings** button on the main menu footer (Sound · Settings · Quit), and in the
  in-game ☰ pause menu (Resume · Sound · Settings · New game · Main menu).
- **Layout:** a dialog titled "Settings" with "Saved for <name>" below it. Each setting is a row:
  a bold label (290 wide), a group of choice buttons (the selected one filled in brass), and under it
  a line that describes the selected choice. A **Done** button closes it.
- **Changes apply and save at once**, with no Save or Cancel. A change made mid-game takes effect
  when the panel closes. The player's hand re-sorts, and new timings apply to the next card.
- With no active profile (only in development demo screens), the panel shows the defaults with
  the note "Not saved: no player is selected", and changes are not kept.

| Setting | Choices (stored value) | Default |
|---------|------------------------|---------|
| Card order | Low cards on the left (`low-left`) · Low cards on the right (`low-right`) | `low-left` |
| Card response | Standard (`standard`) · Quick (`quick`) · Instant (`instant`) | `standard` |
| Game speed | Relaxed (`relaxed`) · Normal (`normal`) · Fast (`fast`) | `normal` |

**Repair rule:** on load, each field is checked on its own; a missing or unknown value becomes that
field's default. Profiles saved before settings existed simply get all the defaults.

## 2. Card order (D-054)
- How the player's own hand is arranged. Suits are always grouped ♣ ♦ ♠ ♥ (spec 10 §1). Within each
  suit, **low-left** puts 2 on the left and Ace on the right, and **low-right** is the reverse.
- The suit groups do not move, because Hearts doesn't rank suits: their order is only a
  display convention that alternates colors. If a later game does rank suits, its "low-right" also
  reverses the suit order (owner's rule: "if there's an inherent order to the suits as well, then
  reversal should reverse both").
- Under the row, a preview shows a sample hand (2♣ 9♣ K♣ 4♦ J♦ 5♠ Q♠ A♠ 3♥ 10♥) as small
  overlapping card faces (80 × 112, 44 apart) in the chosen order.

## 3. Card response (D-055)
How quickly the player's own cards react to a touch, pen, or mouse press. The opponents' cards are
unaffected.

| | Standard | Quick | Instant |
|---|---|---|---|
| A tap counts on | release (finger lifted) | release | **press** (finger down) |
| Playable card lifts on press | no | yes (lift 44) | — (it plays at once) |
| Passing: card lifts/lowers on | release | press | press |
| Illegal card shakes on | release | press | press |
| Your card's flight to the trick (ms) | 280 | 140 | 80 |
| Your hand closing up after a play (ms) | 220 | 110 | 80 |
| Passing lift/lower animation (ms) | 140 | 80 | 60 |
| Drag to play | yes | yes | no (the press already played it) |

Descriptions shown under the row:
- Standard: "A card plays when you lift your finger. You can also drag it onto the table."
- Quick: "A card pops up as soon as you touch it and moves faster. You can also drag it onto the table."
- Instant: "A card plays the moment you touch it."

**Drag to play** (Standard and Quick):
- Only a **legal** card can be dragged, and only on the player's turn.
- A press becomes a drag once the pointer moves **12** logical units. From then on the card follows
  the pointer immediately (no animation), stays upright at full size, sits above the other cards, and
  keeps the spot where it was grabbed under the finger.
- On release, if the card's center is at least **105** units (half a card height) above its resting
  place in the hand, it is played. It flies from where it was let go to the trick slot. Otherwise it
  settles back into the hand (the hand's close-up time).
- An interrupted gesture (pointer cancelled by the system) settles the card back.
- A press that never becomes a drag is a tap. Only one pointer is tracked at a time.

## 4. Game speed (D-056)
A multiplier on the waits that make the table feel slow:

| | Relaxed | Normal | Fast |
|---|---|---|---|
| Multiplier | 1.5 | 1 | 0.5 |
| Computer "thinking" before a play (ms) | 825–1425 | 550–950 | 275–475 |
| Completed trick stays visible (ms) | 1350 | 900 | 450 |

Descriptions: Relaxed "Opponents take their time, and finished tricks stay on the table longer." ·
Normal "The usual pace." · Fast "Opponents play quickly, and finished tricks clear sooner."
Dealing, passing, and trick-collection animations are unchanged.
