/** Profile screens (spec 15 §4): welcome / add player, "Who's playing?", and the player's stats page. */
import { casino, profile, type dialogue } from '../logic/index.js';
import { CHARACTERS, portraitColors } from './content.js';
import {
  activeProfile,
  addProfile,
  allProfiles,
  coinText,
  deleteProfile,
  REGULARS,
  renameProfile,
  selectProfile,
} from './profiles.js';
import { h, onTap, type Stage } from './stage.js';

type Profile = profile.Profile;

/** The KardCoin mark: a gold coin with a "K", drawn in CSS (no emoji, same look on every OS). */
export function coinIcon(size: 'small' | 'large' = 'small'): HTMLElement {
  return h('span', `coin-icon ${size}`, 'K');
}

export function coinBadge(amount: number, label = true): HTMLElement {
  const b = h('span', 'coin-badge');
  b.append(coinIcon(), h('span', 'coin-amount', coinText(amount)));
  if (label) b.append(h('span', 'coin-label', 'KardCoins'));
  return b;
}

/** Player initial in a colored circle; the color is derived from the profile id. */
export function playerBadge(p: Profile, className = 'player-face'): HTMLElement {
  const face = h('div', className, p.name.charAt(0).toUpperCase());
  let hash = 0;
  for (const ch of p.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  face.style.background = `radial-gradient(circle at 35% 30%, hsl(${hue} 55% 58%), hsl(${hue} 55% 32%))`;
  return face;
}

/** Name entry: first launch ("Welcome") or adding another player. */
export function showNameEntry(
  stage: Stage,
  opts: { firstRun: boolean; prefs?: profile.HeartsPrefs; onDone(): void; onCancel?(): void },
): void {
  stage.clear();
  const screen = h('div', 'screen');
  const panel = h('div', 'dialog name-panel');
  panel.append(h('h2', '', opts.firstRun ? 'Welcome to FreeKards!' : 'New player'));
  panel.append(h('p', 'name-prompt', opts.firstRun ? "What's your name?" : "What's the new player's name?"));
  const input = h('input', 'name-input');
  input.type = 'text';
  input.maxLength = profile.NAME_MAX;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Your name';
  panel.append(input);
  panel.append(h('p', 'name-note', `New players start with ${profile.WELCOME_COINS} KardCoins.`));
  const row = h('div', 'dialog-buttons');
  if (opts.onCancel) {
    const cancel = h('button', 'big-button secondary', 'Cancel');
    onTap(cancel, () => opts.onCancel?.());
    row.append(cancel);
  }
  const ok = h('button', 'big-button', opts.firstRun ? "Let's play!" : 'Add player');
  const valid = () => profile.cleanName(input.value) !== null;
  const submit = () => {
    if (!valid()) return;
    addProfile(input.value, opts.prefs);
    opts.onDone();
  };
  ok.disabled = true;
  input.addEventListener('input', () => (ok.disabled = !valid()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  onTap(ok, submit);
  row.append(ok);
  panel.append(row);
  screen.append(panel);
  stage.el.append(screen);
  // Selecting text is disabled app-wide; re-enable it for this field.
  input.style.userSelect = 'text';
  setTimeout(() => input.focus(), 50);
}

/** "Who's playing?" picker (D-049). */
export function showWhoIsPlaying(stage: Stage, opts: { onPicked(): void; onAdd(): void }): void {
  stage.clear();
  const screen = h('div', 'screen');
  screen.append(h('h1', 'who-title', "Who's playing?"));
  const grid = h('div', 'who-grid');
  for (const p of allProfiles()) {
    const tile = h('button', 'who-tile');
    tile.classList.toggle('selected', p.id === activeProfile()?.id);
    tile.append(playerBadge(p), h('div', 'who-name', p.name), coinBadge(p.coins, false));
    onTap(tile, () => {
      selectProfile(p.id);
      opts.onPicked();
    });
    grid.append(tile);
  }
  const add = h('button', 'who-tile add');
  add.append(h('div', 'player-face add-face', '+'), h('div', 'who-name', 'Add player'));
  onTap(add, opts.onAdd);
  grid.append(add);
  screen.append(grid);
  stage.el.append(screen);
}

/** A regular's colored initial (as on the table, spec 12 §4). */
function characterFace(c: dialogue.CharacterDef): HTMLElement {
  const face = h('div', 'portrait-face tiny', c.nickname.replace(/^The /, '').charAt(0));
  const [light, dark] = portraitColors(c.id);
  face.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${dark})`;
  return face;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

function confirmDialog(parent: HTMLElement, title: string, text: string, yes: string, onYes: () => void): void {
  const overlay = h('div', 'overlay centered');
  const panel = h('div', 'dialog');
  panel.append(h('h2', '', title), h('p', 'dialog-text', text));
  const row = h('div', 'dialog-buttons');
  const no = h('button', 'big-button secondary', 'Cancel');
  const ok = h('button', 'big-button danger', yes);
  onTap(no, () => overlay.remove());
  onTap(ok, () => {
    overlay.remove();
    onYes();
  });
  row.append(no, ok);
  panel.append(row);
  overlay.append(panel);
  parent.append(overlay);
}

/** The player's page: name, balance, Hearts statistics, recent coin history (spec 15 §4). */
type StatsTab = 'hearts' | 'spades' | 'rummy500' | 'gin' | 'poker';
/** The game tab last shown on My stats (for this run of the app). */
let lastStatsTab: StatsTab = 'hearts';
/** The right-hand list last shown: Recent KardCoins or the regulars' leaderboard. */
let lastSideTab = 'ledger';

export function showProfilePage(stage: Stage, opts: { onBack(): void; onDeletedLast(): void }): void {
  const p = activeProfile();
  if (!p) return opts.onDeletedLast();
  stage.clear();
  const screen = h('div', 'screen');
  const panel = h('div', 'setup-panel profile-panel');

  const head = h('div', 'profile-head');
  const name = h('h2', 'profile-name', p.name);
  const rename = h('button', 'choice', 'Rename');
  onTap(rename, () => {
    const input = h('input', 'name-input inline');
    input.value = p.name;
    input.maxLength = profile.NAME_MAX;
    input.style.userSelect = 'text';
    const save = () => {
      renameProfile(p.id, input.value);
      showProfilePage(stage, opts);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    input.addEventListener('blur', save);
    name.replaceWith(input);
    rename.remove();
    input.focus();
    input.select();
  });
  head.append(playerBadge(p), name, rename);
  const balance = h('div', 'profile-balance');
  balance.append(coinIcon('large'), h('span', 'profile-coins', coinText(p.coins)), h('span', 'coin-label', 'KardCoins'));
  panel.append(head, balance);

  const ratio = (a: number, b: number) => (b === 0 ? '—' : `${a} of ${b}`);
  const opt = (n: number | null) => (n === null ? '—' : String(n));
  const s = p.stats.hearts;
  const sp = p.stats.spades;
  const g = p.stats.gin;
  const r = p.stats.rummy500;
  const pk = p.stats.fiveCardDraw;
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${coinText(Math.abs(n))}`;
  const games: [StatsTab, string, [string, string][]][] = [
    ['hearts', 'Hearts', [
      ['Games played', String(s.gamesPlayed)],
      ['Games won', `${s.gamesWon} (${pct(profile.winRate(s))})`],
      ['Finishes 1st · 2nd · 3rd · 4th', s.placings.join(' · ')],
      ['Win streak (current · best)', `${s.currentWinStreak} · ${s.bestWinStreak}`],
      ['Best · worst final score', s.bestScore === null ? '—' : `${s.bestScore} · ${s.worstScore}`],
      ['Hands played', String(s.handsPlayed)],
      ['Moons shot', String(s.moonsShot)],
      ['Queens of Spades taken', String(s.queensTaken)],
      ['KardCoins earned in Hearts', coinText(s.coinsEarned)],
    ]],
    ['spades', 'Spades', [
      ['Games played', String(sp.gamesPlayed)],
      ['Games won', `${sp.gamesWon} (${pct(profile.winRate(sp))})`],
      ['Win streak (current · best)', `${sp.currentWinStreak} · ${sp.bestWinStreak}`],
      ['Best final score', opt(sp.bestScore)],
      ['Hands played', String(sp.handsPlayed)],
      ['Contracts made', ratio(sp.contractsMade, sp.contractsBid)],
      ['Nils made', ratio(sp.nilsMade, sp.nilsBid)],
      ['KardCoins earned in Spades', coinText(sp.coinsEarned)],
    ]],
    ['rummy500', 'Rummy 500', [
      ['Games played', String(r.gamesPlayed)],
      ['Games won', `${r.gamesWon} (${pct(profile.winRate(r))})`],
      ['Win streak (current · best)', `${r.currentWinStreak} · ${r.bestWinStreak}`],
      ['Best final score', opt(r.bestScore)],
      ['Best hand', opt(r.bestHand)],
      ['Hands played', String(r.handsPlayed)],
      ['Times you went out', String(r.wentOut)],
      ['KardCoins earned in Rummy 500', coinText(r.coinsEarned)],
    ]],
    ['gin', 'Gin Rummy', [
      ['Games played', String(g.gamesPlayed)],
      ['Games won', `${g.gamesWon} (${pct(profile.winRate(g))})`],
      ['Win streak (current · best)', `${g.currentWinStreak} · ${g.bestWinStreak}`],
      ['Best winning total', opt(g.bestScore)],
      ['Hands won', ratio(g.handsWon, g.handsPlayed)],
      ['Gins', String(g.gins)],
      ['Undercuts', String(g.undercuts)],
      ['KardCoins earned in Gin Rummy', coinText(g.coinsEarned)],
    ]],
    ['poker', 'Poker', [
      ['Sessions', String(pk.sessions)],
      ['Hands won', ratio(pk.handsWon, pk.handsPlayed)],
      ['Biggest pot won', pk.biggestPot === null ? '—' : coinText(pk.biggestPot)],
      ['Best hand', pk.bestHand?.name ?? '—'],
      ['Best session', pk.bestSession === null ? '—' : signed(pk.bestSession)],
      ['KardCoins won or lost', pk.sessions === 0 ? '—' : signed(pk.netCoins)],
    ]],
  ];
  const stats = h('div', 'stats-section');
  const tabs = h('div', 'stats-tabs');
  const body = h('div', 'stats-body');
  const show = (tab: StatsTab) => {
    lastStatsTab = tab;
    const [, , rows] = games.find((x) => x[0] === tab)!;
    const grid = h('div', 'stats-grid');
    for (const [k, v] of rows) grid.append(h('span', 'stats-key', k), h('span', 'stats-value', v));
    body.replaceChildren(grid);
    for (const b of tabs.children) b.classList.toggle('selected', (b as HTMLElement).dataset['tab'] === tab);
  };
  for (const [tab, title] of games) {
    const b = h('button', 'choice', title);
    b.dataset['tab'] = tab;
    onTap(b, () => show(tab));
    tabs.append(b);
  }
  stats.append(tabs, body);
  show(lastStatsTab);

  // Right column (spec 15 §4): Recent KardCoins, or the casino regulars' leaderboard (spec 15 §6).
  const history = h('div', 'stats-section');
  const sideTabs = h('div', 'stats-tabs');
  const sideBody = h('div', 'stats-body');
  const ledger = () => {
    const list = h('div', 'ledger');
    for (const e of p.ledger.slice(0, 6)) {
      const when = new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      list.append(
        h('span', 'ledger-when', when),
        h('span', 'ledger-reason', e.reason),
        h('span', `ledger-amount ${e.amount >= 0 ? 'plus' : 'minus'}`, `${e.amount >= 0 ? '+' : '−'}${coinText(Math.abs(e.amount))}`),
      );
    }
    return list;
  };
  const board = () => {
    const list = h('div', 'leaderboard');
    casino.leaderboard(p, REGULARS).forEach((row, i) => {
      const c = row.id ? CHARACTERS.find((x) => x.id === row.id) : undefined;
      const who = h('span', `board-name${row.id === null ? ' you' : ''}`, row.id === null ? `${p.name} (you)` : (c?.nickname ?? row.id));
      const face = c ? characterFace(c) : playerBadge(p, 'player-face tiny');
      list.append(h('span', 'board-place', String(i + 1)), face, who, h('span', 'board-coins', coinText(row.coins)));
    });
    return list;
  };
  const sides: [string, string, () => HTMLElement][] = [
    ['ledger', 'Recent KardCoins', ledger],
    ['board', 'Casino regulars', board],
  ];
  const showSide = (id: string) => {
    lastSideTab = id;
    sideBody.replaceChildren(sides.find((x) => x[0] === id)![2]());
    for (const b of sideTabs.children) b.classList.toggle('selected', (b as HTMLElement).dataset['tab'] === id);
  };
  for (const [id, title] of sides) {
    const b = h('button', 'choice', title);
    b.dataset['tab'] = id;
    onTap(b, () => showSide(id));
    sideTabs.append(b);
  }
  history.append(sideTabs, sideBody);
  showSide(lastSideTab);
  const cols = h('div', 'profile-columns');
  cols.append(stats, history);
  panel.append(cols);

  const row = h('div', 'dialog-buttons');
  const del = h('button', 'big-button quiet', 'Delete player');
  onTap(del, () =>
    confirmDialog(screen, `Delete ${p.name}?`, `This permanently removes ${p.name}'s statistics and ${coinText(p.coins)} KardCoins.`, 'Delete', () => {
      deleteProfile(p.id);
      if (allProfiles().length === 0) opts.onDeletedLast();
      else opts.onBack();
    }),
  );
  const back = h('button', 'big-button', 'Back');
  onTap(back, opts.onBack);
  row.append(del, back);
  panel.append(row);
  screen.append(panel);
  stage.el.append(screen);
}
