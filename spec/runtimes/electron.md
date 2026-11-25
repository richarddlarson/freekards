# Runtime Spec — Electron

This is the first runtime FreeKards is built on (D-004). Everything specific to Electron or the web
stack belongs here. Everything else belongs in the core spec. See `../05-portability.md`.

Status key: **[Confirmed]** / **[Proposed]**, as in `01-requirements.md`.

## Stack (D-017)
All versions are pinned exactly in `package.json` (no `^` or `~` ranges). `package-lock.json` is committed.

| Tool | Version | License | Role |
|------|---------|---------|------|
| Electron | 45.4.1 | MIT | App runtime (bundles Chromium). Installed as a dev dependency, as electron-builder requires; it is the shipped runtime. |
| TypeScript | 7.0.2 | Apache-2.0 | Language; strict mode. |
| Vite | 8.3.8 | MIT | Renderer bundler and dev server. |
| Vitest | 5.1.1 | MIT | Unit tests for the logic layer. |
| electron-builder | 26.18.0 | MIT | Installers. |
| @cyclonedx/cyclonedx-npm | 7.0.1 | Apache-2.0 | SBOM generation. |
| @types/node | 26.6.6 | MIT | Types for the main and preload processes, and for tests (which run in Node). |
| opentype.js | 2.0.0 | MIT | Dev tool only: the card generator converts index lettering to outlines with it (D-060). No dependencies of its own. |

- **[Confirmed]** Electron bundles its own Chromium, so rendering and audio behave the same on every OS.
- **[Confirmed]** TypeScript throughout, strict mode plus `noUncheckedIndexedAccess`.
- **[Proposed]** Rendering: HTML/CSS with the Web Animations API for card motion, and no heavy UI
  framework at first. Revisit (for example PixiJS) if animation performance on the tablet is poor.
- **[Proposed]** Audio: Web Audio API, with separate gain nodes for music, sound effects, and voice.
- There are no production npm dependencies so far. All app code is bundled by Vite or compiled by tsc.

## Developer toolchain (D-011)
- **[Confirmed]** Node.js **26 LTS**, managed by nvm. The repo root `.nvmrc` contains `26`; run
  `nvm use` in the repo before any npm command. (Node 22 also exists on the dev machine and is left alone.)
- **[Confirmed]** GitHub CLI `gh`, installed as a single binary in `~/.local/bin` (no sudo), after
  checking its SHA-256 against the release checksums file.
- Dev machine: Linux Mint 22.3, x86_64.
- **[Confirmed]** (D-021) npm 11 install-script gating is on. `package.json` has
  `"allowScripts": { "electron-winstaller": false }`. That package (Squirrel.Windows support, pulled
  in by electron-builder) is unused, since we build NSIS installers. Electron itself has no install
  script: its binary downloads on first launch (`node_modules/electron/index.js`).

