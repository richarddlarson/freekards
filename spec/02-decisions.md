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
  `runtimes/electron.md` §CI.
- Why: Native runners give real ARM64 builds (especially Windows on ARM, for the Surface) without
  cross-compiling. Every push yields testable installers.

## D-041 — Releases are drafts created from version tags
- Date: 2026-11-24
- Status: Accepted
- Decision: Pushing a tag `vX.Y.Z` (matching `package.json` version) makes CI create a **draft** GitHub
  Release with all installers, `sbom/*.json`, and `LICENSE` attached. A person reviews and publishes it.
  Nothing is ever published automatically.
- Why: Keeps a human check before anything reaches users, while making the release itself one click.

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
