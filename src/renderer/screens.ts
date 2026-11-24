/** Main menu and game setup screens (spec 12 §1). */
import type { Difficulty, dialogue, hearts } from '../logic/index.js';
import { CHARACTERS, portraitColors } from './content.js';
import type { Settings } from './settings.js';
import { h, onTap, type Stage } from './stage.js';

type CharacterDef = dialogue.CharacterDef;

export function showMainMenu(stage: Stage, actions: { playHearts(): void; quit(): void }): void {
  stage.clear();
  const screen = h('div', 'screen menu-screen');
  screen.append(h('h1', 'title', 'FreeKards'), h('p', 'subtitle', 'Classic card games with friendly faces'));
  const list = h('div', 'menu-list');
  const hearts = h('button', 'big-button', 'Play Hearts');
  onTap(hearts, actions.playHearts);
  list.append(hearts);
  for (const name of ['Spades', 'Rummy 500', 'Gin Rummy', 'Blackjack', 'Poker', 'Solitaire']) {
    const b = h('button', 'big-button secondary soon');
    b.append(h('span', 'soon-name', name), h('span', 'soon-note', 'coming soon'));
    b.disabled = true;
    list.append(b);
  }
  const quit = h('button', 'big-button quiet', 'Quit');
  onTap(quit, actions.quit);
  list.append(quit);
  screen.append(list);
  stage.el.append(screen);
}

function choiceRow<T extends string>(
  label: string,
  options: readonly [T, string][],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const row = h('div', 'setup-row');
  row.append(h('div', 'setup-label', label));
  const group = h('div', 'choice-group');
  const buttons = options.map(([v, text]) => {
    const b = h('button', 'choice', text);
    b.classList.toggle('selected', v === value);
    onTap(b, () => {
      for (const x of buttons) x.classList.remove('selected');
      b.classList.add('selected');
      onChange(v);
    });
    return b;
  });
  group.append(...buttons);
  row.append(group);
  return row;
}

export function portraitBadge(c: CharacterDef, className = 'portrait-face'): HTMLElement {
  const face = h('div', className, c.nickname.replace(/^The /, '').charAt(0));
  const [light, dark] = portraitColors(c.id);
  face.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${dark})`;
  return face;
}

const SEAT_LABELS = ['West', 'North', 'East'];

/** Hearts setup: rule set, difficulty, and opponents (D-008, D-010). */
export function showHeartsSetup(
  stage: Stage,
  initial: Settings,
  actions: { start(s: Settings): void; back(): void },
): void {
  stage.clear();
  const s: Settings = { ...initial, opponents: initial.opponents ? [...initial.opponents] : null };
  const screen = h('div', 'screen setup-screen');
  const panel = h('div', 'setup-panel');
  panel.append(h('h2', 'setup-title', 'Hearts'));
  panel.append(
    choiceRow<hearts.HeartsRuleSet>('Rules', [['standard', 'Standard'], ['jack-of-diamonds', 'Jack of Diamonds −10']], s.ruleSet, (v) => (s.ruleSet = v)),
    choiceRow<Difficulty>('Difficulty', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], s.difficulty, (v) => (s.difficulty = v)),
  );

  const oppRow = h('div', 'setup-row');
  const oppHead = h('div', 'setup-label', 'Opponents');
  const random = h('button', 'choice', 'Random');
  const hint = h('span', 'setup-hint', '');
  const head = h('div', 'opponents-head');
  head.append(oppHead, random, hint);
  const grid = h('div', 'opponent-grid');
  const tiles = new Map<string, HTMLElement>();
  for (const c of CHARACTERS) {
    const tile = h('button', 'opponent-tile');
    const text = h('div', 'opponent-text');
    text.append(h('div', 'opponent-name', c.nickname), h('div', 'opponent-full', c.name), h('div', 'opponent-tagline', c.tagline));
    const badge = h('div', 'seat-badge');
    tile.append(portraitBadge(c, 'portrait-face small'), text, badge);
    onTap(tile, () => {
      const chosen = s.opponents ?? [];
      if (chosen.includes(c.id)) s.opponents = chosen.filter((x) => x !== c.id);
      else if (chosen.length < 3) s.opponents = [...chosen, c.id];
      else return;
      refresh();
    });
    tiles.set(c.id, tile);
    grid.append(tile);
  }
  onTap(random, () => {
    s.opponents = null;
    refresh();
  });
  oppRow.append(head, grid);
  panel.append(oppRow);

  const buttons = h('div', 'dialog-buttons');
  const back = h('button', 'big-button secondary', 'Back');
  const start = h('button', 'big-button', 'Deal!');
  onTap(back, actions.back);
  onTap(start, () => {
    if (s.opponents === null || s.opponents.length === 3) actions.start(s);
  });
  buttons.append(back, start);
  panel.append(buttons);

  function refresh(): void {
    random.classList.toggle('selected', s.opponents === null);
    const chosen = s.opponents ?? [];
    for (const [id, tile] of tiles) {
      const i = chosen.indexOf(id);
      tile.classList.toggle('selected', i >= 0);
      tile.querySelector('.seat-badge')!.textContent = i >= 0 ? SEAT_LABELS[i]! : '';
    }
    hint.textContent = s.opponents === null ? 'Three random opponents' : `Pick ${3 - chosen.length} more` + (chosen.length === 3 ? '' : '');
    if (chosen.length === 3) hint.textContent = 'Ready!';
    start.disabled = s.opponents !== null && chosen.length !== 3;
  }
  refresh();
  screen.append(panel);
  stage.el.append(screen);
}