## Source tree (D-018)
```
.nvmrc                      Node major version (26)
package.json                Scripts, pinned dev dependencies, allowScripts
electron-builder.yml        Installer configuration
vite.config.ts              Renderer build (root src/renderer → dist/renderer)
vitest.config.ts            Tests: tests/**/*.test.ts, Node environment
tsconfig.base.json          Shared strict compiler options
tsconfig.logic.json         Logic layer only, lib ES2023, no DOM, no Node types (enforces engine neutrality)
tsconfig.renderer.json      Renderer + logic, adds the DOM lib and vite/client types (import.meta.glob)
tsconfig.electron.json      Main + preload (*.cts) → dist-electron/*.cjs (CommonJS, NodeNext)
tsconfig.test.json          Tests + logic + spec/content JSON (resolveJsonModule), Node types (tests may read files;
                            tsconfig.logic.json still keeps Node out of the logic layer)
src/logic/                  ENGINE-NEUTRAL game logic (spec 05, 10). No DOM/Node/Electron imports.
  core/cards.ts             Card ids, deck, sorting
  core/rng.ts               Mulberry32 generator + Fisher–Yates shuffle
  core/skill.ts             Difficulty model (spec 08)
  hearts/types.ts           State, actions, events
  hearts/engine.ts          Rules engine (spec 06 §1–4)
  hearts/ai.ts              Computer player (spec 06 §5)
  dialogue/                 Character types, dialogue director, Hearts event→trigger mapping (spec 08, D-036)
  layout/hearts-table.ts    Viewport fitting, table positions, timing, Card response / Game speed tables (spec 11, 12, 16)
  settings/                 Per-player settings: types, defaults, repair (spec 16)
  index.ts                  Public entry point
src/main/main.cts           Electron main process
src/main/preload.cts        Preload bridge (window.freekards)
src/renderer/               Presentation (DOM + CSS):
  main.ts                   Screen flow and demo hashes (#setup, #settings, #hearts&seed=N&autoplay&speed=N)
  stage.ts                  Stage scaled to the window (spec 11 §2), DOM helpers, tap handling, choice rows
  content.ts                Loads spec/content characters and assets/themes images via import.meta.glob
  settings.ts               Device-wide preferences in localStorage (sound levels, music choice)
  profiles.ts               Profile store over the preload bridge (localStorage fallback) (spec 15, D-051)
  profile-screens.ts        Welcome / Add player, Who's playing?, My stats, coin and player badges
  audio.ts                  Web Audio engine: channels, cues, playlist (spec 13)
  sound-settings.ts         Sound panel (sliders, Mute all)
  settings-panel.ts         Per-player Settings panel (spec 16)
  screens.ts                Main menu and Hearts setup
  table/card-sprite.ts      One element per card, moved with the Web Animations API
  table/hearts-table.ts     Hearts table controller and view (spec 12); pointer gestures: tap, press, drag (spec 16 §3)
  style.css                 Classic Casino styles, in logical px
tests/logic/                Vitest suites + helpers (simulateGame, playState)
scripts/check-licenses.mjs  SBOM generator + license gate (also scans assets/ and spec/content/)
scripts/build-voices.py     Voice clips: Piper synthesis → Opus, incremental (D-048)
scripts/build-music.mjs     Music: fetch originals, verify SHA-256, encode to Opus (D-045)
scripts/generate-cards.mjs  Classic Casino deck generator → assets/themes/classic-casino/decks/<deck> (D-027, D-062);
                            outlines each deck's index font from assets/fonts with opentype.js (D-060).
                            --font <ttf> --out <dir> writes a trial deck for font auditions
scripts/capture.cjs         Offscreen screenshot tool (D-037)
assets/themes/              Runtime-neutral theme assets (generated card SVGs committed)
assets/fonts/               Bundled OFL fonts, each with its OFL.txt: Fira Sans (interface, loaded by
                            style.css @font-face); Fira Sans Condensed and Nunito ExtraBold (card-generator
                            inputs only, D-060, D-062)
scripts/license-policy.mjs  Allowed licenses + runtime exceptions (mirrors spec 09 §2)
sbom/                       assets.json, build-tools.json (hand-kept); code.cdx.json, dev.cdx.json (generated)
build/                      electron-builder resources (icons go here)
```
Generated and ignored by git: `node_modules/`, `dist/` (renderer), `dist-electron/` (main and
preload), `release/` (installers), `coverage/`.

## npm scripts
| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server for the renderer on port 5173. Run Electron against it with `VITE_DEV_SERVER_URL=http://localhost:5173 electron .`. |
| `npm run typecheck` | Typechecks all five tsconfig projects. |
| `npm run build` | Typecheck, then Vite build to `dist/renderer`, then tsc for main and preload to `dist-electron`. |
| `npm start` | Build, then launch Electron. |
| `npm test` | Vitest, run once. |
| `npm run licenses` | Regenerate the SBOMs and run the license gate. |
| `npm run voices` | Generate or refresh character voice clips (Python 3 + ffmpeg; sets up Piper in `.cache/`). `--force` regenerates all. |
| `npm run music` | Rebuild `assets/audio/music/*.opus` from the verified originals (needs ffmpeg with libopus). |
| `npm run cards` | Regenerate the Classic Casino card SVGs (deterministic; commit the result). |
| `npm run capture -- <page> <out.png> [w] [h] [ms,ms…]` | Offscreen screenshots (D-037). Build first. Env `CAPTURE_INIT_JS` runs JS in the page and reloads (e.g. to seed demo profiles into localStorage). |
| `npm run dist` / `dist:win` / `dist:linux` | Build, check licenses, then build installers with electron-builder. |

