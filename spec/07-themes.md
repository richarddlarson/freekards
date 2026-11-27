# 07 — Themes (core spec, engine-neutral)

Status: architecture **[Confirmed]** (D-009). Manifest **[Proposed]**, not implemented yet: the renderer
currently uses the Classic Casino paths directly. Card decks are implemented (D-027, D-035, D-062), and
so are table felts (D-086).

## Concept
A **theme** is a self-contained bundle of visual (and optionally audio) assets plus a JSON manifest.
The game draws everything visual through the active theme and never hard-codes an asset. The player
chooses a theme in Settings, and the change takes effect immediately.

## What a theme provides
- **Card decks:** one or more. Each deck is 52 faces (plus optional jokers for future games) and a
  back. The player picks a deck in Settings (spec 16 §5).
- Table surface (felt or background) and the border or trim around it. A theme may offer several
  felt colors for the player to choose from (D-086).
- Interface look: buttons, panels, dialogs, score sheet, and speech-bubble style.
- Fonts and a color palette. Fonts are bundled with the app, never taken from the system, so every
  platform looks the same. Classic Casino uses **Fira Sans** (Medium and Bold, OFL-1.1) for all
  interface text (D-060).
- Character portraits: one per roster character, with a few expressions (neutral, happy, annoyed, smug).
  If a theme has no portrait for a character, the default theme's portrait is used.
- Optional: theme-specific music and sound effects. Without them the default audio set is used.

## Manifest (draft schema)
```json
{
  "id": "classic-casino",
  "name": "Classic Casino",
  "version": 1,
  "decks": [
    { "id": "classic", "name": "Classic", "faces": "decks/classic/faces/{rank}{suit}.svg", "back": "decks/classic/back.svg" },
    { "id": "rounded", "name": "Rounded", "faces": "decks/rounded/faces/{rank}{suit}.svg", "back": "decks/rounded/back.svg" }
  ],
  "cardAspect": 0.714,
  "table": { "felts": [{ "id": "green", "name": "Green", "center": "#0d6a31", "middle": "#0a5527", "edge": "#063d1b" }], "texture": "generated", "trim": "table/trim.png" },
  "palette": { "primary": "#…", "accent": "#…", "text": "#…", "bubble": "#…" },
  "fonts": { "ui": "fonts/…", "score": "fonts/…" },
  "portraits": "portraits/{characterId}/{expression}.png",
  "audio": { "music": null, "sfx": null }
}
```
`{rank}` is one of `A 2–9 T J Q K`. `{suit}` is one of `S H D C`.

## Planned themes
1. **Classic Casino** (first): green felt, traditional card faces, wood and brass trim, realistic portraits.
2. **Bright Illustrated** (after basic gameplay works): cheerful, flat, cartoon style.
   Kenney's "Playing Cards Pack" (CC0, https://kenney.nl/assets/playing-cards-pack) is a possible
   source for it. Its file formats have not been checked yet.

## Classic Casino table felt (D-086)
Every screen, table or menu, is drawn on the felt. The player picks its color in Settings (spec 16 §6).
- **Color:** a radial gradient, an ellipse centered at 50% across and 45% down, from the felt's
  **center** color, through its **middle** color at 55%, to its **edge** color at 100%.
- **Texture (D-087):** over the color lie two layers of gray fractal noise, each a seamless 256 × 256
  tile (logical units), blended with **overlay**, so they shade the felt a little lighter and darker
  without changing its hue. Each noise is desaturated, then its contrast is stretched (value × slope
  + 0.5 − 0.5 × slope), then shown at an opacity:
  - **Grain:** base frequency 0.5 (features a few units across), 4 octaves, seed 7, slope 2.5,
    opacity 40%.
  - **Fibers:** base frequency 0.3 across and 1.2 down (short sideways streaks, like the nap of
    felt), 4 octaves, seed 7, slope 2, opacity 30%.
  - The grain must be several logical units across, not one pixel: a one-pixel grain disappears when
    the table is scaled up on a high-resolution screen. Each tile image is drawn at 4× (1024 pixels,
    frequencies ÷ 4) so it stays sharp at any scale.
  - It is generated (code, no image file), so it is original MIT work.
- **Trim:** around the edge, a 14-unit wood band (`#6b4423`), a 3-unit brass line (`#d9a82b`) inside
  it, and an inner shadow (120 units, black at 55%) that darkens the felt toward the trim.
- **Tints:** panels (such as the score sheet), dialogs, and drop-down lists drawn over the
  felt use a dark tint of the felt's own color, so they never look green on a blue table.

| Felt (id) | Center | Middle | Edge | Panel | Dialog | List |
|-----------|--------|--------|------|-------|--------|------|
| Green (`green`, default) | `#0d6a31` | `#0a5527` | `#063d1b` | rgba(10, 30, 18, 0.82) | rgba(8, 28, 16, 0.96) | `#0b2414` |
| Blue (`blue`) | `#18507c` | `#123f63` | `#08233a` | rgba(8, 20, 34, 0.82) | rgba(6, 18, 30, 0.96) | `#0a1a2a` |
| Burgundy (`burgundy`) | `#6e1f2b` | `#571823` | `#320c13` | rgba(32, 8, 13, 0.82) | rgba(28, 7, 11, 0.96) | `#250a10` |
| Gold (`gold`) | `#86602a` | `#6d4c20` | `#3e2a10` | rgba(30, 22, 8, 0.82) | rgba(26, 19, 7, 0.96) | `#221a09` |
| Amber (`amber`) | `#80481f` | `#683a18` | `#3c200c` | rgba(32, 16, 6, 0.82) | rgba(28, 14, 5, 0.96) | `#24130a` |

