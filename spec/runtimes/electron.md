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
| @types/node | 26.6.6 | MIT | Types for the main and preload processes. |

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
tsconfig.renderer.json      Renderer + logic, adds the DOM lib
tsconfig.electron.json      Main + preload (*.cts) → dist-electron/*.cjs (CommonJS, NodeNext)
tsconfig.test.json          Tests + logic
src/logic/                  ENGINE-NEUTRAL game logic (spec 05, 10). No DOM/Node/Electron imports.
  core/cards.ts             Card ids, deck, sorting
  core/rng.ts               Mulberry32 generator + Fisher–Yates shuffle
  core/skill.ts             Difficulty model (spec 08)
  hearts/types.ts           State, actions, events
  hearts/engine.ts          Rules engine (spec 06 §1–4)
  hearts/ai.ts              Computer player (spec 06 §5)
  index.ts                  Public entry point
src/main/main.cts           Electron main process
src/main/preload.cts        Preload bridge (window.freekards)
src/renderer/               index.html, main.ts, style.css (presentation)
tests/logic/                Vitest suites + helpers (simulateGame, playState)
scripts/check-licenses.mjs  SBOM generator + license gate
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
| `npm run dist` / `dist:win` / `dist:linux` | Build, check licenses, then build installers with electron-builder. |

## Process model (D-019)
- **[Confirmed]** The main process (`src/main/main.cts`) creates the window, enforces the single-instance
  lock, and manages the lifecycle. It will also handle file system access (settings, saves,
  statistics) through IPC when those features arrive.
- **[Confirmed]** The renderer runs the whole game: logic layer plus presentation.
- **[Confirmed]** Security settings: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webviewTag: false`. The preload script exposes only `window.freekards`, currently
  `{ platform, versions }`. Main and preload compile to CommonJS `.cjs`, because sandboxed preloads
  must be CommonJS.
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
- **[Confirmed]** appId `io.github.richarddlarson.freekards` (D-026), productName `FreeKards`. Artifact names follow
  `FreeKards-<version>-<os>-<arch>.<ext>`, written to `release/`.
- **[Confirmed]** The app contains `dist-electron/**/*.cjs`, `dist/renderer/**`, and `package.json`,
  in an asar archive. `sbom/` and `LICENSE` (as `LICENSE.FreeKards.txt`) go into the app's
  resources folder, so the Credits screen can read them. electron-builder adds Electron's own
  `LICENSE.electron.txt` and `LICENSES.chromium.html` to the install folder.
- **[Confirmed]** Windows: NSIS `.exe` for x64 and for arm64. Assisted installer (`oneClick: false`),
  per user, no admin rights or elevation, fixed install folder, Start-menu and desktop shortcuts,
  and the MIT license shown during install.
- **[Confirmed]** Linux: `.deb` (primary, D-032) and AppImage (portable) for x64 and arm64, category `Game`.
  The target is Linux Mint and other Debian/Ubuntu derivatives.

## Licensing and SBOM (per core spec 09) (D-020)
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

## CI
- **[Confirmed]** Public GitHub repository with GitHub Actions builds (D-007, D-012).
- **[Proposed]** A build matrix running on native runners: `windows-latest` (x64), `windows-11-arm`
  (arm64), `ubuntu-latest` (x64), `ubuntu-24.04-arm` (arm64). Each job runs `npm ci`, `npm test`,
  `npm run licenses`, and `npm run dist` for its own arch. Tagging a version publishes the
  installers to a GitHub Release draft.
