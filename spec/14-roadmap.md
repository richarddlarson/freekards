# 14 — Roadmap and Enhancement Backlog

This is the project's to-do list: features that have been asked for but not built yet. Each item has
an id (`R-NNN`), status, origin, and the details known so far. When work on an item starts, its
design decisions go into `02-decisions.md` and the relevant spec documents. Here the item is then
marked **In progress** or **Done**, with links. Items are refined as the game grows, and the
original request wording is kept.

Status values: **Idea** (captured, not designed) · **Planned** (designed, scheduled) ·
**In progress** · **Done**.

## Where we left off (updated at the end of each working session)
**2026-11-24:** Hearts is fully playable with sound effects, 10 music tracks, voices for all six
characters, player profiles, statistics, KardCoins, and a per-player Settings panel (card order,
card response with drag to play, game speed). Esc pauses (D-058). The player's cards and the trick
are bigger, with jumbo card indices and the Fira Sans font (R-006). CI builds all four installers,
and `main` is green. This session's work is on branch `session/2026-11-24-playtest-feedback`, not
pushed yet: it becomes one pull request when the owner says so (D-059). Waiting on the owner:
1. Confirm that profiles and coins persist in the **installed** app across restarts
   (`~/.config/cardtable/data/profiles.json`); only the localStorage fallback was tested.
2. Try the Windows ARM64 installer on the Surface Pro 9 (CI artifact `freekards-win-arm64`).
3. Have the play-tester try the new **Settings** (R-005): Card response Quick or Instant, drag to
   play, and Game speed Fast. Also the bigger cards and new font (R-006). Tune from her feedback.
4. Choose what's next: the first tagged release `v0.1.0` (D-041), code signing (Q3), the next game
   (R-002), the app icon and Credits screen (R-003), or KardCoin spending (R-001 part 4).

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

## R-002 — Remaining games
- **Status:** Planned (order to be decided)
- **Games:** Spades, Rummy 500, Gin Rummy, Blackjack, Poker, Solitaire. Open questions Q6–Q8 cover
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
- App icon (all platforms) and Linux `desktopName` for window grouping.
- About & Credits screen showing the SBOM, licenses, and attributions (spec 09 §5).
- Character portrait art for the Classic Casino theme (spec 07, 08).
- Phase 2 court-card art from public-domain 19th-century designs (D-027).
- Bright Illustrated theme (D-009).
- Code signing for Windows installers (Q3; SignPath Foundation).
- Optional sound stingers (hearts broken, Queen of Spades, moon shot, win/lose); `table.*` and
  `game.*` cues exist but have no files.
- Characters replying to each other (Q20).
- Save and resume a game in progress (Q13).
