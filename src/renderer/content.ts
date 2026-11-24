/**
 * Loads canonical content (spec/content, D-031) and theme assets (assets/themes) into the renderer.
 * Vite bundles these at build time; nothing is fetched at runtime.
 */
import type { Card, dialogue } from '../logic/index.js';

type CharacterDef = dialogue.CharacterDef;
type RosterDef = dialogue.RosterDef;

const characterFiles = import.meta.glob<CharacterDef | RosterDef>('../../spec/content/characters/*.json', {
  eager: true,
  import: 'default',
});

function load(): CharacterDef[] {
  let roster: RosterDef | undefined;
  const byId = new Map<string, CharacterDef>();
  for (const [path, data] of Object.entries(characterFiles)) {
    if (path.endsWith('/roster.json')) roster = data as RosterDef;
    else byId.set((data as CharacterDef).id, data as CharacterDef);
  }
  if (!roster) throw new Error('roster.json missing');
  return roster.characters.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`character ${id} listed in roster but not found`);
    return c;
  });
}

/** Characters in roster order. */
export const CHARACTERS: readonly CharacterDef[] = load();

export function characterById(id: string): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

const THEME = 'classic-casino';
const faces = import.meta.glob<string>('../../assets/themes/classic-casino/cards/faces/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const backs = import.meta.glob<string>('../../assets/themes/classic-casino/cards/backs/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function cardFaceUrl(card: Card): string {
  const url = faces[`../../assets/themes/${THEME}/cards/faces/${card}.svg`];
  if (!url) throw new Error(`missing card face ${card}`);
  return url;
}

export function cardBackUrl(name = 'red'): string {
  const url = backs[`../../assets/themes/${THEME}/cards/backs/${name}.svg`];
  if (!url) throw new Error(`missing card back ${name}`);
  return url;
}

/** Placeholder portrait colors until portrait art exists (spec 12 §4). */
const PORTRAIT_COLORS: Record<string, [string, string]> = {
  gus: ['#8a6a4a', '#4e3a26'],
  dot: ['#b28bc4', '#6f4a85'],
  chad: ['#f0922f', '#a8520c'],
  marguerite: ['#4f9aa8', '#245a64'],
  bernie: ['#e0648f', '#962a52'],
  reginald: ['#7556a8', '#3e2766'],
};

export function portraitColors(id: string): [string, string] {
  return PORTRAIT_COLORS[id] ?? ['#777777', '#333333'];
}

/** Load and decode every card image up front, so flips never show a stale or blank image. */
export async function preloadCardImages(): Promise<void> {
  const urls = [...Object.values(faces), ...Object.values(backs)];
  await Promise.all(
    urls.map(async (url) => {
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        /* a missing image shows as blank rather than blocking the game */
      }
    }),
  );
}
