# FreeKards

Free, open-source classic card games with friendly computer opponents, for Windows and Linux on
both x64 and ARM64.

Games: **Hearts**, **Spades**, **Rummy 500**, and **Gin Rummy** are playable. Coming later:
Blackjack, Poker, and Solitaire.

> **Status:** early pre-release. Hearts, Spades, Rummy 500, and Gin Rummy are fully playable, with
> sound, music, talking opponents, a rules screen for each game, player profiles, and statistics.
> The other games are coming.

## Download and install
Get the installer for your computer from the
[Releases page](https://github.com/richarddlarson/freekards/releases). Each release lists which
file to download.

- **Windows** (x64 or ARM64): run the `.exe`. The installer is not code-signed yet, so Windows
  may show "Windows protected your PC" the first time. Click **More info**, then **Run anyway**.
- **Linux Mint, Ubuntu, Debian:** open the `.deb` to install it. On other distributions, use the
  `.AppImage` (mark it executable, then run it).

## Highlights (planned)
- Animated card dealing and play, designed for touch screens such as the Surface Pro.
- Computer opponents with personalities who comment on the game in speech bubbles and spoken voice.
- Sound effects, background music, and interchangeable visual themes.
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
