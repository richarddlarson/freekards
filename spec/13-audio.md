# 13 — Audio: Sound Effects, Music, Volume (core spec, engine-neutral)

Status: **[Confirmed]** system design (D-038). Track and sample choices are pending the owner's picks
(D-039). Voices are covered in spec 08 and D-005 and are not implemented yet.

## 1. Channels and volume
| Channel | Default level | Content |
|---------|---------------|---------|
| Music | 0.45 | Background music playlist |
| Effects | 0.80 | Card and table sounds |
| Voices | 1.00 | Character voice clips (later) |

- Each channel has a level slider from 0 to 100%, plus one **Mute all** switch. The settings persist
  with the other preferences (spec 12 §5).
- Perceived loudness: slider position `p` (0–1) maps to gain `p²`, so the slider feels even.
- When a voice clip plays, music is **ducked** to 50% of its level for the clip's length, fading
  in and out over 250 ms (once voices exist).
- When the app is hidden or minimized, music pauses, and it resumes when the app is shown again.

## 2. Sound cues
Cues are named ids. `spec/content/audio.json` maps each cue to one or more files. When a cue has
several files, one is picked at random, never the same file twice in a row if there's a choice.
Every play varies slightly: pitch (playback rate) × random 0.96–1.04 and volume × random 0.9–1.0.

| Cue | When (Hearts) |
|-----|---------------|
| `card.shuffle` | Start of every deal. Cut to 1.8 s with a 0.3 s fade; dealing starts 1.5 s after it begins |
| `card.deal` | Each card dealt, at most one sound every 110 ms (cards in between are silent), at gain 0.6 |
| `card.place` | A card lands in the trick |
| `card.collect` | A finished trick is swept to its winner |
| `card.pass` | The pass exchange starts |
| `card.select` | A card is lifted or lowered while choosing cards to pass (gain 0.7) |
| `table.hearts_broken` | Hearts are broken (optional; silent if no file is mapped) |
| `table.queen` | Someone takes the Queen of Spades (optional) |
| `table.moon` | Someone shoots the moon (optional) |
| `game.win` / `game.lose` | Game-over dialog, depending on whether the human won (optional) |

A cue with no file mapped is silent. Missing or broken files never stop the game.

## 3. Music
- The playlist (from `audio.json`) is shuffled when the app starts and plays continuously across all
  screens. After the last track it is reshuffled, without starting on the track that just played.
- Tracks **crossfade over 3 s**. The first track fades in over 2 s at startup.
- Music on or off is simply the Music slider (0 = off). There is no separate music switch.

## 4. `spec/content/audio.json` schema (`schemaVersion: 1`)
```json
{
  "schemaVersion": 1,
  "defaults": { "music": 0.45, "sfx": 0.8, "voice": 1.0 },
  "cues": { "card.place": ["assets/audio/sfx/kenney-casino-audio/card-place-1.ogg", "…"] },
  "cueOptions": { "card.deal": { "gain": 0.6, "minGapMs": 110 }, "card.shuffle": { "maxSeconds": 1.8 } },
  "music": [
    { "id": "a-good-bass-for-gambling", "title": "A Good Bass for Gambling", "composer": "Komiku",
      "file": "assets/audio/music/a-good-bass-for-gambling.mp3" }
  ]
}
```
Paths are relative to the repository root. Every file must also be in the asset register.
`cueOptions` (all optional): `gain` multiplies the cue's volume; `minGapMs` drops repeats that come
sooner than this; `maxSeconds` cuts the sound at that length with a 0.3 s fade.

Current mapping (Kenney Casino Audio): shuffle → `card-shuffle`; deal and select → `card-slide-1…8`;
place → `card-place-1…4`; collect → `card-shove-1…4`; pass → `card-fan-1…2`. Stinger cues have no files yet.

## 5. Sources (D-039)
- Effects: Kenney "Casino Audio" 1.1 (CC0), https://kenney.nl/assets/casino-audio. Its bundled
  `License.txt` (CC0) ships beside the sounds in `assets/audio/sfx/kenney-casino-audio/`. Only the 19
  card sounds used are copied, unmodified. The owner downloads the pack manually, because the site's download page asks visitors whether they'd like to donate, and that
  is not scripted around.
- Music: tracks from **FreePD** (all CC0 1.0, by FreePD's own statement, archived 2024-06-01 at
  https://web.archive.org/web/20240601000000/https://freepd.com/). freepd.com closed in 2025, so each
  track is taken from the Wayback Machine's copy of its **original freepd.com URL**. That URL and the
  file's SHA-256 are recorded in the asset register. Files are shipped exactly as published, without
  re-encoding.
