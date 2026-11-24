# 09 — Licensing, Third-Party Policy, and SBOM (core spec, engine-neutral)

Status: **[Confirmed]** (D-012 to D-015), except items marked **[Proposed]**.

## 1. Project license
- FreeKards is free and open source under the **MIT License**. The repo root `LICENSE` reads
  "Copyright (c) 2026 The FreeKards Contributors".
- The repository is **public** from the first commit (D-012).
- **Original content** made for the project is also covered by MIT: code, art, dialogue text, and
  generated voice clips (when the voice model's license allows; see §4). Its author in the SBOM is
  "The FreeKards Contributors".

## 2. Third-party license policy: permissive only (D-014)
Anything **shipped in the app or its installers** must use one of these licenses.

| Allowed | Notes |
|---------|-------|
| MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Zlib, Apache-2.0, BSL-1.0, Unlicense | Code |
| CC0-1.0, public domain | Any kind of asset or code |
| CC-BY-3.0, CC-BY-4.0 | Assets. Attribution is shown in the in-app Credits screen and the SBOM. |
| OFL-1.1 (SIL Open Font License) | Fonts only |

**Not allowed** in anything shipped: GPL (any version), LGPL, AGPL, MPL, EPL, CC-BY-SA, any
non-commercial license (CC-NC), any no-derivatives license (CC-ND), "free for personal use",
custom licenses whose terms are unclear, and anything whose license or origin cannot be found.

**Build-time-only tools** (tools whose output ships but which are not shipped themselves, such as a
text-to-speech generator or an image converter) may use any open-source license, including GPL,
provided that license puts no conditions on the output. They are still listed in the SBOM, marked
`"scope": "build"`.

**Runtime platform exception [Confirmed] (D-016):** the app runtime itself (currently Electron, which includes
Chromium and its bundled third-party parts, such as an LGPL-licensed FFmpeg build) is accepted as a
platform. It is shipped unmodified, together with its own license files, and is listed in the SBOM.
Each runtime spec names its platform exception explicitly.

**AI-generated content:** text or assets produced with AI tools for this project (for example dialogue
written by the coding assistant) count as original project content and are marked `"origin": "ai-assisted"`
in the asset register. No AI-generated content may imitate a specific copyrighted work, or the
Hoyle product's characters, art, or trademarks.

**Trademarks:** "Hoyle" and other product names never appear in the app, its marketing, or its
assets, apart from the factual provenance note in the spec.

## 3. Software bill of materials (SBOM) (D-015)
The SBOM has two parts. Both live in the repository and both ship inside the app.

### 3a. Code dependencies
- A machine-generated **CycloneDX 1.6 JSON** file listing every shipped code dependency, including
  indirect ones, with name, version, license (SPDX id), supplier or author, and source URL.
- It is regenerated on every build; CI fails if any license is not on the allowed list.
- The tool used depends on the runtime and is named in the runtime spec.

### 3b. Asset register
- A hand-maintained file `sbom/assets.json`, describing every non-code file: art, card faces, fonts,
  sounds, music, voice clips, and icons.
- CI fails if any file under `assets/` is missing from the register, or if an entry has no license.
- Schema (each entry):
```json
{
  "path": "assets/themes/classic-casino/cards/faces/AS.svg",
  "title": "Ace of Spades",
  "kind": "image | font | sfx | music | voice | icon | other",
  "origin": "third-party | original | ai-assisted | generated",
  "author": "Name or organization",
  "source": "https://where-it-came-from",
  "license": "SPDX id, e.g. CC0-1.0",
  "licenseUrl": "https://…",
  "attribution": "Exact attribution text when the license requires one",
  "modified": "Description of our changes, or null",
  "tool": "For generated assets: the tool and model used, e.g. TTS voice id"
}
```
- Several files can be covered by one entry using a glob pattern (for example a whole card deck)
  when they share the same source and license.

### 3c. Build tools
- Build-time tools (§2) are listed in `sbom/build-tools.json`, with the same fields as the asset
  register plus `"scope": "build"`.

## 4. Text-to-speech voices (relates to D-005)
- The text-to-speech tool may be build-time only (§2), but each **voice model** shapes the output that
  ships, so the voice model **and the dataset it was trained on** must both allow redistribution of
  generated audio, under a permissive or public-domain license. Both appear in the SBOM.

## 5. In-app presentation
- An **About & Credits** screen, reachable from the main menu, shows:
  - the FreeKards version and the MIT license text;
  - every code dependency and asset, with author, license, and source link, grouped by kind;
  - the full license text of every license used, shipped offline inside the app;
  - the runtime platform's own license notices.
- Links open in the system's default browser. The app itself never loads remote content.
- Release builds also attach the SBOM files to each GitHub Release.

## 6. Process rules
- **Adding a dependency or asset** means updating the SBOM or asset register **in the same commit**.
- Before adding anything third-party, check its license against §2 and record its source URL.
  If the license is unclear, it is not used.
