/**
 * The Settings panel (spec 16): the active player's own settings. Opened from the main menu and
 * from the in-game pause menu. Every change is saved to the player's profile at once.
 */
import { sortHand, type Card, type settings } from '../logic/index.js';
import { cardBackUrl, cardFaceUrl } from './content.js';
import { activeProfile, activeSettings, updateActiveSettings } from './profiles.js';
import { choiceRow, h, onTap } from './stage.js';

type CardOrder = settings.CardOrder;
type CardResponse = settings.CardResponse;
type GameSpeed = settings.GameSpeed;
type CardDeck = settings.CardDeck;
type TableFelt = settings.TableFelt;

const PREVIEW_HAND: Card[] = ['2C', '9C', 'KC', '4D', 'JD', '5S', 'QS', 'AS', '3H', 'TH'];
const DECK_PREVIEW: Card[] = ['AS', 'KH', 'QC', 'TD', '7S', '2H'];

const DECK_TEXT: Record<CardDeck, string> = {
  classic: 'Crisp, narrow letters. Red backs.',
  rounded: 'Soft, rounded letters. Blue backs.',
};

const FELT_TEXT: Record<TableFelt, string> = {
  green: 'The classic card-room green.',
  blue: 'A deep, calm blue.',
  burgundy: 'A dark wine red.',
  gold: 'A soft, antique gold.',
  amber: 'A warm, burnt orange.',
};

const RESPONSE_TEXT: Record<CardResponse, string> = {
  standard: 'A card plays when you lift your finger. You can also drag it onto the table.',
  quick: 'A card pops up as soon as you touch it and moves faster. You can also drag it onto the table.',
  instant: 'A card plays the moment you touch it.',
};

const SPEED_TEXT: Record<GameSpeed, string> = {
  relaxed: 'Opponents take their time, and finished tricks stay on the table longer.',
  normal: 'The usual pace.',
  fast: 'Opponents play quickly, and finished tricks clear sooner.',
};

interface SettingRow {
  block: HTMLElement;
  /** Redraw the explanation (for previews that depend on another setting). */
  refresh: () => void;
}

/** A row of choices with a line of explanation under it that follows the selection. */
function settingRow<T extends string>(
  label: string,
  options: readonly [T, string][],
  value: T,
  describe: (v: T) => string | HTMLElement,
  onChange: (v: T) => void,
): SettingRow {
  const block = h('div', 'setting-block');
  const note = h('div', 'setting-note');
  let current = value;
  const show = () => note.replaceChildren(describe(current));
  block.append(
    choiceRow(label, options, value, (v) => {
      current = v;
      onChange(v);
      show();
    }),
    note,
  );
  show();
  return { block, refresh: show };
}

function previewCard(src: string, alt: string): HTMLElement {
  const img = h('img', 'order-card');
  img.src = src;
  img.alt = alt;
  img.draggable = false;
  return img;
}

function orderPreview(order: CardOrder): HTMLElement {
  const deck = activeSettings().cardDeck;
  const strip = h('div', 'order-preview');
  for (const card of sortHand(PREVIEW_HAND, order)) strip.append(previewCard(cardFaceUrl(card, deck), card));
  return strip;
}

/** The deck's back and a few of its cards, with a line about its look. */
function deckPreview(deck: CardDeck): HTMLElement {
  const wrap = h('div', 'deck-preview');
  const strip = h('div', 'order-preview');
  strip.append(previewCard(cardBackUrl(deck), 'card back'));
  for (const card of DECK_PREVIEW) strip.append(previewCard(cardFaceUrl(card, deck), card));
  wrap.append(strip, h('span', 'deck-text', DECK_TEXT[deck]));
  return wrap;
}

export function settingsPanel(onDone: () => void): HTMLElement {
  const s = activeSettings();
  const player = activeProfile();
  const panel = h('div', 'dialog settings-panel');
  panel.append(h('h2', '', 'Settings'));
  panel.append(h('p', 'settings-for', player ? `Saved for ${player.name}` : 'Not saved: no player is selected'));

  const order = settingRow<CardOrder>(
    'Card order',
    [
      ['low-left', 'Low cards on the left'],
      ['low-right', 'Low cards on the right'],
    ],
    s.cardOrder,
    orderPreview,
    (v) => updateActiveSettings({ cardOrder: v }),
  );
  const deck = settingRow<CardDeck>(
    'Card deck',
    [
      ['classic', 'Classic'],
      ['rounded', 'Rounded'],
    ],
    s.cardDeck,
    deckPreview,
    (v) => {
      updateActiveSettings({ cardDeck: v });
      order.refresh(); // the order preview is drawn in the chosen deck
    },
  );

  const felt = settingRow<TableFelt>(
    'Table color',
    [
      ['green', 'Green'],
      ['blue', 'Blue'],
      ['burgundy', 'Burgundy'],
      ['gold', 'Gold'],
      ['amber', 'Amber'],
    ],
    s.tableFelt,
    (v) => FELT_TEXT[v],
    (v) => updateActiveSettings({ tableFelt: v }), // the table behind the panel changes at once
  );

  panel.append(
    deck.block,
    felt.block,
    order.block,
    settingRow<CardResponse>(
      'Card response',
      [
        ['standard', 'Standard'],
        ['quick', 'Quick'],
        ['instant', 'Instant'],
      ],
      s.cardResponse,
      (v) => RESPONSE_TEXT[v],
      (v) => updateActiveSettings({ cardResponse: v }),
    ).block,
    settingRow<GameSpeed>(
      'Game speed',
      [
        ['relaxed', 'Relaxed'],
        ['normal', 'Normal'],
        ['fast', 'Fast'],
      ],
      s.gameSpeed,
      (v) => SPEED_TEXT[v],
      (v) => updateActiveSettings({ gameSpeed: v }),
    ).block,
  );

  const row = h('div', 'dialog-buttons');
  const done = h('button', 'big-button', 'Done');
  done.dataset['escape'] = ''; // the Esc key presses this button (D-058)
  onTap(done, onDone);
  row.append(done);
  panel.append(row);
  return panel;
}
