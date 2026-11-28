# 15 — Player Profiles, Statistics, and KardCoins (core spec, engine-neutral)

Status: **[Confirmed]** first version (D-049 to D-052; Spades D-073; Gin Rummy and Rummy 500 D-079), covering roadmap R-001 parts 1–3. Avatars
and spending are later parts of R-001. Poker and the casino regulars (§6) are **[Proposed]** (D-090, R-010).

## 1. Profiles (D-049)
- A device can hold several **local** profiles. There are no accounts, servers, or passwords.
- A profile has: a stable id (random UUID), a name (1–20 characters after trimming and collapsing
  spaces), a creation time, a KardCoin balance, a coin history (the 50 most recent entries), Hearts
  statistics, the player's Hearts preferences (rule set, difficulty, opponents), and the player's
  settings (spec 16). Since D-090 it also holds the **casino** block (§6): every regular's balance,
  the background-round counter, and any chips at a poker table.
- **Launch flow:**
  - No profiles yet → **Welcome** screen: "Welcome to FreeKards!", "What's your name?", a name field,
    the note "New players start with 500 KardCoins.", and a **Let's play!** button (disabled until
    the name is valid; Enter also submits). Any Hearts preferences saved before profiles existed
    become the first profile's preferences.
  - Exactly one profile → straight to the main menu.
  - Two or more → **"Who's playing?"**: a tile per profile (colored initial, name, balance) plus an
    **Add player** tile. The last active profile is outlined. Tapping a tile selects it and opens
    the main menu.
- **Main menu player bar** (top): a chip with the player's initial, name, and balance, then
  **My stats** and **Switch player** buttons. Switch player opens "Who's playing?".
- **Add player** uses the same name screen titled "New player", with **Cancel** (back to the picker)
  and **Add player**. The new player becomes the active one.
- The player initial's circle color is a hue derived from the profile id, so it stays the same
  across launches.

## 2. Statistics
Statistics per profile and game; only **finished** games count (abandoned games are not recorded).
- **Hearts:** games played, games won, finishes by place (1st–4th), current and best win streak,
  best and worst final score, hands played, moons shot, Queens of Spades taken, and KardCoins earned
  in Hearts. Place is standard competition ranking on final score (lower is better; ties share the
  better place).
