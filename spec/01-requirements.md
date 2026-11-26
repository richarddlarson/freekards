# 01 — Requirements

Status key: **[Confirmed]** = stated by the owner or settled in `02-decisions.md`.
**[Proposed]** = assumed until the owner confirms it.

## 1. Purpose

- **[Confirmed]** Recreate the experience of the owner's wife's 2012 Hoyle Card Games app: a relaxed,
  friendly card-game collection against computer opponents.
- **[Confirmed]** The main user plays on a Windows tablet-style PC with an **ARM** processor. The app must
  run natively there, not under emulation.
- **[Confirmed]** She must be able to install it herself from one simple installer.

## 2. Platforms

- **[Confirmed]** Windows: ARM64 and x64.
- **[Confirmed]** Linux: ARM64 and x64.
- **[Confirmed]** Runs in its own window and looks and behaves like a native app, not a browser tab.
  A web-based rendering stack is acceptable under the hood.
- **[Proposed]** Touch-first input: every action works with a finger tap or drag. Mouse also works fully.
  Keyboard is optional. (Reason: the main device is a tablet-style PC.)
- **[Proposed]** Works fully offline. No account, no network, no telemetry.

## 3. Games

- **[Confirmed]** Hearts
- **[Confirmed]** Spades
- **[Confirmed]** Blackjack
- **[Confirmed]** Poker (variant to be decided; see open questions)
- **[Confirmed]** Rummy 500
- **[Confirmed]** Gin Rummy
- **[Confirmed]** Solitaire (variants to be decided; see open questions)

## 4. Presentation and feel

- **[Confirmed]** Attractive card graphics.
- **[Confirmed]** Animation for dealing, playing, and collecting cards.
- **[Confirmed]** Computer opponents shown as characters, each with a simple personality.
- **[Confirmed]** Characters comment during play, reacting to good or bad play by themselves or by the human player.
- **[Confirmed]** Comments appear in speech bubbles next to the character **and** are spoken aloud.
- **[Confirmed]** Each player has their own settings for how the game looks and responds (card order,
  card response, game speed), so the game can suit different people on one device (spec 16, D-053).
- **[Confirmed]** Every game has a rules screen, reachable from its setup screen and from the table,
  explaining the basic rules, the order of play, and any special rules (R-008, spec 12 §10, D-082).
- **[Confirmed]** Sound effects for shuffling and dealing, plus other basic card sounds.
- **[Confirmed]** A simple, upbeat background music track.
- **[Proposed]** Separate volume controls (or mute) for music, sound effects, and character voices.
  Speech bubbles can be turned off on their own.

## 5. Licensing and intellectual property

- **[Confirmed]** Free and open-source software under the MIT License, in a public repository (D-012, D-013).
- **[Confirmed]** Uses only freely available, permissively licensed graphics, sounds, fonts,
  libraries, and tools (D-014).
- **[Confirmed]** A software bill of materials is part of the app and is visible to users (D-015).
- **[Confirmed]** Nothing is copied from the Hoyle product. FreeKards recreates the *kind* of
  experience, not Hoyle's assets or trademarks.
- Details: `09-licensing-and-sbom.md`.
