# 02 — Decision Log

One entry per decision, numbered `D-NNN`, newest at the bottom. Entries are never deleted. When a later
decision overrides one, the earlier entry is marked **Superseded by D-xxx**.

Template:

```
## D-NNN — Title
- Date: YYYY-MM-DD
- Status: Accepted | Superseded by D-xxx
- Decision: what was decided
- Why: the reasoning and the alternatives considered
```

---

## D-001 — Project location and version control
- Date: 2026-11-23
- Status: Accepted
- Decision: All project files live in `~/dev/proj/freekards`, which is a local git repository with
  `main` as the default branch.
- Why: Requested in the kick-off prompt.

## D-002 — The spec folder is the source of truth
- Date: 2026-11-23
- Status: Accepted
- Decision: `/spec` holds every decision about look, feel, behavior, build, install, runtime, and
  process. It must be complete enough to rebuild the app from it alone. The kick-off prompt is kept
  verbatim in `00-provenance.md`.
- Why: Requested in the kick-off prompt.

## D-003 — Target platforms
- Date: 2026-11-23
- Status: Accepted
- Decision: Windows and Linux, each on ARM64 and x64. The app runs in its own native-feeling window
  and is delivered as an installer the end user can run herself.
- Why: The main device is an ARM Windows tablet, and the old Hoyle app cannot run on ARM.

## D-004 — Electron as the first runtime, with an engine-neutral spec
- Date: 2026-11-23
- Status: Accepted
- Decision: The first implementation uses Electron. Everything Electron-specific goes in
  `spec/runtimes/electron.md`. All other spec documents are engine-neutral, following the rules in
  `05-portability.md`, so the app can be rebuilt on another runtime such as Godot from the same core spec.
- Why: Electron gives the same rendering and audio everywhere and builds well for Windows ARM. The
  owner also wants to try other runtimes later and port the app by pointing at the existing spec.
  Alternatives considered: Tauri (weaker audio and WebKit on Linux, harder Windows ARM builds) and
  Godot (a possible future port).

## D-005 — Character voices are pre-generated text-to-speech clips
- Date: 2026-11-23
- Status: Accepted
- Decision: Each character has its own synthetic voice. Every dialogue line is turned into an audio
  clip once, ahead of time, with an offline text-to-speech tool, and the clips ship with the app. The
  app plays clips and never synthesizes speech at runtime. The text-to-speech tool and voice choices
  are an open question; the voice models must be licensed for redistribution.
- Why: Sounds the same on every machine and works offline. The operating systems' built-in voices
  vary widely in quality, especially on Linux.

## D-006 — Hearts is built first
- Date: 2026-11-23
- Status: Accepted
- Decision: Hearts is the first game. Building it also builds the shared foundation: table, cards,
  dealing and play animation, characters with speech bubbles and voice, sound, music, and settings.
- Why: It uses nearly every shared system, and it is a 4-player game with plenty of moments for
  character comments.

## D-007 — Source hosting and release builds
- Date: 2026-11-23
- Status: Accepted. Repository visibility superseded by D-012.
- Decision: The code lives in a private GitHub repository. GitHub Actions builds installers for all
  four targets on native runners. Runner details are in the runtime spec.
- Why: Real Windows ARM build machines, and a backup off this machine.

## D-008 — Hearts rule variants chosen per game
- Date: 2026-11-23
- Status: Accepted
- Decision: Hearts offers two rule sets, picked on the setup screen before each game: **Standard**
  and **Standard + Jack of Diamonds** (J♦ = −10). Full rules are in `06-hearts.md`.
- Why: Owner choice. Both are common, and having the choice costs very little.

## D-009 — The app supports themes from the start
- Date: 2026-11-23
- Status: Accepted
- Decision: The architecture supports interchangeable visual themes (cards, backs, table, chrome,
  character portraits, fonts, colors). The first theme is **Classic Casino**. A **Bright
  Illustrated** theme follows once basic gameplay works. See `07-themes.md`.
- Why: Owner choice. Building theme support in from the start avoids re-plumbing later.

## D-010 — Opponent roster, picked by the player, with layered difficulty
- Date: 2026-11-23
- Status: Accepted
- Decision: A roster of named characters, each with a personality and a skill adjustment. Before a
  game the player picks the opponents or chooses Random. A global **Easy / Medium / Hard** setting
  sets the baseline skill, and each character's adjustment is applied on top of it. See `08-characters.md`.
- Why: Owner choice. Variety and personality, with the overall challenge still in the player's control.

## D-011 — Development toolchain
- Date: 2026-11-23
- Status: Accepted
- Decision: The assistant installs the developer tools on the dev machine (Linux): Node.js LTS through
  nvm (per user, no sudo needed) and the GitHub CLI `gh`. The owner runs `gh auth login` himself.
- Why: Owner choice.

## D-012 — Public repository from day one
- Date: 2026-11-23
- Status: Accepted (replaces the "private" part of D-007; CI builds are unchanged)
- Decision: The GitHub repository is public from the first push.
- Why: Owner choice. FreeKards is an open-source project.

## D-013 — MIT license
- Date: 2026-11-23
- Status: Accepted
- Decision: The whole project, including original assets, is MIT-licensed:
  "Copyright (c) 2026 The FreeKards Contributors".
- Why: Owner choice. It is a simple, permissive, widely understood license.

## D-014 — Third-party code and assets: permissive licenses only
- Date: 2026-11-23
- Status: Accepted
- Decision: Everything shipped must use one of the allowed permissive or public-domain licenses listed
  in `09-licensing-and-sbom.md` §2. No copyleft, no non-commercial, no no-derivatives licenses.
  Build-time-only tools are exempt when their license puts no conditions on the output. The app's
  runtime platform is a documented exception (D-016).
- Why: Owner choice. It keeps the whole app cleanly compatible with MIT and leaves no question of
  rights. Alternative considered: allowing share-alike assets and LGPL code, rejected as adding
  obligations to track.

## D-015 — SBOM shipped in the app
- Date: 2026-11-23
- Status: Accepted
- Decision: A generated CycloneDX SBOM for code, a hand-maintained asset register, and a build-tools
  list live in `sbom/`, are checked in CI, ship inside the app, and are shown on an in-app
  About & Credits screen. Full details are in `09-licensing-and-sbom.md`.
- Why: Owner choice. Everyone can see what is used, where it came from, and under what license.

## D-016 — Runtime platform license exception
- Date: 2026-11-23
- Status: Accepted
- Decision: The app runtime is exempt from the permissive-only rule (D-014). For Electron, that covers
  Chromium and its bundled third-party components, including LGPL parts such as FFmpeg. The runtime
  ships unmodified with its own license files, which are listed in the SBOM and linked from the
  Credits screen. Each runtime spec must name its own exception, and any future port needs this
  exception reconfirmed for its runtime.
- Why: Owner approval. Without the exception, no modern web-based runtime could be used, and
  shipping the runtime unmodified with its license notices meets the LGPL's requirements.

## D-017 — Electron toolchain versions, pinned exactly
- Date: 2026-11-23
- Status: Accepted
- Decision: Electron 45.4.1, TypeScript 7.0.2, Vite 8.3.8, Vitest 5.1.1, electron-builder 26.18.0,
  @cyclonedx/cyclonedx-npm 7.0.1, @types/node 26.6.6, all pinned to exact versions with the lockfile
  committed. All of them are dev dependencies. There are no production npm dependencies so far.
  Details are in `runtimes/electron.md` §Stack.
- Why: These were the current releases at project start. Exact pins make builds reproducible and
  keep the SBOM stable. Each license was checked before adding it (all MIT or Apache-2.0).

## D-018 — Source tree layout, with logic isolation enforced by the compiler
- Date: 2026-11-23
- Status: Accepted
- Decision: Engine-neutral logic lives in `src/logic/`, presentation in `src/renderer/`, Electron
  processes in `src/main/`, and tests in `tests/`. `tsconfig.logic.json` compiles `src/logic` against
  the ECMAScript library only (no DOM, no Node types), so a platform import there fails the build.
  The full tree is documented in `runtimes/electron.md` §Source tree.
- Why: Spec 05 requires the logic layer to be portable. Enforcing that in the compiler is more
  reliable than relying on habit.

## D-019 — Electron process model and security settings
- Date: 2026-11-23
- Status: Accepted
- Decision: Sandboxed renderer (`contextIsolation`, `sandbox`, no `nodeIntegration`, no webview).
  Main and preload are compiled to CommonJS `.cjs`. A strict CSP allows only `'self'`. Navigation is
  blocked, and external links open in the system browser. There is no application menu, and the
  window opens maximized. Details are in `runtimes/electron.md` §Process model and §Native feel.
- Why: The app never needs remote content, so the tightest settings cost nothing.

## D-020 — SBOM generation and license gate tooling
- Date: 2026-11-23
- Status: Accepted
- Decision: `npm run licenses` (`scripts/check-licenses.mjs`) generates reproducible CycloneDX 1.6
  SBOMs for shipped code (`sbom/code.cdx.json`, with Electron added as the D-016 runtime component)
  and for all dependencies (`sbom/dev.cdx.json`). Both are committed. It enforces spec 09 §2 on
  shipped components and on the asset register, and lists development-only licenses that are
  outside the allowed list as build-only. The allowed list is mirrored in `scripts/license-policy.mjs`.
- Why: It implements D-015. Reproducible output keeps the committed SBOMs free of churn.

## D-021 — npm install scripts gated
- Date: 2026-11-23
- Status: Accepted
- Decision: The install script of `electron-winstaller` is denied in `package.json` `allowScripts`.
  Any new package that wants an install script needs an explicit decision.
- Why: That package is unused (we build NSIS installers, not Squirrel), and fewer install scripts
  means a smaller supply-chain risk.

