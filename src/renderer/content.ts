/**
 * Loads canonical content (spec/content, D-031) and theme assets (assets/themes) into the renderer.
 * Vite bundles these at build time; nothing is fetched at runtime.
 */
import type { Card, dialogue, settings } from '../logic/index.js';

type CardDeck = settings.CardDeck;
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

// Card decks (spec 07 §Card decks, D-062): assets/themes/<theme>/decks/<deck>/{faces/*.svg, back.svg}.
const DECKS_DIR = '../../assets/themes/classic-casino/decks';
const faces = import.meta.glob<string>('../../assets/themes/classic-casino/decks/*/faces/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const backs = import.meta.glob<string>('../../assets/themes/classic-casino/decks/*/back.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function cardFaceUrl(card: Card, deck: CardDeck): string {
  const url = faces[`${DECKS_DIR}/${deck}/faces/${card}.svg`];
  if (!url) throw new Error(`missing card face ${deck}/${card}`);
  return url;
}

export function cardBackUrl(deck: CardDeck): string {
  const url = backs[`${DECKS_DIR}/${deck}/back.svg`];
  if (!url) throw new Error(`missing card back ${deck}`);
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

/**
 * Load and decode every card image of a deck up front, so flips never show a stale or blank image.
 * Without a deck, every deck is loaded (so switching decks mid-game is instant too).
 */
export async function preloadCardImages(deck?: CardDeck): Promise<void> {
  const inDeck = (path: string) => !deck || path.startsWith(`${DECKS_DIR}/${deck}/`);
  const urls = [...Object.entries(faces), ...Object.entries(backs)].filter(([path]) => inDeck(path)).map(([, url]) => url);
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
