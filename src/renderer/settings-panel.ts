/**
 * The Settings panel (spec 16): the active player's own settings. Opened from the main menu and
 * from the in-game pause menu. Every change is saved to the player's profile at once.
 */
import { sortHand, type Card, type settings } from '../logic/index.js';
import { cardFaceUrl } from './content.js';
import { activeProfile, activeSettings, updateActiveSettings } from './profiles.js';
import { choiceRow, h, onTap } from './stage.js';

type CardOrder = settings.CardOrder;
type CardResponse = settings.CardResponse;
type GameSpeed = settings.GameSpeed;

const PREVIEW_HAND: Card[] = ['2C', '9C', 'KC', '4D', 'JD', '5S', 'QS', 'AS', '3H', 'TH'];

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

/** A row of choices with a line of explanation under it that follows the selection. */
function settingRow<T extends string>(
  label: string,
  options: readonly [T, string][],
  value: T,
  describe: (v: T) => string | HTMLElement,
  onChange: (v: T) => void,
): HTMLElement {
  const block = h('div', 'setting-block');
  const note = h('div', 'setting-note');
  const show = (v: T) => note.replaceChildren(describe(v));
  block.append(
    choiceRow(label, options, value, (v) => {
      onChange(v);
      show(v);
    }),
    note,
  );
  show(value);
  return block;
}

function orderPreview(order: CardOrder): HTMLElement {
  const strip = h('div', 'order-preview');
  for (const card of sortHand(PREVIEW_HAND, order)) {
    const img = h('img', 'order-card');
    img.src = cardFaceUrl(card);
    img.alt = card;
    img.draggable = false;
    strip.append(img);
  }
  return strip;
}

export function settingsPanel(onDone: () => void): HTMLElement {
  const s = activeSettings();
  const player = activeProfile();
  const panel = h('div', 'dialog settings-panel');
  panel.append(h('h2', '', 'Settings'));
  panel.append(h('p', 'settings-for', player ? `Saved for ${player.name}` : 'Not saved: no player is selected'));

  panel.append(
    settingRow<CardOrder>(
      'Card order',
      [
        ['low-left', 'Low cards on the left'],
        ['low-right', 'Low cards on the right'],
      ],
      s.cardOrder,
      orderPreview,
      (v) => updateActiveSettings({ cardOrder: v }),
    ),
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
    ),
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
    ),
  );

  const row = h('div', 'dialog-buttons');
  const done = h('button', 'big-button', 'Done');
  done.dataset['escape'] = ''; // the Esc key presses this button (D-058)
  onTap(done, onDone);
  row.append(done);
  panel.append(row);
  return panel;
}