## D-022 — Card ids, deck order, and seat numbering
- Date: 2026-11-23
- Status: Accepted
- Decision: Cards are two-character ids (rank char + suit char, e.g. `QS`, `TD`). The canonical deck
  order is C, D, S, H with 2 → A in each suit. Seats are 0 South (human), 1 West, 2 North, 3 East,
  in clockwise play order, and "left" is the next seat clockwise. See `10-core-logic.md`.
- Why: Compact, readable, easy to serialize, and the same ids name the theme's card-face files.

## D-023 — Mulberry32 random generator and Fisher–Yates shuffle
- Date: 2026-11-23
- Status: Accepted
- Decision: All randomness uses seeded Mulberry32, whose state is one 32-bit integer stored in the
  game state, and the shuffle is Fisher–Yates. Each AI player has its own generator. The exact
  algorithm and test vectors are in `10-core-logic.md` §3.
- Why: Deterministic replays (spec 05), a tiny serializable state, and easy to port exactly.

## D-024 — How the Hearts engine reads the rules
- Date: 2026-11-23
- Status: Accepted
- Decision: The `setup` phase lives in presentation, and the engine starts at `deal`. Scoring is
  entered automatically after trick 13, and a `continue` action moves on to the next hand or ends
  the game. Dealing always starts with West. A player holding only hearts and/or Q♠ on the first
  trick may play any of them, and the J♦ is not restricted on the first trick. `moon_shot_blocked`
  means one player took 13 of the 14 point cards and another took the last one. The full event
  table and order are in `06-hearts.md` §3–§4. The target score is an option (default 100).
- Why: These points were ambiguous in the original spec and had to be fixed to implement and test it.

## D-025 — Basic Hearts AI
- Date: 2026-11-23
- Status: Accepted (tuning expected later)
- Decision: A heuristic computer player that scores every legal card and then makes a skill roll:
  below `skill` it plays the best card, otherwise the 2nd-best (50%) or a random legal card. Memory
  (card tracking) is rolled against skill for each decision. Moon blocking needs skill ≥ 0.5, and a
  moon attempt needs a strong hand and a roll below `risk × skill`. All heuristics are in
  `06-hearts.md` §5.
- Why: It is simple and deterministic, the difference between difficulty levels shows up clearly
  in simulations, and every rule can be described in engine-neutral terms for porting.

## D-026 — GitHub repository and commit identity
- Date: 2026-11-23
- Status: Accepted (answers Q2; completes D-007 and D-012). The appId part is superseded by D-034.
- Decision: The public repository is https://github.com/richarddlarson/freekards, with remote
  `origin` and branch `main`. Commits use the owner's GitHub no-reply address
  (`49679068+richarddlarson@users.noreply.github.com`), set in the repo's git config, so no personal
  email appears in public history. The earliest commits were rewritten to that address before the
  first push. The electron-builder appId is `io.github.richarddlarson.freekards`, following the
  reverse-domain form of the owner's GitHub Pages domain. It must not change after the first public
  release, because Windows uses it to recognize upgrades.
- Why: Owner choices. The public history should not expose a personal email.

## D-027 — Card art: generated deck now, public-domain court art later
- Date: 2026-11-23
- Status: Accepted (answers Q18)
- Decision: Classic Casino card faces are generated by an in-repo script, with original simplified
  court cards. Later the court cards are redrawn from 19th-century court cards that are public domain
  because of their age. Details are in `07-themes.md`. Sources evaluated and rejected are in
  `09-licensing-and-sbom.md` §7.
- Why: No existing SVG deck met the "no question about rights" bar together with the classic look.
  Generating the deck avoids any rights question and doesn't hold up gameplay work.

## D-028 — Display targets and resolution scaling
- Date: 2026-11-23
- Status: Accepted (answers Q14)
- Decision: The primary device is a Surface Pro 9 (ARM): 2880×1920, 3:2, 200% Windows scaling.
  Supported screens range from 1920×1080 to 3840×2160, with aspect ratios from 16:9 to 3:2.
  Layout uses a 1920×1280 reference table, scaled uniformly; on wider screens the table surface fills
  the extra width. Details are in `11-display-and-layout.md`.
- Why: Owner-specified device and range.

## D-029 — Landscape only
- Date: 2026-11-23
- Status: Accepted
- Decision: There is no portrait layout. In portrait the table scales down to fit the width and stays playable.
- Why: Owner choice. A four-player table fits landscape naturally, and one layout halves design and testing work.

## D-030 — First character roster
- Date: 2026-11-24
- Status: Accepted
- Decision: The first roster has six original human characters, three male and three female, each a
  comic personality: Gus "Grumbles" Pettigrew, Dolores "Dot" Finchley, Chad "Coach" Brightwater,
  Prof. Marguerite Quill, Bernadette "Bernie" Kowalski, and Reginald "Reggie" Fairweather III. Each
  has a bio, art brief, voice brief, numeric traits, and 36–49 Hearts and general lines. The `kind`
  field is reserved for future non-human characters. Tone rules and the trigger system are in
  `08-characters.md`.
- Why: Owner request. Six is enough variety for 3-opponent games, and the main player will suggest
  future additions.

## D-031 — Canonical content data lives in spec/content
- Date: 2026-11-24
- Status: Accepted
- Decision: Engine-neutral content data files (character profiles and dialogue now; later perhaps
  game tables or layout data) live in `spec/content/` as the single canonical copy. Runtimes load
  them directly and never copy them. They are covered by the asset register, and the license check
  scans `spec/content/` as well as `assets/`. Binary assets (art, audio) stay in `assets/`.
- Why: The spec must be enough to rebuild the app. Dialogue is part of the design, so it belongs in
  the spec. Keeping one copy avoids drift.

## D-032 — Linux target: Linux Mint and other Debian/Ubuntu derivatives
- Date: 2026-11-24
- Status: Accepted (answers Q4)
- Decision: The main Linux target is Linux Mint, and with it other Debian and Ubuntu derivatives.
  The **.deb** package is the primary Linux installer. The AppImage is still built, as a portable
  no-install option. Flatpak and Snap are not built.
- Why: Owner choice. A .deb installs by double-click in Mint's package installer.

## D-033 — Product name "FreeKards" kept, with trademark precautions
- Date: 2026-11-24
- Status: Accepted (answers Q15)
- Decision: The product name is **FreeKards**, and the project owns the domain **freekards.org**
  for a future website. A name search on 2026-11-24 found no existing "FreeKards" product or
  trademark. It did find **KARDS** (US Reg. No. 5987037, 1939 Games ehf.), a live stylized mark for a
  WWII digital card game. To stay clearly distinct:
  1. Always write the name as one word, "FreeKards", in its own lettering. Never imitate the KARDS
     logo or typography.
  2. No war or military theme, art, or wording anywhere in the product.
  3. Be prepared to rename if asked. D-034 makes a rename cheap.
- Why: Owner choice after reviewing the search. The risk was judged low: "Kards" is a respelling of
  the generic word "cards", and the products, audiences, and business models are very different.
  This is not legal advice; the owner may check the USPTO directly or consult an attorney.

## D-034 — Internal identity separate from the brand
- Date: 2026-11-24
- Status: Accepted (replaces the appId in D-026). The `.deb` package name is amended by D-043.
- Decision: Everything the operating system uses to recognize the app uses a permanent,
  brand-free identity based on the internal codename **`cardtable`**. These values must never change:
  | Identifier | Value | Used for |
  |------------|-------|----------|
  | App ID (Windows AppUserModelID) | `io.github.richarddlarson.cardtable` | Taskbar grouping, shortcuts, notifications |
  | Windows installer GUID | `603b3361-eb1a-4e18-9d18-ef44b2392b21` | Uninstall registry key, upgrade-in-place detection |
  | User data folder name | `cardtable` (inside the OS app-data folder) | Settings, saves, statistics |
  | Package name | `cardtable` | npm package, `.deb` package (upgrades on Linux) |
  The brand "FreeKards" appears only in display-only places that can change freely: product name,
  window title, shortcut names, installer file names, `.exe` name, the Linux command name
  (`freekards`), and in-app text.
- Why: Owner request. A future rename must not break upgrades or lose the player's saved data.
  "cardtable" is never shown to users.

## D-035 — First playable Hearts table
- Date: 2026-11-24
- Status: Accepted
- Decision: Build the first playable version: main menu, Hearts setup screen, and the full Hearts
  table (deal, pass, play, collect, score, hand results, game over, pause), with the generated
  Classic Casino deck, placeholder portraits, toasts, and speech bubbles driven by the dialogue
  director. No audio yet. Screens, layout numbers, timings, and interaction are in
  `12-hearts-table.md`. Notable choices: **a single tap plays a legal card** (illegal cards are
  dimmed and shake if tapped); **trick cards are shown upright**; dialogs sit below center so speech
  bubbles never cover them.
- Why: It proves every shared system except audio, so it can go in front of the main player early.
  Single tap matches the original game and is the simplest touch gesture. Upright trick cards are
  easiest to read.

## D-036 — Engine-neutral presentation logic: layout math and dialogue director
- Date: 2026-11-24
- Status: Accepted
- Decision: Two pieces of presentation logic live in the engine-neutral logic layer (no DOM), so
  every runtime shares them and they are unit-tested:
  1. `layout` (`src/logic/layout/hearts-table.ts`): viewport fitting, every table position and
     hand placement, and the timing table.
  2. `dialogue` (`src/logic/dialogue/`): character types, the dialogue director (speaker choice,
     cooldown, queueing, repeat avoidance, bubble duration), and the mapping from Hearts events to
     triggers.
  The director takes time as a number of milliseconds and uses its own seeded generator, so it is
  deterministic. Speaker choice rolls the highest-weight candidate group first, then lower ones.
- Why: These rules are part of how the game feels, so a port must reproduce them exactly. Keeping
  them as pure logic makes that a copy rather than a re-design.

