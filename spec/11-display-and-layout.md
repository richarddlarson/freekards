# 11 — Display, Resolution, and Layout (core spec, engine-neutral)

Status: targets **[Confirmed]** (D-028, D-029). Layout model **[Confirmed]**, implemented (D-035, D-036).
The exact positions are in `12-hearts-table.md` §2.

## 1. Target devices
- **Primary device:** Microsoft Surface Pro 9, the ARM model. 13" touchscreen, **2880×1920** native
  resolution (3:2 aspect ratio, about 267 PPI). Windows' default display scaling on this device is
  200%, so the app gets a usable area of about **1440×960 logical units**.
- **Supported range:** native screen resolutions from **1920×1080 (Full HD)** up to **3840×2160 (4K)**,
  in any aspect ratio between **16:9 and 3:2** (16:10 is included). The app scales up and down to fit.
- The app may also run in a window smaller than full screen, down to its minimum window size
  (set in the runtime spec).

## 2. Layout model
- All layout is defined on a **reference table of 1920×1280 logical units (3:2)**. That is the
  Surface Pro 9's shape, the primary design target.
- **Uniform scaling:** scale = min(window width / 1920, window height / 1280). The table is always
  scaled up or down without distortion, and centered.
- **Wider screens (16:10, 16:9):** the extra width on the left and right is filled with the table
  surface itself, never black bars. Edge-anchored elements (the menu button, score panel, opponent
  seats at West and East) are positioned relative to the window edges, so they spread into the
  extra space. Everything else is positioned relative to the table center.
- **Safe area:** nothing essential is placed within 2% of any window edge.
- Element positions are written as proportions of the reference table (see 05: "numbers, not adjectives").

## 3. Sharpness
- Art is authored as vector (SVG master files) wherever possible, so it stays crisp at any scale.
- Raster art (photos, textures, portraits) is exported at **2× the reference size**, which covers
  4K and the Surface's 200% scaling without blur. A 1× version may also be shipped for speed.

## 4. Touch targets
- Interactive elements are at least **48×48 logical units** at the reference scale. On the Surface
  that is about 9 mm, which is comfortable for a finger.
- At the minimum scale (a 1920×1080 screen at 150% Windows scaling), cards in the player's hand still
  overlap no more than leaves at least **60 logical units** of each card exposed: the whole corner
  index stays visible, and every card can be tapped (D-061).

## 5. Orientation
- **Landscape only.** There is no separate portrait layout. In portrait, or in any window taller
  than 3:2, the same uniform scaling applies: the table shrinks to fit the width, and the table
  surface fills the space above and below. The game still works fully in that state.
