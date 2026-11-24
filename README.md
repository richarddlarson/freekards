# FreeKards

Free, open-source classic card games with friendly computer opponents, for Windows and Linux on
both x64 and ARM64.

Planned games: Hearts (in progress), Spades, Blackjack, Poker, Rummy 500, Gin Rummy, and Solitaire.

> **Status:** early development. The Hearts rules engine and AI work and are tested. The game table
> and installers are next.

## Highlights (planned)
- Animated card dealing and play, designed for touch screens such as the Surface Pro.
- Computer opponents with personalities who comment on the game in speech bubbles and spoken voice.
- Sound effects, background music, and interchangeable visual themes.
- Easy-to-install apps: `.exe` for Windows, AppImage and `.deb` for Linux.
- 100% offline. No accounts, no ads, no tracking.

## Spec-driven
The [`spec/`](spec/) folder is the source of truth. It is complete enough to rebuild the app from it
alone, and the core spec is engine-neutral, so the game can be ported to other runtimes.
Start at [`spec/README.md`](spec/README.md).

## Developing (Electron runtime)
Requires Node.js 26 (see `.nvmrc`).

```sh
nvm use
npm ci
npm test          # logic-layer tests
npm start         # build and launch the app
npm run licenses  # regenerate SBOMs and run the license check
npm run dist      # build installers for the current platform
```

## License and third-party content
FreeKards is MIT-licensed ([LICENSE](LICENSE)). Everything bundled with it uses permissive or
public-domain licenses, and is listed in a software bill of materials in [`sbom/`](sbom/).
The policy is in [`spec/09-licensing-and-sbom.md`](spec/09-licensing-and-sbom.md).

FreeKards is an independent project, not affiliated with any commercial card-game product.