## D-037 — Development screenshot tool
- Date: 2026-11-24
- Status: Accepted
- Decision: `scripts/capture.cjs` renders any page (including the app with a demo hash such as
  `#hearts&seed=3&autoplay&speed=4`) in an **offscreen** Electron window at 60 fps and saves PNG
  screenshots at one or more times. The AI assistant uses it to check art and layout visually at the
  supported resolutions before showing work to the owner.
- Why: Visual changes need to be seen, not assumed. Hidden (non-offscreen) windows throttle frames,
  which stalls animations, so offscreen rendering is required.

## D-038 — Audio system
- Date: 2026-11-24
- Status: Accepted
- Decision: Three channels (Music 0.45, Effects 0.80, Voices 1.00 by default) plus Mute all. Slider
  position maps to gain as position squared. There are named sound cues with random variation, and a
  shuffled background playlist that crossfades over 3 s, plays continuously across screens, and
  pauses while the app is hidden. Cue-to-file mappings and the track list live in
  `spec/content/audio.json`. A **Sound** panel is reachable from the main menu and the in-game pause
  menu, and changes apply live and persist. Full design is in `13-audio.md`.
- Why: Owner request ("start with sound effects and music"). Data-driven cues keep the engine
  neutral, so a port only needs a player for named cues.

## D-039 — Audio sources: Kenney Casino Audio (effects) and FreePD (music)
- Date: 2026-11-24
- Status: Accepted. Default playlist chosen 2026-11-24 (see `13-audio.md` §3); the owner may swap tracks.
- Decision: Sound effects come from Kenney "Casino Audio" (CC0), downloaded manually by the owner,
  because the download page asks visitors whether they'd like to donate and that should not be
  scripted around. Music comes from FreePD's CC0 catalog: FreePD's license statement was verified on
  the Wayback Machine's 2024-06-01 copy of freepd.com. Because the site closed in 2025, each track is
  fetched from the Wayback copy of its original freepd.com URL, and that URL, the composer (from the
  file's tags), and the SHA-256 are recorded in the asset register. Files ship byte-for-byte as
  published. Rejected: Kevin MacLeod tracks from incompetech (licenses vary by track, some tracks are
  registered with content-claim services, and attribution is required), and the anonymous archive.org
  FreePD mirror as a download source (no provenance of its own).
- Why: CC0 with documented provenance meets the "no question" rights bar (D-014).

## D-040 — CI workflow: check job plus native installer matrix
- Date: 2026-11-24
- Status: Accepted
- Decision: One GitHub Actions workflow (`.github/workflows/build.yml`) runs on every push, PR, `v*` tag,
  and manual dispatch. A `check` job runs the license gate and SBOM drift check, then the tests and
  build. A `build` matrix then produces installers on **native** runners for Windows x64/arm64 (NSIS)
  and Linux x64/arm64 (deb + AppImage), uploaded as artifacts `freekards-<os>-<arch>` and kept for
  14 days. Permissions default to read-only, and superseded runs are cancelled. Full design is in
  `runtimes/electron.md` §CI. **Linux artifact names amended by D-057; triggers amended by D-059.**
- Why: Native runners give real ARM64 builds (especially Windows on ARM, for the Surface) without
  cross-compiling. Every push yields testable installers.

## D-041 — Releases are drafts created from version tags
- Date: 2026-11-24
- Status: Accepted
- Decision: Pushing a tag `vX.Y.Z` (matching `package.json` version) makes CI create a **draft** GitHub
  Release with all installers, `sbom/*.json`, and `LICENSE` attached. A person reviews and publishes it.
  Nothing is ever published automatically.
- Why: Keeps a human check before anything reaches users, while making the release itself one click.
  **Amended by D-069** (pre-release flag for 0.x, tag/version check, download guide, release steps under D-059).

## D-042 — CI actions pinned by SHA and listed in the build-tools SBOM
- Date: 2026-11-24
- Status: Accepted
- Decision: Only GitHub's own MIT-licensed actions are used, each pinned to a full commit SHA with a
  version comment and recorded in `sbom/build-tools.json` (scope `build`). The release step uses the
  preinstalled `gh` CLI rather than a third-party action. The SBOM drift check runs straight after
  `npm ci`, because Vite/Vitest caches in `node_modules` make npm's hidden lockfile stale.
- Why: SHA pinning protects against tag hijacking. Listing the actions keeps the "everything we use"
  promise of D-015. Running the check early keeps the committed dev SBOM reproducible.

## D-043 — The .deb package name shows the brand
- Date: 2026-11-24
- Status: Accepted (amends D-034 for Linux packages only)
- Decision: The Debian package is named **`freekards`**, not `cardtable`, because Linux Mint's
  installer shows the package name to the user ("freekards 0.1.0 is now installed"). Upgrade
  safety across renames comes from Debian's own mechanism instead: a renamed package declares
  `Replaces` and `Conflicts` on every earlier package name, so installing it cleanly removes the old
  one. The current package declares `Replaces: cardtable` and `Conflicts: cardtable`, which covers
  test installs of the pre-release `cardtable` package. Everything else in D-034 is unchanged: the
  app ID, Windows installer GUID, user-data folder (`cardtable`), and npm package name stay
  brand-free and permanent.
- Why: Owner request. Users should see "FreeKards", and Debian already has a standard way to move
  installs from one package name to another.

## D-044 — Music track chooser
- Date: 2026-11-24
- Status: Accepted
- Decision: The Sound panel gets a **Music track** drop-down: "Shuffle all tracks" (default) or one
  specific track, which plays immediately (crossfade) and repeats. The choice is remembered. Details
  are in `13-audio.md` §3.
- Why: Owner request: let the player change which track is playing at any time. Repeating a chosen
  track matches what a player expects after deliberately picking it.

## D-045 — All 10 music tracks, re-encoded to Opus 64 kbps
- Date: 2026-11-24
- Status: Accepted (replaces the "byte-for-byte MP3" part of D-039)
- Decision: Ship all 10 FreePD candidate tracks, re-encoded to Opus (Ogg) at 64 kbps VBR, 48 kHz
  stereo: about 16 MB in total, compared with 26 MB for the earlier 5 MP3s. `scripts/build-music.mjs`
  rebuilds them reproducibly. For each track in `spec/content/audio.json` it fetches the original
  from its recorded Wayback URL (cached in the git-ignored `.cache/music-src/`), verifies the
  recorded SHA-256, and encodes deterministically with ffmpeg and libopus. Originals are not
  committed. CC0 allows modification, so re-encoding raises no rights question. FFmpeg is a
  build-only tool (spec 09 §2) and is listed in `sbom/build-tools.json`.
- Why: Owner request: more choice in the track picker at a smaller download size. Opus at 64 kbps
  is close to the original quality for background music and plays natively in every target runtime.

## D-046 — SBOMs are generated from the lockfile
- Date: 2026-11-24
- Status: Accepted (refines D-020 and D-042)
- Decision: `scripts/check-licenses.mjs` runs cyclonedx-npm with `--package-lock-only`, so
  `sbom/code.cdx.json` and `sbom/dev.cdx.json` depend only on `package-lock.json`.
- Why: Generating from `node_modules` was non-deterministic. Builds and tests leave npm's hidden
  lockfile stale, which drops package hashes, so a locally committed SBOM differed from CI's fresh
  one and the first CI run on `main` failed its drift check. Reading the lockfile is reproducible
  everywhere and includes every locked package, including optional platform-specific ones.

## D-047 — Voice engine: Piper, with a clean voice-model shortlist
- Date: 2026-11-24
- Status: Accepted (answers Q17; per-character voice picks pending)
- Decision: Character voice clips are generated with **Piper** (`piper-tts` 1.8.0, GPL-3.0-or-later,
  a build-only tool that bundles espeak-ng, also GPL). Voice models come from `rhasspy/piper-voices`
  (model files MIT). A voice is eligible only if **its training data and every model it was
  fine-tuned from** are public domain, CC0, or CC-BY:
  | Voice | Data (license) | Trained from |
  |-------|----------------|--------------|
  | en_US-kristin-medium (F) | LibriVox (public domain) | scratch |
  | en_US-norman-medium (M) | LibriVox (public domain) | scratch |
  | en_US-john-medium (M) | LibriVox (public domain) | kristin |
  | en_GB-cori-high (F) | LibriVox (public domain) | scratch |
  | en_US-ljspeech-high (F) | LJ Speech (public domain) | scratch |
  | en_US-hifi_tts_92-medium (F) | Hi-Fi TTS reader 92 (CC BY 4.0, NVIDIA; LibriVox source) | scratch |
  | en_US-kathleen-medium (F) | CC0 | hifi_tts_92 |
  | en_US-joe-medium, en_US-mike-medium (M) | CC0 | rdh (nl_BE, CC0) |
  | en_GB-vctk-medium (109 speakers) | VCTK 0.92 (CC BY 4.0) | hifi_tts_92 |
  | en_GB-alba-medium (F), en_GB-aru-medium (12 speakers) | CC BY 4.0 | hifi_tts_92 |
  Ineligible: libritts / libritts_r (fine-tuned from lessac); lessac (Blizzard 2013 research
  license); ryan, hfc_male/female, semaine, l2arctic (non-commercial terms); northern_english_male,
  southern_english_female (CC-BY-SA); bryce (fine-tuned from an unreleased voice of unknown data);
  alan, amy, danny, kusal, arctic, jenny_dioco (license "see URL", not verified).
  When a CC-BY voice is used, its dataset credit goes in the asset register and on the Credits screen.
  **Text rule for TTS:** lines are sent to the engine with ALL-CAPS words lowered to normal case
  (espeak-ng can spell all-caps words letter by letter). The on-screen bubble text is unchanged.
- Why: Piper runs offline, produces good quality, and has per-voice model cards that make licensing
  verifiable. Checking the whole fine-tuning chain is needed because a clean dataset on top of a
  restricted base model is not clean.

## D-048 — Voice clip pipeline and in-game voice playback
- Date: 2026-11-24
- Status: Accepted
- Decision: `scripts/build-voices.py` synthesizes every line of every character that has a
  `voice.tts` block. It uses Piper 1.8.0 (installed automatically into the git-ignored
  `.cache/piper-env`) and voice models from `rhasspy/piper-voices` at pinned revision
  `e5349433ed883a32f893a434dc43a6c66b95ef7c`, each verified by MD5. Leading and trailing silence is
  trimmed, and clips are encoded to Opus 32 kbps mono at `assets/voices/<characterId>/<lineId>.opus`.
  `assets/voices/manifest.json` records a hash of text plus voice settings per line, so only changed
  lines are regenerated and clips for deleted lines are removed. Piper's synthesis is stochastic, so
  regenerated clips sound the same but are not byte-identical; the committed clips are canonical. In
  game, the opponents' clips are decoded when the table opens. A comment plays its clip on the Voices
  channel, music is ducked to 50% while it plays, and the bubble lasts max(2.5 s, clip + 0.6 s).
  Tapping the bubble stops the clip.
- Why: Owner request to add speaking. Pre-generated clips (D-005) give consistent voices offline,
  and incremental builds make editing dialogue cheap.

## D-049 — Local player profiles with a "Who's playing?" picker
- Date: 2026-11-24
- Status: Accepted
- Decision: Several local profiles per device, with no passwords. First launch asks for a name;
  two or more profiles bring up the "Who's playing?" picker at launch; the main menu shows the
  active player with **My stats** and **Switch player**. Hearts preferences move into the profile.
  Details are in `15-profiles-and-coins.md`.
- Why: Owner choice (R-001). A shared family tablet needs per-person stats and coins with no friction.

## D-050 — KardCoin economy (first version)
- Date: 2026-11-24
- Status: Accepted
- Decision: 500 welcome coins. A finished Hearts game pays by place, 100 / 40 / 15 / 5, multiplied by
  difficulty (Easy 1×, Medium 1.5×, Hard 2×) and rounded, plus 25 per moon the player shot. Abandoned
  games pay nothing. Play money only.
- Why: Owner choices. Everyone earns a little, winning earns most, and harder games are worth more.

## D-051 — Profiles stored as a JSON document through the runtime
- Date: 2026-11-24
- Status: Accepted
- Decision: Profiles are one JSON document. In Electron, the main process stores named documents at
  `<userData>/data/<name>.json` (the userData folder is `cardtable`, D-034). Names are limited to
  `[a-z0-9-]`, writes go to a temp file and are then renamed, the previous version is kept as
  `.bak`, and a damaged main file falls back to the backup. The preload exposes only
  `freekards.store.read/write`. Without the bridge (browser preview or the screenshot tool), the
  renderer falls back to localStorage.
- Why: Player progress is the most valuable data in the app, so it should survive crashes, be easy
  to back up as a plain file, and stay outside browser storage.

## D-052 — The currency is named "KardCoins"
- Date: 2026-11-24
- Status: Accepted
- Decision: The in-game currency is "KardCoins" ("KardCoin" singular). It is shown with an original
  drawn gold coin marked "K".
- Why: Owner's suggested name. A 2026-11-24 search found no existing product or trademark named
  KardCoins. The KARDS game (D-033) calls its currency "Diamonds", so there is no overlap. Not legal
  advice.

## D-053 — A per-player Settings panel
- Date: 2026-11-24
- Status: Accepted
- Decision: Add a **Settings** panel, opened from the main menu footer and from the in-game ☰ menu.
  Settings belong to the active profile, apply at once, and are saved immediately. Sound stays a
  separate device-wide panel. Details in `16-settings.md`.
- Why: Play-testing feedback (R-005): different players want different things, and more settings
  are coming. Being able to change them mid-game lets a player fix a problem the moment they notice it.

## D-054 — Card order setting: low cards on the left or on the right
- Date: 2026-11-24
- Status: Accepted (suit rule amended by D-064: suits never reverse)
- Decision: The player's hand can show low cards on the left (default, as before) or on the right.
  Reversal flips ranks within each suit. The ♣ ♦ ♠ ♥ suit groups stay in place because Hearts doesn't
  rank suits. A future game that ranks suits reverses the suit order as well.
- Why: Play-testing request (R-005). Owner's rule: reverse the suits too only "if there's an
  inherent order to the suits". Hearts has none; the order only alternates colors (spec 10).

## D-055 — Card response setting and drag to play
- Date: 2026-11-24
- Status: Accepted
- Decision: Three levels for how the player's own cards react: **Standard** (as before: tap counts
  on release, 280 ms flight), **Quick** (a card lifts the moment it is pressed, and flights are
  about twice as fast), and **Instant** (a card plays on press, with an 80 ms flight). Drag to play is
  added in Standard and Quick: a legal card follows the finger and plays if released at least half a
  card height above the hand. Default Standard. Exact values are in `16-settings.md` §3.
