# 15 — Player Profiles, Statistics, and KardCoins (core spec, engine-neutral)

Status: **[Confirmed]** first version (D-049 to D-052), covering roadmap R-001 parts 1–3. Avatars
and spending are later parts of R-001.

## 1. Profiles (D-049)
- A device can hold several **local** profiles. There are no accounts, servers, or passwords.
- A profile has: a stable id (random UUID), a name (1–20 characters after trimming and collapsing
  spaces), a creation time, a KardCoin balance, a coin history (the 50 most recent entries), Hearts
  statistics, the player's Hearts preferences (rule set, difficulty, opponents), and the player's
  settings (spec 16).
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
Hearts statistics per profile; only **finished** games count (abandoned games are not recorded):
games played, games won, finishes by place (1st–4th), current and best win streak, best and worst
final score, hands played, moons shot, Queens of Spades taken, and KardCoins earned in Hearts.
Place is standard competition ranking on final score (lower is better; ties share the better place).

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
- Every change to the balance adds a history entry (time, amount, reason such as
  "Hearts: 2nd place (Medium) + 1 moon").
- **Game-over award:** below the final standings, a box shows the coin icon and "+N KardCoins",
  counting up from 0 over 1.2 s (ease-out cubic) with the `coins.award` sound (chip stack). Under it is
  the breakdown, e.g. "2nd place: 40 × 1.5 (Medium) · Moon bonus +25", and the new balance.
- **Play money only:** KardCoins can never be bought, sold, exchanged, or cashed out (R-001).
- Betting games (Poker, Blackjack) will spend coins; avatars and outfits come later (R-001).
- **Name:** "KardCoins" (singular "KardCoin"). A web and trademark-database search on 2026-11-24
  found no existing use (D-052).
- **The coin mark** is drawn, not an emoji, so it looks the same on every platform: a gold circle
  (radial gradient #ffe58a → #d9a82b → #9c7414, dark-gold rim) with a bold "K".

## 4. Stats page ("My stats")
Header: initial, name, and a **Rename** button (inline field; Enter or leaving the field saves).
Below that is the balance in large type. Two columns follow: **Hearts** statistics, and **Recent
KardCoins** (the 6 latest history entries: date, reason, signed amount in green or red). Buttons:
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
