/** Main menu and game setup screens (spec 12 §1). */
import type { Difficulty, dialogue, hearts, rules } from '../logic/index.js';
import { CHARACTERS, portraitColors } from './content.js';
import type { Settings } from './settings.js';
import { soundSettingsPanel } from './sound-settings.js';
import { coinBadge, playerBadge } from './profile-screens.js';
import type { profile } from '../logic/index.js';
import { choiceRow, h, onTap, type Stage } from './stage.js';
import { settingsPanel } from './settings-panel.js';
import { openRules } from './rules-panel.js';

type CharacterDef = dialogue.CharacterDef;

export function showMainMenu(
  stage: Stage,
  actions: { playHearts(): void; playSpades(): void; playRummy500(): void; playGin(): void; quit(): void; stats(): void; switchPlayer(): void; about(): void },
  player: profile.Profile | null,
): void {
  stage.clear();
  const screen = h('div', 'screen menu-screen');
  if (player) {
    // Player bar (spec 15 §4): who's playing, their KardCoins, Stats and Switch player.
    const bar = h('div', 'player-bar');
    const who = h('div', 'player-chip');
    who.append(playerBadge(player, 'player-face small'), h('span', 'player-name', player.name), coinBadge(player.coins));
    const stats = h('button', 'choice', 'My stats');
    const sw = h('button', 'choice', 'Switch player');
    onTap(stats, actions.stats);
    onTap(sw, actions.switchPlayer);
    bar.append(who, stats, sw);
    screen.append(bar);
  }
  screen.append(h('h1', 'title', 'FreeKards'), h('p', 'subtitle', 'Classic card games with friendly faces'));
  const list = h('div', 'menu-list');
  const hearts = h('button', 'big-button play', 'Play Hearts');
  onTap(hearts, actions.playHearts);
  const spadesBtn = h('button', 'big-button play', 'Play Spades');
  onTap(spadesBtn, actions.playSpades);
  const rummy500Btn = h('button', 'big-button play', 'Play Rummy 500');
  onTap(rummy500Btn, actions.playRummy500);
  const ginBtn = h('button', 'big-button play', 'Play Gin Rummy');
  onTap(ginBtn, actions.playGin);
  list.append(hearts, spadesBtn, rummy500Btn, ginBtn);
  for (const name of ['Blackjack', 'Poker', 'Solitaire']) {
    const b = h('button', 'big-button secondary soon');
    b.append(h('span', 'soon-name', name), h('span', 'soon-note', 'coming soon'));
    b.disabled = true;
    list.append(b);
  }
  const sound = h('button', 'big-button quiet', 'Sound');
  onTap(sound, () => {
    const overlay = h('div', 'overlay centered');
    overlay.append(soundSettingsPanel(() => overlay.remove()));
    screen.append(overlay);
  });
  const settings = h('button', 'big-button quiet', 'Settings');
  onTap(settings, () => {
    const overlay = h('div', 'overlay centered');
    overlay.append(settingsPanel(() => overlay.remove()));
    screen.append(overlay);
  });
  const about = h('button', 'big-button quiet', 'About');
  onTap(about, actions.about);
  const quit = h('button', 'big-button quiet', 'Quit');
  onTap(quit, actions.quit);
  const footer = h('div', 'menu-footer');
  footer.append(sound, settings, about, quit);
  list.append(footer);
  screen.append(list);
  stage.el.append(screen);
}