## Renderer implementation notes (D-035)
- The stage element is sized to the logical viewport and scaled with a CSS `transform: scale()`
  (origin top-left). All CSS px inside it are logical units.
- Vite bundles `spec/content` and `assets/` through `import.meta.glob` (eager). Small SVGs are
  inlined as data URIs and larger ones are emitted as files. The CSP allows `img-src 'self' data:`.
  `server.fs.allow` includes the repo root, so the dev server can reach both folders.
- Audio: one `AudioContext` with master → music/sfx/voice `GainNode`s. Files are bundled through
  `import.meta.glob('assets/audio/**')` and decoded with `decodeAudioData`. Music crossfades are
  scheduled against `AudioContext.currentTime`, polled every 250 ms, so a suspended (hidden) app keeps
  its place. Electron's default autoplay policy lets music start without a user gesture. In a
  browser, the context resumes on the first pointer press.
- Card motion: each card is one absolutely positioned element. A move sets the final `transform`
  and plays a Web Animations keyframe from the old to the new transform, with `fill: backwards` so
  staggered delays hold the start position.
- Card gestures (spec 16 §3) use Pointer Events on the card layer: `pointerdown` starts a gesture
  and calls `setPointerCapture` (inside try/catch), so `pointermove`/`pointerup` keep arriving when the
  finger leaves the card. Window coordinates become logical units through
  `(client − stage rect origin) / viewport scale`. A dragged card cancels its running animations and
  sets its `transform` directly on every move. `touch-action: none` on the page removes the browser's
  touch delay and gestures.
- Preferences use `localStorage` (Electron keeps it in the `cardtable` userData folder, D-034). All
  access is wrapped in try/catch.

## Process model (D-019)
- **[Confirmed]** The main process (`src/main/main.cts`) creates the window, enforces the single-instance
  lock, and manages the lifecycle. It will also handle file system access (settings, saves,
  statistics) through IPC when those features arrive.
- **[Confirmed]** The renderer runs the whole game: logic layer plus presentation.
- **[Confirmed]** Security settings: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webviewTag: false`. The preload script exposes only `window.freekards`, currently
  `{ platform, versions }`. Main and preload compile to CommonJS `.cjs`, because sandboxed preloads
  must be CommonJS.
- **[Confirmed]** Document store (D-051): `ipcMain.handle('store:read' | 'store:write')` in the main
  process, exposed as `window.freekards.store.read(name)` / `.write(name, text)`. Files live at
  `<userData>/data/<name>.json` (names must match `[a-z0-9-]{1,40}`, max 5 MB, must be valid JSON),
  written to `.tmp`, the old file copied to `.bak`, then renamed. Reads fall back to `.bak` if the
  main file is missing or not valid JSON.
- **[Confirmed]** No remote content. A Content-Security-Policy in `index.html` allows only `'self'`
  (plus `ws://localhost:*` for the Vite dev server). In-app navigation is blocked. `window.open` is
  denied, and http(s) links open in the system browser through `shell.openExternal`.

## Native feel
- **[Confirmed]** Standard OS window frame, 1280×800 by default (minimum 960×600), shown maximized
  once ready, with felt-green background `#0b5d2a` to avoid a white flash. No application menu
  (`Menu.setApplicationMenu(null)`).
- **[Confirmed]** The renderer turns off text selection, the context menu, ctrl+wheel zoom, and browser
  touch gestures (`touch-action: none`).
- **[Proposed]** App icon. Window position and size remembered between runs.

