# 14 — Roadmap and Enhancement Backlog

This is the project's to-do list: features that have been asked for but not built yet. Each item has
an id (`R-NNN`), status, origin, and the details known so far. When work on an item starts, its
design decisions go into `02-decisions.md` and the relevant spec documents. Here the item is then
marked **In progress** or **Done**, with links. Items are refined as the game grows, and the
original request wording is kept.

Status values: **Idea** (captured, not designed) · **Planned** (designed, scheduled) ·
**In progress** · **Done**.

## Where we left off (updated at the end of each working session)
**2026-11-27/28 (sixth session):** Branch `session/2026-11-27-poker`, pushed for review as a PR. The owner
asked for Five-Card Draw poker played for KardCoins, with chips, chip sounds and animations, and the
computer characters as casino "regulars" with their own coins (R-010), and asked the assistant to
make every choice and list them. Built: shared poker logic (hand ranking, pots, fixed-limit betting)
and the Five-Card Draw engine and computer players (spec 19, D-088, D-089); the regulars' balances,
background rounds, and poker buy-ins and cash-outs (spec 15 §6, D-090); generated chips and Kenney chip
sounds (D-091); the setup screen, table, Poker stats tab, and Casino regulars leaderboard (D-092);
222 voiced poker lines (D-093). All marked Proposed. After play-testing, the owner asked for bigger
chips (D-094), stacks that build up when players sit down (D-095), much lower stakes (D-096),
visible chip flights (D-097, which also fixed flying piles drawn empty), and a large chip meter with a
low-chips warning (D-098). He also asked to center the pause menu (D-099, bubbles silenced while
paused) and reported a Hearts game that went on past 100; it was a tie for lowest, so the results
dialog now explains it (D-100). The owner play-tested poker and called it
"excellent". Waiting on the owner: merge the PR, and confirm the Proposed decisions (D-086 to D-093,
D-095, D-098) after more play; the felt texture on the tablet is still to check.

**2026-11-27 (fifth session):** Merged as PR #10. The Gin Rummy
discard prompt now says "Lowest deadwood after discard: N" (D-085). The table felt has a subtle
generated texture, and a new **Table color** setting offers Green, Blue, Burgundy, Gold, and Amber
(R-009, D-086, marked Proposed). The owner liked the colors, but on his 4K monitor the texture
vanished, so it was redone with a coarser grain plus faint fibers that hold up at any resolution
(D-087, Proposed). Waiting on the owner: check the new texture on the 4K monitor and the tablet.

**Earlier, 2026-11-25 (fourth session):** Spades is merged (PR #4); the owner asked to hold v0.2.0 for now.
PR #5 (merged) added **Gin Rummy** and **Rummy 500** for two players (spec 18,
D-076 to D-081): a shared melds module, both rules engines, computer players tuned by simulation, 204
new voiced lines, stats and KardCoins, setup screens, and a new 2-player table, on a table base class
now shared by every game. My stats now has a tab per game. The owner asked the assistant to make every
choice and list them for review. After seeing them he asked for a **Rules screen** for every game
(R-008, D-082): a **?** button on each table, Rules in the pause menu and on each setup screen, with
the text in `spec/content/rules/`. It also fixed a gray line on the app icon's edges (D-083). The owner
approved every decision (D-076 to D-082), and the merged session branches were deleted. He then
asked to cut **v0.2.0** (Spades, Gin Rummy, Rummy 500, the Rules screens, and the 8s and icon fixes):
the version is bumped on `session/2026-11-25-release-0.2.0`, then the merge is tagged `v0.2.0` and CI
builds a draft pre-release. The first tag build timed out on a slow test, so the unpublished tag was
moved after a fix (D-084). The release notes start with a "What's new in v0.2.0" section, and the
README describes the current release (both are now release steps). **v0.2.0 was published as a
pre-release on 2026-11-27.** Waiting on the owner:
1. Still open from before: confirm that profiles and coins persist in the **installed** app across
   restarts, and the play-tester's feedback on Settings (R-005), bigger cards (R-006), and the
   Rounded deck (R-007).