export function portraitBadge(c: CharacterDef, className = 'portrait-face'): HTMLElement {
  const face = h('div', className, c.nickname.replace(/^The /, '').charAt(0));
  const [light, dark] = portraitColors(c.id);
  face.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${dark})`;
  return face;
}

/** The Rules button on a setup screen (spec 12 §10): opens that game's rules over the screen. */
function rulesButton(screen: HTMLElement, game: rules.RulesGame): HTMLElement {
  const b = h('button', 'big-button secondary', 'Rules');
  onTap(b, () => openRules(screen, game));
  return b;
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
  buttons.append(back, rulesButton(screen, 'hearts'), start);
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

const SPADES_SEAT_LABELS = ['Partner', 'West', 'East'];

/** Spades setup (spec 17 §8): game length, difficulty, and partner + opponents (North, West, East). */
export function showSpadesSetup(
  stage: Stage,
  initial: profile.SpadesPrefs,
  actions: { start(s: profile.SpadesPrefs): void; back(): void },
): void {
  stage.clear();
  const s: profile.SpadesPrefs = { ...initial, players: initial.players ? [...initial.players] : null };
  const screen = h('div', 'screen setup-screen');
  const panel = h('div', 'setup-panel');
  panel.append(h('h2', 'setup-title', 'Spades'));
  panel.append(
    choiceRow<'300' | '500'>('Game to', [['300', '300 points'], ['500', '500 points']], String(s.targetScore) as '300' | '500', (v) => (s.targetScore = v === '500' ? 500 : 300)),
    choiceRow<Difficulty>('Difficulty', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], s.difficulty, (v) => (s.difficulty = v)),
  );

  const row = h('div', 'setup-row');
  const label = h('div', 'setup-label', 'Partner and opponents');
  const random = h('button', 'choice', 'Random');
  const hint = h('span', 'setup-hint', '');
  const head = h('div', 'opponents-head');
  head.append(label, random, hint);
  const grid = h('div', 'opponent-grid');
  const tiles = new Map<string, HTMLElement>();
  for (const c of CHARACTERS) {
    const tile = h('button', 'opponent-tile');
    const text = h('div', 'opponent-text');
    text.append(h('div', 'opponent-name', c.nickname), h('div', 'opponent-full', c.name), h('div', 'opponent-tagline', c.tagline));
    tile.append(portraitBadge(c, 'portrait-face small'), text, h('div', 'seat-badge'));
    onTap(tile, () => {
      const chosen = s.players ?? [];
      if (chosen.includes(c.id)) s.players = chosen.filter((x) => x !== c.id);
      else if (chosen.length < 3) s.players = [...chosen, c.id];
      else return;
      refresh();
    });
    tiles.set(c.id, tile);
    grid.append(tile);
  }
  onTap(random, () => {
    s.players = null;
    refresh();
  });
  row.append(head, grid);
  panel.append(row);

  const buttons = h('div', 'dialog-buttons');
  const back = h('button', 'big-button secondary', 'Back');
  const start = h('button', 'big-button', 'Deal!');
  onTap(back, actions.back);
  onTap(start, () => {
    if (s.players === null || s.players.length === 3) actions.start(s);
  });
  buttons.append(back, rulesButton(screen, 'spades'), start);
  panel.append(buttons);

  function refresh(): void {
    random.classList.toggle('selected', s.players === null);
    const chosen = s.players ?? [];
    for (const [id, tile] of tiles) {
      const i = chosen.indexOf(id);
      tile.classList.toggle('selected', i >= 0);
      tile.querySelector('.seat-badge')!.textContent = i >= 0 ? SPADES_SEAT_LABELS[i]! : '';
    }
    const next = SPADES_SEAT_LABELS[chosen.length];
    hint.textContent = s.players === null ? 'A random partner and opponents' : chosen.length === 3 ? 'Ready!' : `Pick your ${next === 'Partner' ? 'partner' : `${next} opponent`}`;
    start.disabled = s.players !== null && chosen.length !== 3;
  }
  refresh();
  screen.append(panel);
  stage.el.append(screen);
}

/** Setup for a 2-player game (Gin Rummy, Rummy 500; spec 18 §4.1): difficulty and one opponent (or Random). */
export function showTwoPlayerSetup(
  stage: Stage,
  game: 'gin' | 'rummy500',
  initial: profile.TwoPlayerPrefs,
  actions: { start(s: profile.TwoPlayerPrefs): void; back(): void },
): void {
  stage.clear();
  const s: profile.TwoPlayerPrefs = { ...initial };
  const screen = h('div', 'screen setup-screen');
  const panel = h('div', 'setup-panel');
  panel.append(h('h2', 'setup-title', game === 'gin' ? 'Gin Rummy' : 'Rummy 500'));
  panel.append(choiceRow<Difficulty>('Difficulty', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], s.difficulty, (v) => (s.difficulty = v)));

  const row = h('div', 'setup-row');
  const random = h('button', 'choice', 'Random');
  const hint = h('span', 'setup-hint', '');
  const head = h('div', 'opponents-head');
  head.append(h('div', 'setup-label', 'Opponent'), random, hint);
  const grid = h('div', 'opponent-grid');
  const tiles = new Map<string, HTMLElement>();
  for (const c of CHARACTERS) {
    const tile = h('button', 'opponent-tile');
    const text = h('div', 'opponent-text');
    text.append(h('div', 'opponent-name', c.nickname), h('div', 'opponent-full', c.name), h('div', 'opponent-tagline', c.tagline));
    tile.append(portraitBadge(c, 'portrait-face small'), text, h('div', 'seat-badge'));
    onTap(tile, () => {
      s.opponent = s.opponent === c.id ? null : c.id;
      refresh();
    });
    tiles.set(c.id, tile);
    grid.append(tile);
  }
  onTap(random, () => {
    s.opponent = null;
    refresh();
  });
  row.append(head, grid);
  panel.append(row);

  const buttons = h('div', 'dialog-buttons');
  const back = h('button', 'big-button secondary', 'Back');
  const start = h('button', 'big-button', 'Deal!');
  onTap(back, actions.back);
  onTap(start, () => actions.start(s));
  buttons.append(back, rulesButton(screen, game), start);
  panel.append(buttons);

  function refresh(): void {
    random.classList.toggle('selected', s.opponent === null);
    for (const [id, tile] of tiles) {
      tile.classList.toggle('selected', id === s.opponent);
      tile.querySelector('.seat-badge')!.textContent = id === s.opponent ? 'Opponent' : '';
    }
    hint.textContent = s.opponent === null ? 'A random opponent' : 'Ready!';
  }
  refresh();
  screen.append(panel);
  stage.el.append(screen);
}