- Why: Play-testing feedback (R-005) that tapping or dragging a card felt laggy. Before this, a card
  reacted only when the finger lifted, and a drag did nothing until release, which reads as lag on
  touch. The owner found the old behavior fine, so it stays the default and the faster ones are
  choices.

## D-056 — Game speed setting
- Date: 2026-11-24
- Status: Accepted
- Decision: **Relaxed / Normal / Fast** multiplies the computer players' thinking time and the
  completed-trick pause by 1.5 / 1 / 0.5. Default Normal. Animations are unchanged.
- Why: Same play-testing feedback (R-005) that the game felt "a little laggy" overall. Owner chose to
  add it now rather than defer it.

## D-057 — One CI artifact per installer type
- Date: 2026-11-24
- Status: Accepted
- Decision: Linux CI jobs upload the `.deb` and the AppImage as separate artifacts,
  `freekards-linux-<arch>-deb` and `freekards-linux-<arch>-appimage`. Windows stays
  `freekards-win-<arch>`. Each Linux arch is still built once, with both targets in one run. The
  draft-release job is unchanged: it merges all artifacts.
- Why: Owner request. A tester downloads only the package they need (each is about 120–145 MB)
  instead of both.

## D-058 — Esc opens and closes the pause menu
- Date: 2026-11-24
- Status: Accepted
- Decision: On the Hearts table, Esc opens the pause menu like ☰. Pressing it again closes the
  topmost panel: Sound or Settings first, then the pause menu itself (resuming play). It is ignored
  on the Hand results and Game over dialogs. Details in `12-hearts-table.md` §4.
- Why: Owner request while play-testing: players with a keyboard expect Esc to pause. Having it
  also back out of panels follows the usual desktop convention.

## D-059 — One pull request per working session
- Date: 2026-11-24
- Status: Accepted
- Decision: Each working session's changes go on a `session/YYYY-MM-DD-<topic>` branch. It is
  pushed only when the owner asks, and becomes one pull request that the owner merges with a merge
  commit. Nobody pushes directly to `main`. CI runs on pull requests, pushes to `main`, `v*` tags,
  and manual dispatch; it no longer runs on every branch push. Steps in `04-process.md` §Git.
- Why: Owner request: "It would probably be best to capture each session of changes into a PR and
  then submit and merge that PR when we're ready, rather than automatically pushing to main with
  each change. That provides a better overall control of the changes and also gives us a better
  history to work with over time." Merge commits keep each decision's commit visible. Dropping the
  branch-push trigger avoids building the same commit twice (push and PR).

## D-060 — Fira Sans for the interface, jumbo outlined indices on the cards
- Date: 2026-11-24
- Status: Accepted
- Decision: The interface font is **Fira Sans** (Medium for normal text, Bold for bold), bundled
  with the app instead of relying on installed fonts. The Classic Casino card faces get a **jumbo
  corner index**: the rank's capital height is 60 of the card's 350 units (about 17%), set in
  **Fira Sans Condensed Bold**, with a 40-unit suit symbol under it, in a column at the card's left
  edge. "10" is set tight and narrowed slightly to keep the column slim. The card generator converts
  all lettering to vector outlines (opentype.js), so the faces need no font at run time. To clear
  the bigger indices, the pips move toward the middle, the court pictures shrink to 80%, and the
  A♠ ring gets smaller. Both fonts are OFL-1.1 and are listed in the asset register. Details in
  `07-themes.md`.
- Why: Owner request after his wife's play-testing: a clearer, heavier font that is easier to read
  (R-006). The owner and his wife chose Fira from an audition of four OFL fonts against the old
  look. The old font, DejaVu Serif, is not installed on Windows, so Windows showed Georgia instead.
  Index size and weight were measured from a photo the owner supplied of an older commercial Hearts
  game. Only the proportions were taken from it, as the owner directed.

## D-061 — Bigger cards for the player's hand and the trick
- Date: 2026-11-24
- Status: Accepted
- Decision: A full-size card is **183 × 256** logical units (its height is 20% of the reference
  table height), up from 150 × 210. The player's hand and the trick use full-size cards. Trick
  cards were 0.9 scale; they are now 1, and the trick slots move out to ±195 / ±140 so the cards
  don't overlap. Opponents' face-down fans keep their old size (scale 0.45 of the new card).
  The hand fans tighter: spacing is 60–80 instead of 40–86, which always leaves the corner index
  visible. Details in `12-hearts-table.md` §2.
- Why: Owner request after his wife's play-testing: the cards were too small (R-006). The owner
  chose to enlarge only her own cards and the trick. Card height = 20% of the table and full-size
  trick cards follow the proportions of the reference photo (D-060).

