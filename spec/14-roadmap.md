# 14 — Roadmap and Enhancement Backlog

This is the project's to-do list: features that have been asked for but not built yet. Each item has
an id (`R-NNN`), status, origin, and the details known so far. When work on an item starts, its
design decisions go into `02-decisions.md` and the relevant spec documents. Here the item is then
marked **In progress** or **Done**, with links. Items are refined as the game grows, and the
original request wording is kept.

Status values: **Idea** (captured, not designed) · **Planned** (designed, scheduled) ·
**In progress** · **Done**.

## Where we left off (updated at the end of each working session)
**2026-11-25 (third session):** v0.1.0 is published (pre-release). Branch
`session/2026-11-25-spades` adds **Spades** (spec 17, D-070 to D-074): rules engine, computer players
tuned by simulation, partnership dialogue with 156 new voiced lines, stats and KardCoins, setup
screen, bidding, and the table, on a table class now shared with Hearts (D-072). It also fixes the
Rounded deck's 8s, which had no corner rank (D-075; the bug is in v0.1.0). The owner play-tested
Spades and approved every choice made in his absence. Waiting on the owner:
1. Merge the session PR (#4).
2. Cut **v0.2.0** when ready, so players get Spades and the 8s fix (`runtimes/electron.md`
   §How to cut a release).
3. Still open from before: confirm that profiles and coins persist in the **installed** app across
   restarts, and the play-tester's feedback on Settings (R-005), bigger cards (R-006), and the
   Rounded deck (R-007).
4. Next options: code signing (Q3, D-068), the next game (R-002), or KardCoin spending (R-001 part 4).

---

## R-001 — Player profiles, statistics, KardCoins, and avatars
- **Status:** In progress. Parts 1–3 (profiles, stats, KardCoins earning) were built 2026-11-24;
  see `15-profiles-and-coins.md` and D-049 to D-052. Part 4 (spending, avatars) is still an Idea.
- **Requested:** 2026-11-24, by the owner
- **Request (original wording):** "I want users to be able to set up their own profile so that as they
  play more and more games they can see their stats as well as maybe we can add some kind of currency
  to the game so that when they win they get a certain amount of it. That currency (maybe call it
  KardCoins?) adds up as they win non-betting games, and then they can use it to bet on betting games
  like Poker. Eventually we can have them "spend" it to upgrade their experience in various ways,
  maybe by allowing them to choose an avatar and then buy outfits and/or accessories etc. for it.
  This idea will be fleshed out better as we build more of the game out."
- **Parts, in likely build order:**
  1. **Profiles:** one or more local player profiles (name, and later an avatar). Pick a profile at
     launch or on the menu. Settings and saved games belong to a profile.
  2. **Statistics** per profile and per game: games played, won, and lost; win rate; streaks; and
     game-specific records (Hearts: moons shot, Queens taken, best and worst score).
  3. **KardCoins** (working name): a per-profile balance. Winning **non-betting** games (Hearts,
     Spades, Rummy 500, Gin, Solitaire) earns coins. **Betting** games (Poker, Blackjack) are played
     with coins as stakes.
  4. **Spending coins:** an avatar with outfits and accessories bought with coins, and perhaps other
     cosmetic upgrades (table felts, card backs, themes).
- **Constraints already known:**
  - **Play money only.** KardCoins can never be bought with real money, exchanged, or cashed out:
    no purchases, ads, or real-world value. This keeps the game a free open-source game, not a
    gambling or monetized product.
  - **Offline and local.** Profiles, stats, and coins live on the device (D-034's user-data folder).
    There are no accounts or servers.
  - **Name check:** search "KardCoins" for trademarks before it's final, as was done for FreeKards
    (D-033).
- **Open questions (to answer when it's designed):** how coins are earned (flat amount per win,
  scaled by difficulty, bonuses for moon shots), starting balance, what happens at zero coins
  (a daily refill?), whether profiles have PINs, and the avatar art source and style (it must meet
  D-014).

## R-005 — Settings page, from play-testing
- **Status:** In progress. The Settings panel with Card order, Card response (with drag to play), and
  Game speed was built 2026-11-24; see `16-settings.md` and D-053 to D-056. More settings will be
  added as play-testing continues.
- **Requested:** 2026-11-24, by the owner, passing on his wife's feedback after her first Hearts game
- **Request (original wording):** "(1) We need to create a settings page to add user-specific
  settings to. (2) The first user setting needs to be card display order, and the setting needs to
  initially allow for the current default order (lowest on left) and the opposite, lowest card on
  right. This allows for the player to decide how to display the cards. More settings will be added
  as we go through this. Second, she feels like the gameplay is a little laggy. When she taps or drags
  a card with her finger it should respond more quickly. Maybe this can be a setting since it seems
  to be find to me as it, but she doesn't like it, so different people may have different desires
  around "responsiveness" to clicks and drags."
- **Follow-up:** ask her to try Quick and Instant on the Surface, and to say whether Game speed Fast
  helps. Tune the values in `16-settings.md` from what she reports.

## R-006 — Bigger cards and a clearer font, from play-testing
- **Status:** Done 2026-11-24, pending play-test feedback. See D-060 (Fira Sans, jumbo outlined
  card indices) and D-061 (183 × 256 cards for the hand and the trick).
- **Requested:** 2026-11-24, by the owner, passing on his wife's feedback
- **Request (original wording):** "Okay, so the next think my wife wanted was larger cards, the
  current ones are too small, and a clearer font that's easier to read, maybe a bit thicker/heavier
  weight."
- **Reference:** the owner supplied a photo of an older commercial Hearts game, with the instruction
  to use it only to extract relative sizing and weights. Nothing else was taken from it.
- **Choices made by the owner:** the new font applies to the cards and all interface text; only
  the player's hand and the trick get bigger (opponents' fans stay compact); font picked from an
  audition sheet (Fira Sans + Fira Sans Condensed, option B of four).

## R-007 — Choosable card decks, starting with a rounded one
- **Status:** In progress. Built 2026-11-25: the Card deck setting with two decks, Classic and
  Rounded; see D-062, `07-themes.md` §Card decks, and `16-settings.md` §5. More decks (other
  colors, then new artwork) can be added later.
- **Requested:** 2026-11-25, by the owner, passing on his wife's feedback
- **Request (original wording):** "my wife likes all the new changes, but still feels the font on
  the cards is too sharp and needs a more rounded look to it. Maybe we should add a card-deck
  look-and-feel section to the settings to allow for the user to choose from multiple "decks" with
  each deck having a different font, colors, and (eventually) artwork. We could make the current
  "deck" the first one in the set, and add a new one with blue backs and a more rounded font as the
  next one, that way we achieve 2 goals, one to get my wife her more rounded font, and the second of
  setting us up for better personalization overall by allowing users to choose their decks."
- **Choices made by the owner:** Nunito ExtraBold, picked from an audition of six rounded fonts
  (Nunito Black and ExtraBold, Fredoka Bold and SemiBold, Baloo 2 ExtraBold, M PLUS Rounded 1c
  ExtraBold). Deck names Classic and Rounded.

## R-002 — Remaining games
- **Status:** In progress. **Spades** built 2026-11-25 (spec 17, D-070 to D-074).
- **Games:** ~~Spades~~, Rummy 500, Gin Rummy, Blackjack, Poker, Solitaire. Open questions Q6–Q8 cover
  rules and variants.

## R-004 — More natural-sounding character voices
- **Status:** Idea
- **Requested:** 2026-11-24, by the owner
- **Request (original wording):** "I would prefer a more natural human sound, the generated ones are a
  little fake sounding due to the tools being used. But for now that's OK. Add a todo for later to
  investigate other ways to generate the voiced speech that result in more natural human sounds."
- **Current state:** Piper voices (D-047, D-048) are clear but sound synthetic, like an audiobook reader.
- **Directions to investigate** (each must pass D-014 and D-047: permissive model **and** clean
  training data, all the way down the fine-tuning chain):
  - Newer open TTS models with more expressive prosody, for example Kokoro (Apache-2.0 weights;
    check its training-data provenance carefully, since some of its data is reportedly synthetic
    audio from commercial engines), StyleTTS 2, Parler-TTS, and successors released by then.
    Many popular models are ruled out by non-commercial licenses (for example XTTS/CPML and F5-TTS).
  - Expressive controls on the current engine: per-line pace and pitch, emphasis markup, and
    post-processing.
  - **Recorded human voices**: volunteers (family, friends, community) record the lines under a
    CC0 release form. This sounds most natural and is cleanest legally, but costs the most effort per
    line, and new lines need new sessions.
- **Constraint:** keep the pipeline in `scripts/build-voices.py` (or its successor) so voices can be
  swapped per character without code changes; only `voice.tts` and the clips change.

## R-003 — Smaller items noted along the way
- **Status:** Idea
- ~~App icon (all platforms)~~ **Done** 2026-11-25 (D-067). Still open: Linux `desktopName` for window grouping.
- ~~About & Credits screen showing the SBOM, licenses, and attributions (spec 09 §5).~~ **Done**
  2026-11-25 (D-066).
- Character portrait art for the Classic Casino theme (spec 07, 08).
- Phase 2 court-card art from public-domain 19th-century designs (D-027).
- Bright Illustrated theme (D-009).
- Code signing for Windows installers: deferred for the first releases (D-068); route still open (Q3).
- Optional sound stingers (hearts broken, Queen of Spades, moon shot, win/lose); `table.*` and
  `game.*` cues exist but have no files.
- Characters replying to each other (Q20).
- Save and resume a game in progress (Q13).