2. Next options: code signing (Q3, D-068), the next game (R-002: Blackjack, Poker, or Solitaire), or
   KardCoin spending (R-001 part 4).

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

## R-008 — A rules screen for every game
- **Status:** Done 2026-11-25 (spec 12 §10, D-082), approved by the owner. Every new game
  gets a rules file in `spec/content/rules/` as part of being built.
- **Requested:** 2026-11-25, by the owner
- **Request (original wording):** "These look great!  Let's add one more thing: On each game, we need
  to add a "rules" screen that the user can bring up by clicking an icon or "something" on the app
  screen in order to understand the rules of that game, then on that screen we display the basic
  rules, order of play, and any special rules such as those decisions you made above.  Can we add
  that?  We will need this for all the games, not just gin and rummy 500."

## R-009 — Felt texture and more table colors
- **Status:** In progress 2026-11-27 (D-086, D-087, spec 16 §6, `07-themes.md` §Classic Casino table
  felt). The owner likes the colors; the texture was redone for 4K screens and awaits his review.
- **Requested:** 2026-11-27, by the owner
- **Request (original wording):** "The next thing we need to work on it that the card table top is a
  uniform shaded green table. Most other card games out there give is a very light, subtle texture
  like it is felt.  We need to experiment with that. Also we need to allow the user more choices of
  card table top cover color. Let's allow blue and maybe some subtle shades of dark red and/or gold or
  orangish, but nothing too garish."

## R-010 — Poker for KardCoins, and the casino regulars' coins
- **Status:** In progress 2026-11-27: Five-Card Draw (spec 19, D-088 to D-093) and the regulars'
  balances (spec 15 §6, D-090). Later: Five- and Seven-Card Stud, Texas Hold'em, Blackjack (R-002).
- **Requested:** 2026-11-27, by the owner
- **Request (original wording):** "ok, so next let's look at adding some games that require using
  your kardcoins.  Let's try adding basic 5 card draw poker.  We'll most likely need to add some poker
  chip graphics and chip stack graphics as well as sounds and animations for the chips as well when you
  ante, bet, etc.  Also, I've been thinking we may need to include kardcoin amounts that the other
  virtual players have as well.  we should make their amounts start at 500 like you when the game
  starts, and then they should be given amounts requisite to the totals you would earn after every game
  you play with them. players that you don't play with should also be "earning or losing" amounts with
  every game as well becuase it's assumed they are "playing" elsewhere and we need them to have stacked
  coin amounts if you choose them to play against in the poker game, even if you've never played them
  in other card games.  It's sort of a lightweight simulation of a casino with these guys all being
  regulars that earn and lose money in the background while you play as well, regardless if you are
  playing against any of them specifically in any given game or turn.  my goal is to eventually add
  other poker variants (5 card and 7 card stud, texas hold 'em, etc.) so if you need to make anything
  reusable for this, go ahead and do so.  I'll eventually be adding blackjack too.  You did a great job
  on the rules for all the other games without having to ask. Feel free to just do that same process
  this time, and just list your decisions at the end."

## R-002 — Remaining games
- **Status:** In progress. **Spades** built 2026-11-25 (spec 17, D-070 to D-074). **Gin Rummy** and
  **Rummy 500** built 2026-11-25 (spec 18, D-076 to D-081), approved by the owner.
- **Games:** ~~Spades~~, ~~Rummy 500~~, ~~Gin Rummy~~, Blackjack, Poker (Five-Card Draw started,
  R-010; Stud and Hold'em later), Solitaire. Open questions Q7–Q8 cover rules and variants.
- **Request for the rummy games (original wording, 2026-11-25):** "Let's try adding something
  different. I want to add 500 Rummy and Gin (both 2 player only) to the list of available games.
  They are very similar games, so it may make sense to try and add them in a single session. You did a
  great job adding Spades without my answers, so go ahead and do the same thing for these two games as
  well. Same situation: make the decisions wherever there's a question, then document them at the end
  and I can override later."

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