## D-062 — Card decks: a per-player choice, starting with Classic and Rounded
- Date: 2026-11-25
- Status: Accepted
- Decision: A theme provides one or more **card decks**. A deck is a full set of 52 faces plus a
  back, and decks can differ in index font, colors, and (later) artwork. Each player picks a deck in
  Settings (**Card deck**, spec 16 §5). The choice is saved in their profile and applies at once,
  even mid-game. Classic Casino ships two decks:
  - **Classic** (default): the existing deck. Fira Sans Condensed Bold indices, red backs.
  - **Rounded**: Nunito ExtraBold indices (OFL-1.1), blue backs. It has the same layout, pips, and
    court pictures as Classic.

  Files live in `assets/themes/<theme>/decks/<deck>/faces/{rank}{suit}.svg` and `…/<deck>/back.svg`,
  all written by the card generator from one deck table. The old per-theme `cards/backs/red.svg`
  and `blue.svg` became the two decks' backs, so a back is no longer chosen separately. Nunito is
  only published as a variable font, so a static ExtraBold instance was cut with fontTools and
  committed; the asset register records how. Details in `07-themes.md` §Card decks.
- Why: Owner request after his wife's play-testing: the card font still felt too sharp, and she
  wanted a more rounded look. The owner proposed decks as a setting so each player can choose, which
  also sets up more personalization later. The owner and his wife picked Nunito ExtraBold from an
  audition of six rounded OFL fonts drawn by the real card generator. The interface font is unchanged
  (Fira Sans, D-060).

## D-063 — Run local builds from a desktop menu entry
- Date: 2026-11-25
- Status: Accepted
- Decision: On a Linux development machine, `scripts/install-local-launcher.sh` adds a
  **FreeKards (local build)** entry to the desktop menu. It runs `scripts/run-local.sh`, which builds
  whatever branch is checked out (`npm run build`, with nvm loaded) and starts it with the repo's
  Electron. It shows a desktop notification naming the branch and commit, and another if the build
  fails; the build output goes to `.cache/run-local.log`. A local build uses the same player data
  as an installed FreeKards (`~/.config/cardtable`). Because only one copy can run at a time, the
  launcher stops with a notice if the installed app is open. Details in `runtimes/electron.md`
  §Running a local build.
- Why: Owner request: an easy way to run each new version on the Linux Mint development machine
  without reinstalling a `.deb` every time. Sharing the data folder keeps his and his wife's
  profiles and settings in both.

## D-064 — Card order never reverses the suits
- Date: 2026-11-25
- Status: Accepted (amends D-054)
- Decision: "Low cards on the right" only reverses the ranks within each suit. The suit groups
  always stay in the default left-to-right order, in every game, including future games that rank
  suits. This drops D-054's rule that such games would reverse the suit order too. Hearts is
  unchanged: it never reversed suits.
- Why: Owner, passing on his wife's play-testing: "she loves the "low cards on the right" option we
  added, but my assumption that we needed to also reverse the suits was incorrect. We need to keep
  the suits in the same order they are on the default "low cards on the left"."

## D-065 — Face-up hands show hearts, spades, diamonds, clubs
- Date: 2026-11-25
- Status: Accepted (replaces the C, D, S, H display sort that spec 10 §1 described; the deck order of D-022 is unchanged)
- Decision: The player's face-up hand is grouped by suit in the order ♥ ♠ ♦ ♣, left to right, in
  both Card order choices (only the ranks within a suit flip, D-064). The colors still alternate. The
  canonical deck order (C, D, S, H) used for dealing is unchanged, so seeded games deal the same
  cards. The order is fixed for now; a per-player suit-order setting may come later.
- Why: Owner, passing on his wife's play-testing: there is no official suit order for trick-taking
  games, and she wants "this order (left to right): hearts, spades, diamonds, clubs. This may be
  specific to Hearts since hearts and spades are important. For now let's just make that the default
  order when showing a hand face-up on the screen. Later we may add a user-setting to allow the user
  to choose which suit-order they prefer, but not yet."

## D-066 — About & Credits screen
- Date: 2026-11-25
- Status: Accepted (implements spec 09 §5)
- Decision: An **About** button on the main menu (bottom row: Sound, Settings, About, Quit) opens
  the About & Credits screen. Its header shows "FreeKards", the version, a one-line description with
  "MIT License", and a link to the GitHub repository. Two tabs follow. **Credits** lists the shipped
  software (the runtime, with buttons that open its own license notices) and then every entry in the
  asset register, grouped as Music, Character voices, Sound effects, Fonts, Artwork, and Game
  content. Each entry shows its title, author, license, attribution text, and source link.
  **Licenses** shows the full text of every license in use: MIT (FreeKards), CC BY 4.0, CC0 1.0, and
  each font's own OFL.txt. All of this is bundled into the app at build time, so it works offline. The
  Creative Commons legal texts are stored in `assets/licenses/`, unmodified from creativecommons.org,
  which dedicates them to the public domain under CC0.
- Why: Spec 09 §5 requires it, and several voices are CC BY 4.0, whose attribution should be visible
  to players. It was a prerequisite for the first public release (D-069).

## D-067 — App icon: three fanned cards on the felt
- Date: 2026-11-25
- Status: Accepted
- Decision: The app icon is three fanned playing cards on a rounded-square green felt tile with a gold
  rim: the blue (Rounded) and red (Classic) deck backs behind, tilted 18° each way, and a white card
  in front with a large red heart. It is original geometry drawn by `scripts/generate-icon.mjs`,
  using the card generator's suit shapes and the Classic Casino palette. Full geometry is in spec 07
  §App icon. The same image is used on every platform, and electron-builder derives the Windows
  `.ico` and the Linux icon sizes from one 1024×1024 PNG.
- Why: Owner's choice from four drafts (fanned cards, a tilted ace of hearts, the four suits on a
  disc, a casino chip with a heart), compared at 256 px and at 64 to 16 px on light and dark
  backgrounds. The fan says "card games" rather than only Hearts, stays readable at 16 px, and
  avoids a gambling look.

## D-068 — Windows installers stay unsigned for now
- Date: 2026-11-25
- Status: Accepted (answers Q3 for the first release; the signing route is still open, see Q3)
- Decision: The first releases ship unsigned Windows installers. The release notes and README tell
  Windows users how to get past the SmartScreen warning (More info → Run anyway).
- Options researched on 2026-11-25 (Microsoft Learn "Code signing options for Windows app developers",
  updated 2026-11-10; signpath.org/terms.html):
  - **Signing an .exe no longer avoids the warning on its own.** Since 2024, OV and EV certificates
    and Azure Artifact Signing all start with no SmartScreen reputation. The warning fades as a
    consistently signed publisher builds download reputation, with no published threshold.
  - **Microsoft Store (MSIX):** free for individuals (ID and selfie check). The Store signs the
    package, installs it with no SmartScreen warning, updates it automatically, and supports ARM64.
    It needs a Store listing (description, screenshots, age rating, privacy policy) and an MSIX build
    target. A Store install keeps its data apart from a GitHub-installed copy.
  - **Azure Artifact Signing** (formerly Trusted Signing): about $9.99/month on a paid Azure
    subscription. Individuals must be in the US or Canada. The publisher shown is the person's legal
    name. It signs in CI with no hardware token.
  - **SignPath Foundation:** free for OSS. The project must already be released and have "a certain
    verifiable reputation", and applications are sometimes rejected. "SignPath Foundation" is shown as
    publisher. Every release needs manual approval, the team needs MFA, and the home page needs a
    "Code signing policy" section.
  - **Certum Open Source** certificate: low cost, but the key lives on a smart card or the SimplySign
    cloud, which is awkward for CI.
- Why: Owner's choice: release now and decide on signing later. Signing alone would not remove the
  warning for a new publisher anyway, and SignPath requires an existing public release.

## D-069 — First release: v0.1.0, as a pre-release
- Date: 2026-11-25
- Status: Accepted (extends D-041; release steps updated for D-059)
- Decision: The first release is **v0.1.0**, containing Hearts and everything built so far, plus
  the app icon (D-067) and the About & Credits screen (D-066), which were required before release.
  Every `0.x` release is marked as a **pre-release** on GitHub; from `1.0.0` on, releases are normal.
  The CI release job checks that the tag matches the `package.json` version and prepends a
  download guide (`.github/release-header.md`: which file for which computer, plus the SmartScreen
  note) to GitHub's generated notes. The version bump goes through the session pull request like
  any other change (D-059). After the owner merges, the merge commit on `main` is tagged.
- Why: Owner's choice. A pre-release tells visitors the game is still being play-tested. The tag
  check stops an installer from carrying the wrong version number.

## D-070 — Spades rules (first version)
- Date: 2026-11-25
- Status: Accepted (made by the assistant while the owner was away, at his request; approved by the owner after play-testing, 2026-11-25)
- Decision: Partnership Spades as in spec 17: the player and North against West and East, spades
  always trump and not led until broken, bids 0 (Nil) to 13 taken clockwise from the dealer's left,
  10 per bid trick when made, −10 per bid trick when set, +1 per overtrick, every 10 bags −100, Nil
  ±100 with the Nil bidder's tricks counting as bags rather than toward the partner's bid. Game to
  **300** (default) or 500, and a team at −200 or below ends the game. South deals hand 1, so the
  player sees the other three bids before her first bid. No blind Nil and no minimum team bid in this
  version.
- Why: The owner asked for Spades next ("make any decisions on it that you would ask me"). These
  are the most widely played partnership rules (as described on pagat.com and in common apps),
  kept simple for a first version. 300 is the default because a 500-point game between Medium
  players takes about 14 hands, twice a typical Hearts game (D-071). This answers the Spades part of
  Q8 for now.

