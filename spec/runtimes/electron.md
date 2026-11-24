# Runtime Spec — Electron

This is the first runtime FreeKards is built on (D-004). Everything specific to Electron or the web
stack belongs here. Everything else belongs in the core spec. See `../05-portability.md`.

Status key: **[Confirmed]** / **[Proposed]**, as in `01-requirements.md`.

## Stack
- **[Confirmed]** Electron, which bundles its own Chromium so rendering and audio behave the same on
  every OS.
- **[Proposed]** TypeScript throughout, in strict mode.
- **[Proposed]** Vite to build the renderer.
- **[Proposed]** Rendering: HTML/CSS with the Web Animations API for card motion, and no heavy UI
  framework at first. Revisit (for example PixiJS) if animation performance on the tablet is poor.
- **[Proposed]** Audio: Web Audio API, with separate gain nodes for music, sound effects, and voice.
- **[Proposed]** Tests: Vitest for the logic layer, which runs in Node with no Electron dependency.

## Process model
- **[Proposed]** The main process only creates the window, handles file system access (settings,
  saves, statistics), and manages the app lifecycle.
- **[Proposed]** The renderer runs the whole game: logic layer plus presentation.
- **[Proposed]** Security defaults: `contextIsolation: true`, `nodeIntegration: false`, a small
  preload bridge for saving and loading data, and no remote content loaded ever.

## Native feel
- **[Proposed]** Standard OS window frame, opening full-screen or maximized, with no browser-style
  context menu, text selection, or zoom gestures inside the game.
- **[Proposed]** App icon, single-instance lock, and window position and size remembered between runs.

## Packaging and installers
- **[Proposed]** electron-builder.
- **[Proposed]** Windows: an NSIS `.exe` installer per architecture (x64, arm64). It installs per
  user with no admin rights needed, and adds Start-menu and desktop shortcuts.
- **[Proposed]** Linux: an AppImage (runs on any distribution) plus a `.deb`, for both x64 and arm64.

## CI
- **[Confirmed]** Private GitHub repository with GitHub Actions builds (D-007).
- **[Proposed]** A build matrix running on native runners: `windows-latest` (x64), `windows-11-arm`
  (arm64), `ubuntu-latest` (x64), `ubuntu-24.04-arm` (arm64). Tagging a version publishes the
  installers to a GitHub Release draft.