## Packaging and installers (`electron-builder.yml`)
- **[Confirmed]** Internal identity (D-034, **never change**): appId `io.github.richarddlarson.cardtable`,
  `nsis.guid` `603b3361-eb1a-4e18-9d18-ef44b2392b21`, npm package name `cardtable` (the `.deb` name is
  `freekards`, D-043). The main
  process sets `userData` to `<appData>/cardtable` and calls `app.setAppUserModelId(appId)` on Windows
  before the app is ready. Display: productName `FreeKards`, Linux `executableName: freekards`. Artifact names follow
  `FreeKards-<version>-<os>-<arch>.<ext>`, written to `release/`.
- **[Confirmed]** The app contains `dist-electron/**/*.cjs`, `dist/renderer/**`, and `package.json`,
  in an asar archive. `sbom/` and `LICENSE` (as `LICENSE.FreeKards.txt`) go into the app's
  resources folder, so the Credits screen can read them. electron-builder adds Electron's own
  `LICENSE.electron.txt` and `LICENSES.chromium.html` to the install folder.
- **[Confirmed]** Windows: NSIS `.exe` for x64 and for arm64. Assisted installer (`oneClick: false`),
  per user, no admin rights or elevation, fixed install folder, Start-menu and desktop shortcuts,
  and the MIT license shown during install.
- **[Confirmed]** Linux: `.deb` (primary, D-032) and AppImage (portable) for x64 and arm64, category `Game`.
  The `.deb` package is named `freekards`, with `Replaces`/`Conflicts: cardtable` set through fpm (D-043).
  The target is Linux Mint and other Debian/Ubuntu derivatives.

## Licensing and SBOM (per core spec 09) (D-020)
- **SBOMs are generated from `package-lock.json` only** (`cyclonedx-npm --package-lock-only`, D-046).
  Earlier they were generated from `node_modules`, whose hidden lockfile goes stale whenever Vite or
  Vitest write caches or the package is renamed. That silently dropped package hashes and made CI's
  SBOM drift check fail. Reading the lockfile makes the SBOM identical on every machine and in every
  `node_modules` state. It also lists optional, platform-specific packages (such as other OSes' build
  binaries) that aren't installed locally.