## D-071 — Spades computer players
- Date: 2026-11-25
- Status: Accepted (tuning expected)
- Decision: The Spades AI estimates tricks from high cards, spade length, and ruffing chances, then
  bids that estimate **minus 0.5** (plus skill noise), and bids Nil on weak hands with no
  dangerous cards depending on its risk trait. In play it scores each legal card with a fixed
  priority list: protect its own Nil, cover its partner's Nil, try to break an opponent's Nil, then
  win tricks while its team (or a chance to set the opponents) needs them and duck once the contract
  is made. It uses the same skill roll and "memory" model as Hearts. Full rules and the measured
  results are in spec 17 §7.
- Why: The same proven structure as the Hearts AI (D-025) keeps difficulty consistent across games.
  The −0.5 hedge was chosen by simulation: it raised Hard-skill contracts made from 74% to 91% and
  shortened games, while larger hedges caused more bag penalties.

## D-073 — Spades statistics and KardCoins
- Date: 2026-11-25
- Status: Accepted (approved by the owner, 2026-11-25)
- Decision: Each profile also keeps Spades statistics (spec 15 §2) and Spades preferences
  (difficulty, game length, and the partner and opponents, or Random). A finished Spades game pays
  **80 KardCoins for a win or 10 for a loss**, × the difficulty multiplier (Easy 1, Medium 1.5,
  Hard 2), plus **+25 for each Nil the player made** (not multiplied). The history reason reads, for
  example, "Spades: won (Medium) + 1 Nil". Profiles saved before Spades existed get empty Spades
  statistics and default preferences when loaded.
- Why: The Hearts table pays 40 coins per game on average at Easy (100/40/15/5 for the four places).
  A Spades game is won or lost by a team, so about half the time, and 80/10 gives a similar average
  (45) while still rewarding the win. The Nil bonus mirrors the Hearts moon bonus.

## D-074 — Spades dialogue
- Date: 2026-11-25
- Status: Accepted
- Decision: Spades adds partnership triggers (spec 08 §Triggers): `spades.bid_nil`,
  `spades.nil_made`, `spades.nil_failed`, and `spades.trumped`, seen as `self`, `partner`, or
  `opponent`, and `spades.set` and `spades.bags`, seen as `us` or `them`. The shared `game.*`, `hand.*`, and
  `idle.human` triggers are reused with Spades meanings: a hand is "good" for the team that scored
  more that hand. All six characters got 26 new lines (156 in total), written in character with
  their running jokes, and voiced with their existing Piper voices (D-048).
- Why: Spades is played with a partner, so reactions to a partner's Nil or a well-timed trump are
  what make the table feel alive. Reusing the shared triggers keeps every existing line useful.

## D-072 — Spades screens, and a shared trick-taking table
- Date: 2026-11-25
- Status: Accepted (approved by the owner, 2026-11-25)
- Decision: The main menu gets **Play Hearts** and **Play Spades** side by side as the two gold
  buttons, with the five games still to come below them. Spades has its own setup screen and table
  (spec 17 §8, spec 12 §8): a bid panel with Nil and 1–13 and a **Suggested** bid, a "Bid 3 · Won 1"
  badge by each player, a two-team score panel, a per-team hand summary, and a team game-over
  screen. My stats shows Hearts and Spades side by side. Technically, everything the two games
  share (dealing, card gestures, trick play, speech bubbles, the pause menu, the coin award) moved
  from the Hearts table into one shared table class that each game extends, so Hearts behaves
  exactly as before and later trick-taking games reuse it.
- Why: Spades should look and feel like the Hearts table she already knows. The suggested bid helps
  a player who is new to bidding. It uses the same estimate as the computer players and can be ignored.

## D-075 — Card generator guards against invalid path numbers
- Date: 2026-11-25
- Status: Accepted (bug fix)
- Decision: The card generator snaps outline coordinates within 1e-9 of zero to exactly 0 before
  writing them, and refuses to write path data containing `NaN` or `Infinity`. A test checks every
  generated card (`tests/logic/card-art.test.ts`).
- Why: The owner found cards with no rank in the corner, in both Hearts and Spades: every 8 in the
  Rounded deck. The Nunito "8" has its contours starting exactly on the line the index is centered
  on, so after centering those x-coordinates were float leftovers like 3.5e-15. opentype.js 2.0.0
  formats such values as "NaN", and the browser then drops the whole rank path. The fix changed only
  those four card files.


