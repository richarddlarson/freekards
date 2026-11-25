/**
 * Standard 52-card deck primitives shared by every game.
 *
 * A card is a two-character string id: rank character + suit character.
 * Rank characters: A 2 3 4 5 6 7 8 9 T J Q K. Suit characters: S H D C.
 * This is the same id the theme system uses for card-face file names (spec 07).
 */

export const SUITS = ['C', 'D', 'S', 'H'] as const;
export type Suit = (typeof SUITS)[number];

export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type RankChar = (typeof RANK_CHARS)[number];

export type Card = `${RankChar}${Suit}`;

/** Numeric rank, 2..14 (ace high). */
export function rankOf(card: Card): number {
  return RANK_CHARS.indexOf(card[0] as RankChar) + 2;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

export function makeCard(rank: number, suit: Suit): Card {
  const ch = RANK_CHARS[rank - 2];
  if (ch === undefined) throw new RangeError(`Invalid rank ${rank}`);
  return `${ch}${suit}`;
}

/** A fresh, ordered 52-card deck (clubs, diamonds, spades, hearts; 2 → A within each suit). */
export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push(makeCard(rank, suit));
  }
  return deck;
}

export function isCard(value: string): value is Card {
  return (
    value.length === 2 &&
    (RANK_CHARS as readonly string[]).includes(value[0]!) &&
    (SUITS as readonly string[]).includes(value[1]!)
  );
}

/**
 * Display order of the player's hand (D-054, D-064): suits always grouped C, D, S, H (spec 10);
 * within a suit, low cards on the left (the default) or on the right. The suit groups never move,
 * whichever order is chosen.
 */
export type CardOrder = 'low-left' | 'low-right';

export function sortHand(cards: readonly Card[], order: CardOrder = 'low-left'): Card[] {
  const dir = order === 'low-right' ? -1 : 1;
  return [...cards].sort((a, b) => {
    const s = SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));
    return s !== 0 ? s : dir * (rankOf(a) - rankOf(b));
  });
}
