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
- Status: Accepted (made by the assistant while the owner was away, at his request; **owner to review**)
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