- **[Confirmed]** `npm run licenses` runs `scripts/check-licenses.mjs`, which:
  1. runs `cyclonedx-npm --spec-version 1.6 --output-reproducible --flatten-components` twice:
     `--omit dev` writes `sbom/code.cdx.json` (shipped), and the full tree writes `sbom/dev.cdx.json`;
  2. adds the Electron runtime to `code.cdx.json` as a `framework` component with the properties
     `freekards:scope=runtime` and `freekards:license-exception=D-016`;
  3. fails on any shipped component whose SPDX expression doesn't satisfy the allowed list (OR = either
     side, AND = both sides, WITH exceptions ignored), except runtime-exception components;
  4. fails on any development component with no license, and lists the other non-allowed
     development licenses as **build-only**. They are acceptable under spec 09 §2 because none of
     them ship and none put conditions on our output. As of D-020 these are lightningcss (MPL-2.0,
     Vite's CSS minifier), the BlueOak-1.0.0 utilities (minimatch, tar, lru-cache, and others),
     argparse (Python-2.0), and truncate-utf8-bytes (WTFPL);
  5. checks `sbom/assets.json` (required fields, origin values, allowed license, attribution for
     CC-BY), checks that every file under `assets/` matches a register `path` glob (`*`, `**`, `?`),
     and checks the required fields in `sbom/build-tools.json`.
- **[Confirmed]** Both generated SBOMs are committed. The output is reproducible, so they change only
  when dependencies change.
- **[Confirmed]** `scripts/license-policy.mjs` holds the allowed list and the runtime exceptions. It
  must match spec 09 §2 exactly.
- **[Confirmed]** (D-016) Runtime platform exception: Electron (MIT) and the Chromium build it bundles, with
  that build's third-party components, some under other licenses such as LGPL for FFmpeg. Electron's
  own `LICENSE` and `LICENSES.chromium.html` ship unmodified in the installed app and are linked from
  the Credits screen.

## CI (D-040, D-041, D-042)
- **[Confirmed]** Public GitHub repository with GitHub Actions builds (D-007, D-012). The workflow is
  `.github/workflows/build.yml` (name `build`).
- **Triggers:** push to `main` (that is, a merged PR), push of a `v*` tag, pull requests, and manual
  runs (`workflow_dispatch`). Session branches are built through their PR (D-059), not on every
  branch push, so each change isn't built twice. A concurrency group per workflow and ref cancels superseded runs.
- **Permissions:** `contents: read` for the whole workflow. Only the `release` job gets `contents: write`.
- **Job `check`** (`ubuntu-latest`), in this order:
  1. checkout, then setup-node with `node-version-file: .nvmrc` and the npm cache;
  2. `npm ci`;
  3. `npm run licenses`, then `git diff --exit-code -- sbom/code.cdx.json sbom/dev.cdx.json`.
     A committed SBOM that is out of date fails the build. This runs **before** the tests and the
     build on purpose: Vite and Vitest write caches into `node_modules` (`.vite`, `.vite-temp`,
     `.vitest-cache`), which makes npm's hidden lockfile stale, so a later `npm ls` drops the package
     hashes and dev flags from the dev SBOM. The same applies locally: regenerate SBOMs right after
     `npm ci`;
  4. `npm test`;
  5. `npm run build`.
- **Job `build`** (needs `check`), a matrix on **native runners**, with `fail-fast: false`:

  | Runner | OS / arch | electron-builder targets | Artifact name |
  |--------|-----------|--------------------------|---------------|
  | `windows-latest` | Windows x64 | `--win nsis --x64` | `freekards-win-x64` |
  | `windows-11-arm` | Windows arm64 | `--win nsis --arm64` | `freekards-win-arm64` |
  | `ubuntu-latest` | Linux x64 | `--linux deb AppImage --x64` | `freekards-linux-x64-deb`, `freekards-linux-x64-appimage` |
  | `ubuntu-24.04-arm` | Linux arm64 | `--linux deb AppImage --arm64` | `freekards-linux-arm64-deb`, `freekards-linux-arm64-appimage` |

  Each matrix entry: checkout, setup-node, a cache of Electron and electron-builder downloads
  (keyed on OS, arch, and the `package-lock.json` hash), `npm ci`, `npm run build`, then
  `npx electron-builder <targets> --<arch> --publish never`. It uploads **one artifact per installer
  type** (D-057): `release/*.exe` on Windows, and on Linux `release/*.deb` and `release/*.AppImage`
  separately. Each is kept for **14 days**, and the job fails if an expected installer is missing.
  Both Linux packages still come from one build per arch, so the split costs no runner time.
- **Job `release`** (only for `v*` tags; needs `build`; `contents: write`): downloads all artifacts and
  runs `gh release create <tag> --draft --generate-notes`, attaching every installer plus
  `sbom/*.json` and `LICENSE`. Nothing is published automatically.
- **Actions** are GitHub's own (`actions/checkout`, `setup-node`, `cache`, `upload-artifact`,
  `download-artifact`, all MIT), each pinned to a full commit SHA with a version comment, and listed in
  `sbom/build-tools.json` (spec 09 §3c). The release step uses the `gh` CLI preinstalled on the
  runner, so no third-party action is needed. To update an action: look up the new release's commit
  SHA, update both the workflow and `build-tools.json`, and check its license is still permissive.

### How to cut a release
1. Bump `version` in `package.json` (and run `npm install --package-lock-only` so the lockfile matches),
   then commit to `main`.
2. Tag the commit: `git tag vX.Y.Z` (it must match the package.json version), then `git push origin vX.Y.Z`.
3. Wait for the `build` workflow to finish. It creates a **draft** GitHub Release with all installers and SBOMs.
4. Review the draft (notes, files), then click **Publish release**.

### Unsigned installers (Q3 open)
The installers are not code-signed yet:
- **Windows:** SmartScreen shows "Windows protected your PC" the first time the installer runs. The
  user has to click **More info → Run anyway**. Microsoft Edge may also warn when downloading the
  `.exe`. The warning fades once a release builds download reputation, and disappears with signing.
- **Linux:** no signing is involved. The AppImage needs to be marked executable before it runs.