## D-076 — Gin Rummy rules (first version)
- Date: 2026-11-25
- Status: Accepted (made by the assistant at the owner's request; approved by the owner, 2026-11-25)
- Decision: Standard 2-player Gin Rummy as in spec 18 §2: 10 cards each, the upcard offered first to
  the non-dealer, knock with 10 or less deadwood, 25 for gin or an undercut, lay-offs only after a
  plain knock, game to **100** with 25 per hand won, a 100-point game bonus, and a doubled shutout.
  The Ace is always low. A hand is dead when a discard leaves 2 cards in the stock. The computer
  deals first and the deal alternates. Melds, lay-offs, and the defender's best split are arranged
  **automatically** rather than by hand. No Big Gin and no Oklahoma variant in this version.
- Why: These are the rules in most rule books (pagat.com) and common apps. Arranging melds
  automatically is what computer Gin usually does: it removes fiddly drag-and-drop at the reveal and
  never costs the player points, because the arrangement is always the best one. 100 points takes
  about 7–8 hands between Medium players, a game length close to Hearts.

## D-077 — Rummy 500 rules (first version)
- Date: 2026-11-25
- Status: Accepted (made by the assistant at the owner's request; approved by the owner, 2026-11-25)
- Decision: 2-player Rummy 500 as in spec 18 §3: 13 cards each, a spread discard pile from which any
  card can be taken with all the cards above it (a card below the top must be used at once, in the
  next meld or lay-off), lay-offs on either player's melds score for the one who lays off, Ace low or
  high and worth 15, going out needs no final discard, the hand ends when the stock runs out, and the
  game is to **500**. The computer deals first and the deal alternates. No "calling rummy" on a
  missed lay-off, and no extra bonus for going out.
- Why: This is the common 500 Rum (pagat.com) for two players. "Must use it at once" is the usual
  pick-up rule, and enforcing it as "the next play" keeps a player from getting stuck with a card
  they can no longer meld. 500 is the game's name and takes about 4 hands, so no shorter option is
  needed. "Calling rummy" is left out because it would make the player watch for the computer's
  mistakes and is easy to miss on a tablet.

## D-078 — Gin Rummy and Rummy 500 computer players
- Date: 2026-11-25
- Status: Accepted (tuning expected)
- Decision: Both AIs use the same skill roll and "memory" model as Hearts and Spades. Gin: take a
  discard only if it joins a meld or allows a knock, knock early while the stock is deep and only
  with very low deadwood near the end, and discard the card that leaves the least deadwood, valuing
  live partial melds and avoiding cards the opponent seems to collect. Rummy 500: plan the most
  points that can go down, weigh each possible pick-up against the points it would leave stuck in
  hand, meld everything it can, and avoid discards the opponent can lay off. Rules and measurements
  are in spec 18 §2.9 and §3.8.
- Why: Simple, explainable heuristics that play recognizably well and scale cleanly with skill
  (measured by simulation). Rummy 500 is luckier than Gin, so its difficulty gap is smaller.

## D-079 — Gin Rummy and Rummy 500 statistics and KardCoins
- Date: 2026-11-25
- Status: Accepted (made by the assistant at the owner's request; approved by the owner, 2026-11-25)
- Decision: Each profile keeps Gin and Rummy 500 statistics and preferences (difficulty and
  opponent, or Random) (spec 15 §2). Both games pay **80 KardCoins for a win or 10 for a loss**, ×
  the difficulty multiplier, like Spades; Gin adds **+25 per gin** the player went (not multiplied).
  History reasons read "Gin Rummy: won (Medium) + 1 gin" and "Rummy 500: lost (Easy)". Profiles saved
  before these games get empty statistics and default preferences when loaded.
- Why: A 2-player game is won about half the time, like Spades, so the same 80/10 keeps coin earning
  even across games. Gin is the rare, exciting moment worth a bonus, like a moon or a Nil; Rummy 500
  has no equivalent rare event (going out happens almost every hand).

## D-080 — Gin Rummy and Rummy 500 dialogue
- Date: 2026-11-25
- Status: Accepted
- Decision: New triggers (spec 08 §Gin Rummy and Rummy 500 triggers): `gin.gin`, `gin.knock`,
  `gin.undercut`, `gin.dead_hand`, `gin.took_discard`, `rummy.went_out`, `rummy.caught`,
  `rummy.took_pile`, `rummy.layoff`, and `rummy.big_meld`, seen as `self` (the computer) or `human`.
  All six characters got two lines for each of the 17 triggers (204 in total), voiced with their
  existing Piper voices. Two existing lines that assumed four players were reworded and re-voiced:
  Marguerite's opener ("Fifty-two cards…" instead of "Four players, fifty-two cards…") and one of Gus's
  "you did well" lines ("You're making me look bad…" instead of "…the rest of us…").
- Why: The 2-player games have their own big moments (gin, undercuts, big pick-ups, getting caught),
  and the shared game-start, hand, and idle lines still fit a 2-player table.

## D-081 — Gin Rummy and Rummy 500 screens, and a shared base for every table
- Date: 2026-11-25
- Status: Accepted (made by the assistant at the owner's request; approved by the owner, 2026-11-25)
- Decision: The main menu has four gold play buttons in two rows: **Play Hearts | Play Spades** and
  **Play Rummy 500 | Play Gin Rummy**; Blackjack, Poker, and Solitaire stay "coming soon". Each new game
  has a setup screen with Difficulty and one opponent (or Random). The 2-player table (spec 18 §4) puts
  the computer at the top, the stock and discard pile in the middle (Rummy 500's pile spread out so
  every card shows), a meld row for each player, and the player's hand at the bottom with an
  **Arrange** button (Melds, the default, then Suit, then Rank; the Ace sorts low). Play is by tapping
  cards to select them and confirming with buttons in an action bar above the hand (Discard, Knock /
  Gin!, Meld, Lay off), with a prompt saying what to do next; dragging a card to the discard pile also
  discards it. Taking cards from deep in the Rummy 500 pile always asks for confirmation. Gin's end of
  hand shows both hands melded and the lay-offs moving before the results. **My stats** now shows one
  game at a time, with a tab per game, beside Recent KardCoins. Technically, everything all tables
  share (portraits, bubbles, dialogs, pause menu, coin award) moved into one base class, which the
  trick-taking table and the new rummy table extend.
- Why: Two taps (select, then confirm) instead of one avoids accidental discards and knocks on a
  tablet, where a mis-tap can't be undone, and the buttons only light up when the move is legal, which
  teaches the rules as she plays. Showing melds automatically helps a player who is new to Gin see
  her deadwood. Four game columns no longer fit on My stats, so it got tabs. The menu name stays
  "Rummy 500", as in the requirements (spec 01) and the old menu.

## D-082 — A Rules screen for every game
- Date: 2026-11-25
- Status: Accepted (asked for by the owner; the details were chosen by the assistant and approved by the owner, 2026-11-25)
- Decision: Every game has a **Rules** panel (spec 12 §10), opened from a round **?** button beside ☰
  on the table, from **Rules** in the pause menu, and from a **Rules** button on the game's setup
  screen. Opening it from the table pauses the game. The panel has a contents list of sections on the
  left and the scrolling text on the right. The text for each game is a Markdown file in
  `spec/content/rules/`, written in plain language for a new player: the goal, the deal, the order of
  play as numbered steps, special rules, scoring, winning, the rules FreeKards chose where versions
  differ (the decisions in D-008, D-070, D-076, D-077), how KardCoins are earned, and how to use the
  table's controls. A test checks that each file has the required sections and that its numbers match
  the engines. Every new game gets a rules file as part of being built.
- Why: A **?** icon is the familiar sign for help and needs no reading, and keeping it on the table
  means the rules are one tap away mid-hand, when a question actually comes up. Putting the text in
  `spec/content` keeps it editable without touching code and keeps it part of the source of truth.
  Explaining the house choices (for example, Gin's Ace is always low, Rummy 500 has no "Rummy!" call)
  heads off "that's not how we play it" surprises. The engine check stops the text drifting from the
  rules if a number is changed later.

## D-083 — App icon renders without scrollbars
- Date: 2026-11-25
- Status: Accepted (bug fix)
- Decision: The icon renderer (`scripts/render-icon.cjs`) shows the SVG as a block element on a page
  with scrolling turned off, and the icons were regenerated. A test decodes `build/icon.png` and checks
  that everything outside the tile, including the right and bottom edges, is fully transparent.
- Why: The owner saw a thin extra line along the right and bottom of the icon in the Linux panel. The
  SVG had been placed inline, so it sat on a line of text whose descender space made the page a few
  pixels taller than the 1024 px window. The page then showed scrollbars, and the capture included
  them: a light-gray strip down the right and along the bottom of `build/icon.png`. Every smaller
  Linux size and the Windows `.ico` are made from that image, so they all carried the line.

## D-084 — Longer test time limit, and re-tagging a failed release build
- Date: 2026-11-25
- Status: Accepted (bug fix)
- Decision: Every test may run for up to **60 seconds** (`testTimeout` in `vitest.config.ts`), instead of
  Vitest's 5-second default. If the build for a release tag fails before its draft release exists, the
  tag is deleted, the fix goes through a session PR, and the new merge commit is tagged
  (`runtimes/electron.md` §How to cut a release). A published release's tag is never moved.
- Why: The first v0.2.0 tag build failed because the Spades simulation test (200 AI-only games) took
  just over 5 seconds on a busy GitHub runner, although it passed on the same code minutes earlier.
  The simulations are meant to be long; a real hang still fails, just later. No release had been
  created, so moving the tag was safe, and it keeps the version number the owner asked for.


## D-085 — Gin Rummy discard prompt says "Lowest deadwood after discard"
- Date: 2026-11-27
- Status: Accepted (owner request)
- Decision: In Gin Rummy, the discard prompt with no card selected reads "Choose a card to discard ·
  Lowest deadwood after discard: N" (it was "Best deadwood: N"). N is unchanged: the least deadwood any
  legal discard would leave (spec 18 §4.4).
- Why: While play-testing, the owner asked what the number meant. "Best deadwood" did not say that it
  counts the hand after a discard, or that it is the lowest of the possible discards.

## D-086 — Felt texture and a choice of table colors
- Date: 2026-11-27
- Status: Proposed (texture strength and colors chosen by the assistant; owner to review on the table)
- Decision: The table felt gets a fine generated noise texture, blended with "overlay" over its color
  gradient, so it reads as felt rather than a flat shade. A new per-player setting, **Table color**,
  offers five felts: Green (default, unchanged), Blue, Burgundy, Gold, and Amber. Panels, dialogs, and
  drop-down lists take a dark tint of the felt's color. Exact values: `07-themes.md` §Classic Casino
  table felt; the setting: spec 16 §6.
- Why: Owner request (R-009): most card games give the table "a very light, subtle texture like it is
  felt", and players should have more colors, "blue and maybe some subtle shades of dark red and/or
  gold or orangish, but nothing too garish". The texture is generated by code, not an image, so there
  is no asset to license and it scales to any screen. Overlay blending keeps each felt's hue. The
  colors are dark and muted, like the existing green, so the white cards, gold text, and brass trim
  still stand out. Three texture strengths and four grain styles were compared on all colors; the
  "fine, medium" grain was chosen as visible up close but quiet at a glance. Gold and Amber are both
  offered because the owner named both "gold" and "orangish".

## D-087 — Felt texture that holds up on 4K screens
- Date: 2026-11-27
- Status: Proposed (owner to review on his 4K monitor and the tablet)
- Decision: The felt texture of D-086 is replaced by two noise layers: a **grain** a few logical units
  across (base frequency 0.5) with its contrast stretched, and faint sideways **fibers**. Each tile is
  drawn at 4× resolution. Exact values: `07-themes.md` §Classic Casino table felt.
- Why: The owner reported that on his 4K monitor every felt looked smooth. D-086's grain was about one
  logical unit across, so at 1080p it showed as pixel-level speckle, but when the table is scaled up
  about 1.6× for 4K it was smoothed away. Measured fine-detail contrast at 4K was 1.6 (out of 255) with
  the old texture and 3.2 with the new one; at 1920 × 1280 it went from 2.4 to 4.2. Six variants were
  compared at both scales: a coarser grain looked like sandpaper, and a large mottle looked cloudy.

## D-088 — Poker: Five-Card Draw, fixed limit, for KardCoins
- Date: 2026-11-27
- Status: Proposed (chosen by the assistant at the owner's request; listed for his review)
- Decision (stakes superseded by D-096): The first poker game is **Five-Card Draw** for the player and three computer players
  (spec 19 §2): antes, no opening requirement, **fixed-limit** betting (small bet before the draw, big
  bet after, a bet and three raises per round), one draw of **0 to 5 cards**, standard hand ranks with
  the A-2-3-4-5 straight, no wild cards, split pots with side pots. Three stakes, Low 5/10/20, Medium
  10/20/40, High 25/50/100 (ante/small/big), with buy-ins of 200, 500, and 1,000 (spec 19 §3). Hand
  ranking, pots, and betting are separate modules so later variants reuse them.
- Why: Owner request (R-010): "basic 5 card draw poker", the first game that uses KardCoins, with more
  poker variants and Blackjack to follow. Fixed limit keeps the choices to a few big buttons (no bet
  sizing) on a tablet and keeps the computer players simple and predictable; no-limit can come with
  Hold'em. No openers ("Jacks or better") and a free choice of discards make the game easier to learn;
  the computer players' strategy still behaves like a Jacks-or-better table (§5.3). Four seats reuse
  the Hearts and Spades table positions. Settles open question Q6.

## D-089 — Five-Card Draw computer players
- Date: 2026-11-27
- Status: Proposed (tuned by simulation)
- Decision: Computer players estimate their chance of winning by dealing out random hands for the
  other players (and, before the draw, playing out everyone's draw), filtered by what each player has
  shown when the skill roll succeeds, then compare it with fair-share and pot-odds thresholds; risk
  adds bluffs and loose calls (spec 19 §5).
- Why: Simulated equity handles every situation (draws, number of opponents, after the draw) with one
  rule instead of a hand-strength table per case, and the "read" maps skill onto something a person
  would recognize as better play. With a single bar for betting and raising they checked 657 of 896
  first-round decisions and 90% of hands reached a showdown, so betting and raising got separate bars.

## D-090 — The casino regulars: computer players with their own KardCoins
- Date: 2026-11-27
- Status: Proposed (chosen by the assistant at the owner's request; listed for his review)
- Decision: Every computer character keeps a KardCoin balance, **per player profile**, starting at
  500. After each game the player finishes, the regulars who played are paid like her for their own
  result (no special bonuses), and everyone else plays one simulated background game: a coin-earning
  game (a Hearts-style finish weighted by skill) or, with 200+ coins and chance 0.35, a betting game
  that can win or lose a share of their balance (weighted by skill and sized by risk). Older profiles
  catch up one background round per finished game. Poker chips come out of the player's and the
  regulars' balances at the buy-in and go back when the player leaves; chips are saved after every
  hand and returned if the app closes mid-session (spec 15 §6).
- Why: Owner request (R-010): the regulars should start at 500 "like you", be "given amounts
  requisite to the totals you would earn" when they play with the player, and "earn or lose" in the
  background otherwise, "a lightweight simulation of a casino". Per-profile balances keep two people
  on one tablet from changing each other's casino, and fit the existing per-profile coins. Background
  games use the same payouts as the player's games so the regulars keep pace with her; the betting
  games add the losses the owner asked for, and skill makes the good players richer over time.
  Bonuses (moons, Nils, gins) aren't tracked for the computer players, so they are left out. Moving
  chips in and out of balances, rather than settling hand by hand, means a session can never lose or
  create coins, and saving after each hand means a crash never does either.

## D-091 — Poker chips and chip sounds
- Date: 2026-11-27
- Status: Proposed (chosen by the assistant; the owner picks sounds by ear and can swap them)
- Decision: Six chip values (1, 5, 25, 100, 500, 1,000) in the usual casino colors, drawn by our own
  generator seen at an angle so they stack (spec 07 §Poker chips), and amounts drawn as the fewest
  chips in stacks of up to 12 (spec 19 §4.3). Four new sound cues use the chip sounds of the Kenney
  Casino Audio pack already in the app (CC0): `chips.bet` (chip-lay), `chips.raise` (chips-stack),
  `chips.collect` (chips-collide), `chips.win` (chips-handle) (spec 13 §2).
- Why: Owner request (R-010) for chip and chip-stack graphics, with sounds and animations for antes and
  bets. Generated SVGs are original MIT work like the cards, need no font at run time, and stay sharp
  at any scale. The usual colors (red 5, green 25, black 100) read as chips at a glance. Kenney's pack
  is the same source and license as the card sounds (the zip matches the hash in the asset register);
  16 more of its files were copied unmodified.

## D-092 — Poker screens and the regulars at the table
- Date: 2026-11-27
- Status: Proposed (chosen by the assistant; listed for the owner's review)
- Decision: A Poker setup screen (game, stakes, difficulty, 1 to 3 opponents or Random, with each
  regular's KardCoins and "Short on coins" for those who can't afford the stakes). The table reuses
  the Hearts seats, with chip stacks, bets, a pot, a dealer button, action tags, an action bar for
  betting and drawing, and a showdown that brings the regulars' hands to the middle. Leaving is in the
  pause menu (mid-hand: fold the rest, then leave) and between hands; a summary shows the result. A
  regular who runs out buys more (chance = risk) or leaves, and another regular may take the seat. The
  player can buy more chips. The stats page gets a Poker tab and a Casino regulars leaderboard (spec
  19 §3.3, §4; spec 15 §4).
- Why: The owner asked for poker with chip animations and for the regulars' coins to matter. Picking
  1 to 3 opponents allows a quiet heads-up game; showing coins on the setup screen explains why
  someone can't play. Folding out the current hand when leaving keeps the chips honest without asking
  the player to wait, and the regulars coming and going is the "casino with regulars" the owner
  described. Poker has no final score, so sessions end when the player leaves, and "Play again" goes
  back to the setup to choose stakes again.

## D-093 — Poker dialogue
- Date: 2026-11-27
- Status: Proposed (lines written with Claude, voiced with each character's voice; owner to review)
- Decision: Ten poker triggers (spec 08 §Poker triggers) and 222 new lines across the six
  characters, in their established voices and running jokes, voiced with the existing Piper voices.
- Why: Every other game has its own reactions; poker's big moments (bluffs, standing pat, bad beats,
  going broke, a new regular sitting down) are natural places for the regulars to talk. One line was
  rewritten before voicing because it leaned on a body-type joke (spec 08 tone rules).

## D-094 — Poker chips 1.5 times bigger
- Date: 2026-11-27
- Status: Accepted (owner request)
- Decision: Chips on the poker table are drawn 84 units wide instead of 56 (1.5×), with the stacking
  step and the gap between stacks scaled to match (8.4 and 9), at most 10 chips per stack (was 12), and
  slightly larger amounts. West's and East's stacks move 60 toward the center and North's 45 further
  left so the bigger stacks clear the cards and portraits (spec 19 §4.2–4.3). Amends D-091 and D-092.
- Why: After seeing screenshots of the table, the owner said the chips were "just too small" and
  asked for "at least 1.5X their current size". Ten per stack keeps a tall stack under 150 units.

## D-095 — Chip stacks build up when players sit down
- Date: 2026-11-27
- Status: Proposed (owner request; the timing was chosen by the assistant)
- Decision: When the player sits down at the poker table, each seat's stack is built chip by chip,
  each chip dropping in with a small bounce and a soft click, the player's first and then the
  regulars', overlapping (spec 19 §4.3). Regulars who sit down or buy more chips, and the player buying
  more, build their stacks the same way. A player's stack (not bets or pots) keeps some 5s and 25s,
  like a cashier's buy-in, instead of the fewest chips. New sound cue `chips.stack`.
- Why: The owner asked for "a stacking animation to make the stacks showing up at the beginning of the
  game more interesting". With the fewest chips a 200 buy-in was only two black chips, which makes for
  a dull build and a flat-looking stack; a cashier's mix gives three colorful columns. Overlapping the
  seats keeps the whole intro to about two seconds, and it follows Game speed.

## D-096 — Lower poker stakes
- Date: 2026-11-27
- Status: Accepted (owner request; Medium and High chosen by the assistant)
- Decision: Low stakes are ante 1, bets of 5 and 10, buy-in 100 (minimum 25). Medium is ante 2, bets
  of 10 and 20, buy-in 200 (minimum 50). High is ante 5, bets of 20 and 40, buy-in 400 (minimum 100).
  At every level the big bet is twice the small bet, the buy-in 20 small bets, and the minimum 5
  (spec 19 §3.1). Supersedes D-088's stakes. A "big pot" for dialogue is now 5 big bets instead of
  20 antes. Small amounts mean many 1s and 5s, so a player's stack keeps 4 chips each of 1, 5, and 25
  (instead of D-095's 5 of 5 and 4 of 25), a stack holds at most 8 chips, a pile is at most 3 stacks
  wide with any more in a row in front (big values in front), and the side stacks sit a little lower
  (spec 19 §4.2–4.3).
- Why: The owner: "many players want to just be really casual, so let's make the low stakes option be
  really low stakes, with 1 ante and bets of 5 or 10. Adjust the other stakes settings downward
  accordingly. That also helps fix the high-stakes game being a bit too high as well." Each level now
  doubles the bets of the one below, and a regular's 500 starting coins cover even the High buy-in
  with room to buy more. Simulations show the same kind of play at every level (about 72% of hands
  reach a showdown). With antes of 1 or 2, a threshold based on antes would call almost every pot big,
  so it follows the big bet. The engine tests keep the old values as fixed test stakes. Rows keep any
  pile within the space the table leaves beside each player; the first try (more columns) ran into
  the cards and portraits, and tall stacks reached the nameplates.

## D-097 — Chips visibly fly when players ante, bet, and win
- Date: 2026-11-27
- Status: Accepted (owner request, and a bug fix)
- Decision: Flying chips carry the amount as a pile that arcs slightly and lifts mid-flight, with a
  shadow, like a hand pushing chips across; chip flights take 420 ms (450 ms when the round's bets go
  to the pot) instead of 320 and 380 (spec 19 §4.3–4.4).
- Why: The owner asked for "an animation of their chips going from their stack into the middle,
  similar to how the cards currently animate". The table already moved chips (stack to bet spot, bets
  to the pot, pot to the winner), but a bug drew every flying pile empty, so the chips seemed to jump.
  A check in the running app counted 19 flights in 12 seconds with no chips in any of them; after the
  fix, all 19 carry chips. The arc, lift, and slightly longer time make each flight easy to follow.

## D-098 — A chip meter for the player's own chips
- Date: 2026-11-27
- Status: Proposed (owner request; the design was chosen by the assistant)
- Decision: The player's chips are shown in a large meter above her stack ("Your chips", 50 px gold
  number, and the KardCoins she has away from the table). It turns red and pulses with "Running low!"
  at 3 big bets or fewer, and every gain or loss floats up from it as "+N" or "−N". The small amount
  under her own stack is dropped, and her stack moves 58 lower to make room (spec 19 §4.2).
- Why: The owner: the total "is kind of small and unobtrusive right now and it is easy to overlook that
  you are going way down close to nothing". The warning catches the moment that matters (about one
  more hand's worth of betting left), the floating changes connect each bet and win to the total,
  and the balance away from the table tells her whether she could buy more chips.

## D-099 — The pause menu is centered, and nobody talks while the game is paused
- Date: 2026-11-27
- Status: Accepted (owner request)
- Decision: The pause menu (☰ or Esc) is centered vertically on the table. Pausing (the pause menu,
  or Rules opened during play) closes any speech bubble, stops its voice clip, and drops queued
  comments; no comment, including the idle reminder, is shown until play resumes (spec 12 §6).
- Why: The owner noticed the pause menu sat low. Dialogs are deliberately 150 below center so speech
  bubbles don't cover them, and the pause menu, the tallest dialog, inherited that and nearly touched
  the bottom edge. While paused no game events happen, but a bubble already showing, or the idle
  comment after 20 s on the player's turn, could still appear; silencing the table while paused
  removes that case, so the menu can be centered safely. Checked: centered exactly, and no bubble after
  25 s paused on the player's turn.

## D-100 — Say why play continues after a tie at the end of a game
- Date: 2026-11-28
- Status: Accepted (owner report)
- Decision: When a Hearts hand leaves someone at 100 or more but two or more players tied for the
  lowest score, the Hand results dialog adds a note naming who passed 100 and who is tied, e.g. "The
  Professor has 106, but Coach and Grumbles are tied for lowest (60), so play continues." Spades does
  the same when the teams are tied at the end ("The scores are tied at 310, so play continues."). The
  rules themselves don't change (spec 06 §2, spec 17 §5).
- Why: The owner saw the Professor at 106 with the game still going and reported it as a bug. The
  engine was right (Coach and Grumbles were tied at 60, and the tie rule is in the Rules screen), but
  nothing at the table explained it.