Felt ids are stable, because profiles store them. The window's own background, shown for a moment
before the first screen draws, stays green.

## App icon (D-067)
The app icon is the same for every theme. It is drawn on a 1024×1024 canvas, origin top-left:
- **Tile:** a rounded square at (64, 64), 896×896, corner radius 190, filled with a vertical gold
  gradient (#f0c54d → #8a6414). Inside it, the felt: (88, 88), 848×848, radius 168, a radial gradient
  centered at 50% / 42% (#14833f → #0d6a31 at 60% → #063d1b). The 64-unit transparent margin keeps
  desktop shells from cropping it.
- **Cards** (paper #fdfdf8, corner radius 8% of the card width, each with a soft drop shadow: 14 units
  down, blur 16, black at 45%):
  - back left: 330×462, centered (372, 540), rotated −18°, inner panel #1f4e9c (the Rounded back);
  - back right: 330×462, centered (652, 540), rotated +18°, inner panel #a3192e (the Classic back);
    each back's inner panel is inset 7% of the card width, corner radius 5% of the width;
  - front: 360×504, centered (512, 512), upright, plain paper with the card generator's heart shape,
    250 units across, red #c8102e, centered 6 units below the card's center.
- The source is `scripts/generate-icon.mjs` (which also keeps the three rejected drafts for
  comparison). Each runtime spec says how the image becomes platform icon files.

## Card decks (D-062)
- A deck is a complete look for the cards: index font, colors, and artwork. Today the Classic
  Casino decks share their layout, pips, and court pictures, and differ in index font and back
  color. Later decks may also change suit colors or artwork.
- Files: `assets/themes/<theme>/decks/<deck>/faces/{rank}{suit}.svg` and `…/decks/<deck>/back.svg`.
  Deck ids are stable, because profiles store them. A profile with an unknown deck id falls back to
  the default deck.
- Classic Casino decks, all written by the card generator from one deck table:

| Deck (id) | Index font | Back | Notes |
|-----------|------------|------|-------|
| Classic (`classic`) | Fira Sans Condensed Bold | red `#a3192e` | The default (D-060) |
| Rounded (`rounded`) | Nunito ExtraBold | blue `#1f4e9c` | Softer, rounded letters, for players who find Classic too sharp |

- Each deck's font is converted to vector outlines by the generator, so fonts are build inputs
  only. Ranks wider than the index column (63.6 units) are narrowed to fit, so any font works in
  the same layout.

## Classic Casino card faces (D-027)
- **Phase 1 (now):** the decks are **generated by a script in our repo**, which writes one SVG per card
  in the face naming scheme above. Everything it produces is original work under MIT. The details
  below describe the Classic deck; Rounded differs only in index font and back color.
  - Corner indices (rank plus suit symbol) appear in the top-left corner and again, rotated 180°,
    in the bottom-right.
  - **Jumbo indices (D-060):** the rank's capital height is 60 of the card's 350 units (about 17%),
    in Fira Sans Condensed Bold (OFL-1.1), with a 40-unit suit symbol under it. The index column
    is centered 36 units from the card's left edge, so a tightly fanned hand still shows it. "10" is
    set tight and narrowed to 84% width. All lettering is converted to vector outlines when the cards
    are generated, so the faces need no font at run time. Outline coordinates are written with 2
    decimals and must never contain an invalid number such as `NaN`, because a browser stops drawing a
    path at the first one (D-075); a test checks every generated card.
  - Number cards use the traditional pip layouts, pulled toward the middle to clear the indices:
    columns at 39.2% / 50% / 60.8% of the width, rows at 92% of the traditional spread, pips 40
    units.
  - Aces have one large central pip. The A♠ gets a decorative but original design (a ring of
    radius 70, sized to clear the indices).
  - **Court cards (J, Q, K) have original simplified designs:** a stylized, two-headed (mirrored)
    figure with crown, hat, or headdress, drawn from basic shapes in the suit colors. They are
    instantly readable as a king, queen, or jack, but not copied from any existing pattern. The
    picture panel is drawn at 154 × 274 and scaled to 80%, centered, so it sits between the indices.
  - Colors: hearts and diamonds red `#c8102e`, spades and clubs black `#1a1a1a`, on a white
    `#fdfdf8` card with rounded corners (corner radius 5% of the card width) and a thin border.
  - Card proportions: poker size, 63.5 × 88.9 mm, width/height ≈ 0.714.
  - The generator and its output are listed in the asset register as `"origin": "generated"`.
- **Phase 2 (later):** the court cards are redrawn as vector art from **19th-century court cards
  that are public domain because of their age** (for example Goodall or Bicycle patterns, using museum
  or library scans with clear public-domain status). Each scan's source is recorded in the asset
  register. Other card sources that were evaluated and rejected are listed in `09-licensing-and-sbom.md` §7.