- **Spades** (D-073): games played, games won (by the player's team), current and best win streak,
  best final team score, hands played, contracts made out of contracts bid (the player's team, hands
  where its contract was above 0), the player's own Nils made out of Nils bid, and KardCoins earned
  in Spades.
- **Gin Rummy** (D-079): games played, games won, current and best win streak, hands played, hands
  won, gins, undercuts (the player undercutting the computer's knock), best final total in a won game
  (with bonuses), and KardCoins earned in Gin.
- **Rummy 500** (D-079): games played, games won, current and best win streak, hands played, hands
  the player went out, best hand score, best final score, and KardCoins earned in Rummy 500.
- **Five-Card Draw** (D-090): sessions (visits to the table), hands played, hands won (any share of a
  pot), biggest pot won (the player's share), best hand shown down (its name), net KardCoins over all
  sessions (chips taken away minus chips brought), and best session. A profile also stores the
  **poker preferences**: stakes (Low), difficulty (Medium), and opponents for West, North, East
  (Random).
- A profile also stores the **Gin Rummy and Rummy 500 preferences** (each: difficulty and the
  opponent's character id, or Random). Profiles saved before these games get empty statistics and
  the defaults (Medium, Random) when loaded.
- A profile also stores the **Spades preferences**: difficulty, game length (300 or 500), and the
  partner, West, and East character ids (or Random). Profiles saved before Spades get empty Spades
  statistics and default preferences (Medium, 300, Random) when loaded.

## 3. KardCoins (D-050)
- **Welcome bonus:** 500 KardCoins when a profile is created.
- **Hearts payout** for the player's finishing place × difficulty multiplier, rounded to a whole
  number, plus a flat moon bonus:
  | Place | Base | Easy ×1 | Medium ×1.5 | Hard ×2 |
  |-------|------|---------|-------------|---------|
  | 1st | 100 | 100 | 150 | 200 |
  | 2nd | 40 | 40 | 60 | 80 |
  | 3rd | 15 | 15 | 23 | 30 |
  | 4th | 5 | 5 | 8 | 10 |
  Plus **+25 per moon the player shot** in that game (not multiplied).
- **Spades payout** (D-073): **80** for a win or **10** for a loss, × the same difficulty multiplier
  (Easy 80/10, Medium 120/15, Hard 160/20), plus **+25 per Nil the player made** (not multiplied).
  The breakdown reads, e.g., "Won: 80 × 1.5 (Medium) · Nil bonus +25".
- **Gin Rummy and Rummy 500 payout** (D-079): **80** for a win or **10** for a loss, × the
  difficulty multiplier, as in Spades. Gin adds **+25 per gin the player went** (not multiplied):
  "Won: 80 × 2 (Hard) · Gin bonus +25".
- Every change to the balance adds a history entry (time, amount, reason such as
  "Hearts: 2nd place (Medium) + 1 moon", "Spades: won (Medium) + 1 Nil", "Gin Rummy: won (Hard) + 1 gin",
  or "Rummy 500: lost (Easy)").
- **Game-over award:** below the final standings, a box shows the coin icon and "+N KardCoins",
  counting up from 0 over 1.2 s (ease-out cubic) with the `coins.award` sound (chip stack). Under it is
  the breakdown, e.g. "2nd place: 40 × 1.5 (Medium) · Moon bonus +25", and the new balance.
- **Play money only:** KardCoins can never be bought, sold, exchanged, or cashed out (R-001).
- **Betting games** (Poker now, Blackjack later) are played with the player's own coins as chips, so
  they pay no award: what the player takes from the table is the result (§6.3). Avatars and outfits
  come later (R-001).
- **Name:** "KardCoins" (singular "KardCoin"). A web and trademark-database search on 2026-11-24
  found no existing use (D-052).
- **The coin mark** is drawn, not an emoji, so it looks the same on every platform: a gold circle
  (radial gradient #ffe58a → #d9a82b → #9c7414, dark-gold rim) with a bold "K".

## 4. Stats page ("My stats")
Header: initial, name, and a **Rename** button (inline field; Enter or leaving the field saves).
Below that is the balance in large type. Two columns follow. On the left, one game's statistics, with
a tab per game above them: **Hearts | Spades | Rummy 500 | Gin Rummy | Poker** (D-081, D-092; the last
tab shown is remembered while the app runs, starting with Hearts). Poker shows sessions, hands won (of
hands played), biggest pot won, best hand, best session, and KardCoins won or lost (signed). On the
right, two tabs (the last one shown is remembered while the app runs): **Recent KardCoins** (the 6
latest history entries: date, reason, signed amount in green or red) and **Casino regulars** (D-090):
everyone ranked by KardCoins, richest first: place, colored initial, name (the player as "<name>
(you)", in gold), and coins, counting chips at a poker table. Ratios read "6 of 7" ("—" before the
first one); Gin shows "Hands won" as a ratio of hands played. Buttons:
**Delete player** (with a confirmation that names the coins that will be lost) and **Back**.
Deleting the last profile returns to the Welcome screen.

## 5. Storage (D-051)
- All profiles live in **one document** named `profiles`:
  `{ schemaVersion: 1, activeProfileId, profiles: [Profile…] }`.
- The document is saved after every change. Loading repairs damaged data: invalid profiles are
  dropped, missing fields get defaults (including each setting, spec 16 §1), negative or fractional balances
  are fixed, and the active id falls back to the first profile.
- Device-wide settings (sound levels, music choice) stay outside profiles (spec 13).
- Where and how the document is stored is runtime-specific (see the runtime spec).

## 6. The casino regulars (D-090)
The computer characters are **regulars** at a small casino: each has their own KardCoins, which
earn and lose in the background as the player plays. Their balances matter in poker, where they bet
their own coins, and they are shown on the stats page (§4) and the poker setup screen (spec 19 §4.1).

### 6.1 Balances
- Kept **per player profile** (in the profile's casino block), so each person on a shared tablet has
  their own casino. Every regular on the roster starts with **500**, like a new player; a character
  added to the roster later also starts with 500 when first seen.
- A profile saved before the regulars existed **catches up**: one background round (§6.2) per game it
  has finished (all games and poker sessions), at most 300, run when it is first loaded, so the
  balances already look lived-in.

### 6.2 After every game the player finishes
1. **Regulars who played with her** are paid like the player for their own result, at the same
   difficulty, without the special bonuses (moons, Nils, gins), which are not tracked for them:
   Hearts by their place; Spades by their team's result (the partner shares the player's); Gin Rummy and
   Rummy 500 by the other result from the player's. Poker players settle at the table (§6.3).
2. **Everyone else plays one background game**, in roster order, with a generator seeded from the
   profile id (FNV-1a, 32-bit) XOR (round number + 1) × 0x9E3779B1 (32-bit):
   - A regular with **200 or more** plays a **betting game** with chance 0.35: the stake is
     balance × (0.1 + 0.3 × risk), rounded, at most 1,000. With chance 0.47 + skill adjustment they
     win stake × (0.2 + 0.8 × random); otherwise they lose stake × (0.3 + 0.7 × random) (rounded).
   - Otherwise they play a **coin-earning game**: a Hearts-style finish with place weights
     0.25 + a, 0.25 + a/3, 0.25 − a/3, 0.25 − a (a = skill adjustment), paid 150, 60, 23, or 8 (the
     Medium Hearts payouts).
   - A balance never goes below 0. The round counter goes up by one.
3. Measured over 100 rounds from 500 (three profiles): balances reach about 600–1,400 after 10
   rounds and 2,000–14,000 after 100. Betting swings spread them out, so a regular is sometimes short of
   a poker buy-in for a while.

### 6.3 Chips at the poker table
- **Sitting down:** the player and each regular at the table move their **buy-in** from their balance
  to the table: the stakes' buy-in, or the whole balance if less but at least the minimum (spec 19
  §3.1). Someone below the minimum can't sit down. History entry: "Five-Card Draw: sat down (Low
  stakes)", with the negative amount.
- **More chips:** a player who runs out may buy in again from the balance ("Five-Card Draw: more
  chips").
- **During the session** everyone's chips are saved after every hand. A regular who leaves (out of
  chips) takes their chips (none) back to their balance, and a regular who takes an empty seat buys in.
- **Leaving:** the player's chips go back to her balance ("Five-Card Draw: cashed out", +amount; no
  entry if 0), every regular still at the table takes their chips back, the statistics are updated,
  and the regulars who weren't at the table play a background round (§6.2).
- **Unfinished game:** if the app closes during a session, the next time profiles load every
  player's chips as saved after the last finished hand go back to their balances ("Five-Card Draw:
  chips returned from an unfinished game"). A hand in progress is void.
- Coins are never created or lost at the table: the player's balance, the regulars' balances, and the
  chips at the table always add up to the same total, except for the background rounds (tested).
