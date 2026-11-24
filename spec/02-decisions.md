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
