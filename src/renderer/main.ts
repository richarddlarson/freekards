/**
 * Renderer entry point: screen flow (spec 12 §1).
 * Demo hashes for development screenshots (scripts/capture.cjs):
 *   #setup                         the Hearts setup screen
 *   #sound[&tracks]                the main menu with the Sound panel open (and its track list)
 *   #settings                      the main menu with the Settings panel open
 *   #welcome / #who / #stats[&regulars]  first-run name entry, the player picker, the stats page (on the regulars' leaderboard)
 *   #about[&licenses]              the About & Credits screen (on its Licenses tab)
 *   (add &record to a #hearts autoplay demo to record its result for the active player)
 *   #hearts&seed=7&autoplay&speed=3  a Hearts game with fixed seed, optionally self-playing
 *   #spades-setup                  the Spades setup screen
 *   #spades&seed=7&autoplay&speed=3[&target=500]  a Spades game (same options as #hearts)
 *   #gin-setup / #rummy500-setup   the Gin Rummy / Rummy 500 setup screen
 *   #gin&seed=7&autoplay&speed=3 / #rummy500&seed=7&autoplay&speed=3  a game (same options as #hearts)
 *   #poker-setup / #poker&seed=7&autoplay&speed=3[&stakes=medium]  Five-Card Draw setup / a self-playing table
 *   &felt=blue                     with any of the above: show that table felt instead of the player's
 */
import type { dialogue } from '../logic/index.js';
import { Rng } from '../logic/index.js';
import { CHARACTERS, characterById } from './content.js';
import { showHeartsSetup, showMainMenu, showPokerSetup, showSpadesSetup, showTwoPlayerSetup } from './screens.js';
import { loadSettings, saveSettings, type Settings } from './settings.js';
import { Stage } from './stage.js';
import { audio } from './audio.js';
import { HeartsTable, type HeartsGameResult } from './table/hearts-table.js';
import { SpadesTable, type SpadesGameResult } from './table/spades-table.js';
import { GinTable, type GinGameResult } from './table/gin-table.js';
import { Rummy500Table, type Rummy500GameResult } from './table/rummy500-table.js';
import { PokerTable, type PokerBank } from './table/poker-table.js';
import { casino, poker, profile } from '../logic/index.js';
import { activeProfile, activeSettings, allProfiles, loadProfiles, onProfilesChanged, REGULARS, replaceProfile, settleRegulars } from './profiles.js';
import { showNameEntry, showProfilePage, showWhoIsPlaying } from './profile-screens.js';
import { showAbout } from './credits.js';

// Native-app feel: no browser context menu, no ctrl+wheel zoom (spec runtimes/electron.md).
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

const stage = new Stage(document.getElementById('app')!);
audio.setVolumes(loadSettings().volumes);
audio.setMusicChoice(loadSettings().musicTrack);
void audio.preloadCues();
audio.startMusic();
let table: HeartsTable | SpadesTable | GinTable | Rummy500Table | PokerTable | null = null;
/** Spades choices when no profile is active (browser preview); profiles keep their own (spec 15 §2). */
let guestSpadesPrefs: profile.SpadesPrefs = { ...profile.DEFAULT_SPADES_PREFS };
const guestTwoPlayerPrefs: Record<TwoPlayerGame, profile.TwoPlayerPrefs> = {
  gin: { ...profile.DEFAULT_TWO_PLAYER_PREFS },
  rummy500: { ...profile.DEFAULT_TWO_PLAYER_PREFS },
};
type TwoPlayerGame = 'gin' | 'rummy500';
type Demo = { seed?: number; autoplay?: boolean; speed?: number; record?: boolean };

function pickOpponents(settings: Settings, seed: number): dialogue.CharacterDef[] {
  const chosen = settings.opponents?.map((id) => characterById(id)).filter((c): c is dialogue.CharacterDef => !!c);
  if (chosen && chosen.length === 3) return chosen;
  return new Rng(seed ^ 0x0ff0).shuffle(CHARACTERS).slice(0, 3);
}

function menu(): void {
  table?.destroy();
  table = null;
  showMainMenu(
    stage,
    { playHearts: setup, playSpades: spadesSetup, playRummy500: () => twoPlayerSetup('rummy500'), playGin: () => twoPlayerSetup('gin'), playPoker: pokerSetup, quit: () => window.close(), stats: statsPage, switchPlayer: whoIsPlaying, about: aboutPage },
    activeProfile(),
  );
}

/** Legacy device-wide Hearts preferences seed the first profile's preferences (D-049). */
function legacyPrefs(): profile.HeartsPrefs {
  const s = loadSettings();
  return { difficulty: s.difficulty, ruleSet: s.ruleSet, opponents: s.opponents };
}

function welcome(): void {
  showNameEntry(stage, { firstRun: true, prefs: legacyPrefs(), onDone: menu });
}

function addPlayer(): void {
  showNameEntry(stage, { firstRun: false, onDone: menu, onCancel: whoIsPlaying });
}

function whoIsPlaying(): void {
  showWhoIsPlaying(stage, { onPicked: menu, onAdd: addPlayer });
}

function statsPage(): void {
  showProfilePage(stage, { onBack: menu, onDeletedLast: welcome });
}

function aboutPage(): void {
  showAbout(stage, { onBack: menu });
}

function setup(): void {
  const p = activeProfile();
  const initial: Settings = { ...loadSettings(), ...(p ? p.prefs.hearts : {}) };
  showHeartsSetup(stage, initial, {
    back: menu,
    start: (s) => {
      const cur = activeProfile();
      if (cur) replaceProfile({ ...cur, prefs: { ...cur.prefs, hearts: { difficulty: s.difficulty, ruleSet: s.ruleSet, opponents: s.opponents } } });
      else saveSettings(s);
      play(s);
    },
  });
}

function spadesPrefs(): profile.SpadesPrefs {
  return activeProfile()?.prefs.spades ?? guestSpadesPrefs;
}

function spadesSetup(): void {
  showSpadesSetup(stage, spadesPrefs(), {
    back: menu,
    start: (s) => {
      const cur = activeProfile();
      if (cur) replaceProfile({ ...cur, prefs: { ...cur.prefs, spades: s } });
      else guestSpadesPrefs = s;
      playSpades(s);
    },
  });
}

/** Partner (North), West, East: the chosen characters, or three at random. */
function pickSpadesPlayers(prefs: profile.SpadesPrefs, seed: number): dialogue.CharacterDef[] {
  const chosen = prefs.players?.map((id) => characterById(id)).filter((c): c is dialogue.CharacterDef => !!c);
  const [north, west, east] = chosen && chosen.length === 3 ? chosen : new Rng(seed ^ 0x5ade).shuffle(CHARACTERS).slice(0, 3);
  return [west!, north!, east!];
}

function recordSpades(prefs: profile.SpadesPrefs, players: readonly dialogue.CharacterDef[], g: SpadesGameResult): ReturnType<typeof profile.recordSpadesGame> | null {
  const p = activeProfile();
  if (!p) return null;
  const r = profile.recordSpadesGame(p, { ...g, difficulty: prefs.difficulty }, new Date().toISOString());
  replaceProfile(r.profile);
  // Players are West, North (partner), East.
  settleRegulars(casino.spadesCredits(g.won, players[1]!.id, [players[0]!.id, players[2]!.id], prefs.difficulty));
  return { ...r, profile: activeProfile()! };
}

function playSpades(prefs: profile.SpadesPrefs, demo: { seed?: number; autoplay?: boolean; speed?: number; record?: boolean } = {}): void {
  table?.destroy();
  stage.clear();
  const seed = demo.seed ?? (Date.now() >>> 0);
  const players = pickSpadesPlayers(prefs, seed);
  const t = new SpadesTable(stage, {
    targetScore: prefs.targetScore,
    difficulty: prefs.difficulty,
    opponents: players,
    seed,
    autoplay: demo.autoplay,
    speed: demo.speed,
    getSettings: activeSettings,
    onGameFinished: (g) => (demo.autoplay && !demo.record ? null : recordSpades(prefs, players, g)),
    onExit: (next) => (next === 'again' ? playSpades(prefs) : menu()),
  });
  table = t;
  void t.run();
}

function twoPlayerPrefs(game: TwoPlayerGame): profile.TwoPlayerPrefs {
  return activeProfile()?.prefs[game] ?? guestTwoPlayerPrefs[game];
}

function twoPlayerSetup(game: TwoPlayerGame): void {
  showTwoPlayerSetup(stage, game, twoPlayerPrefs(game), {
    back: menu,
    start: (s) => {
      const cur = activeProfile();
      if (cur) replaceProfile({ ...cur, prefs: { ...cur.prefs, [game]: s } });
      else guestTwoPlayerPrefs[game] = s;
      playTwoPlayer(game, s);
    },
  });
}

/** The chosen opponent, or one at random. */
function pickOpponent(prefs: profile.TwoPlayerPrefs, seed: number): dialogue.CharacterDef {
  return (prefs.opponent ? characterById(prefs.opponent) : undefined) ?? new Rng(seed ^ 0x2a2a).pick(CHARACTERS);
}

function recordGin(prefs: profile.TwoPlayerPrefs, opponent: string, g: GinGameResult): ReturnType<typeof profile.recordGinGame> | null {
  const p = activeProfile();
  if (!p) return null;
  const r = profile.recordGinGame(p, { ...g, difficulty: prefs.difficulty }, new Date().toISOString());
  replaceProfile(r.profile);
  settleRegulars(casino.twoPlayerCredits(g.won, opponent, prefs.difficulty));
  return { ...r, profile: activeProfile()! };
}

function recordRummy500(prefs: profile.TwoPlayerPrefs, opponent: string, g: Rummy500GameResult): ReturnType<typeof profile.recordRummy500Game> | null {
  const p = activeProfile();
  if (!p) return null;
  const r = profile.recordRummy500Game(p, { ...g, difficulty: prefs.difficulty }, new Date().toISOString());
  replaceProfile(r.profile);
  settleRegulars(casino.twoPlayerCredits(g.won, opponent, prefs.difficulty));
  return { ...r, profile: activeProfile()! };
}

function playTwoPlayer(game: TwoPlayerGame, prefs: profile.TwoPlayerPrefs, demo: Demo = {}): void {
  table?.destroy();
  stage.clear();
  const seed = demo.seed ?? (Date.now() >>> 0);
  const opponent = pickOpponent(prefs, seed);
  const common = {
    difficulty: prefs.difficulty,
    opponents: [opponent],
    seed,
    autoplay: demo.autoplay,
    speed: demo.speed,
    getSettings: activeSettings,
    onExit: (next: 'menu' | 'again') => (next === 'again' ? playTwoPlayer(game, prefs) : menu()),
  };
  const t =
    game === 'gin'
      ? new GinTable(stage, { ...common, onGameFinished: (g) => (demo.autoplay && !demo.record ? null : recordGin(prefs, opponent.id, g)) })
      : new Rummy500Table(stage, { ...common, onGameFinished: (g) => (demo.autoplay && !demo.record ? null : recordRummy500(prefs, opponent.id, g)) });
  table = t;
  void t.run();
}

// ------------------------------------------------------------------ poker (spec 19)

let guestPokerPrefs: profile.PokerPrefs = { ...profile.DEFAULT_POKER_PREFS };
/** Without a profile (browser preview, demos), poker uses a throwaway guest with the usual 500. */
function guestProfile(): profile.Profile {
  return casino.syncRegulars(profile.createProfile('Guest', 'guest', new Date().toISOString()), REGULARS);
}

function pokerPrefs(): profile.PokerPrefs {
  return activeProfile()?.prefs.poker ?? guestPokerPrefs;
}

function pokerSetup(): void {
  const p = activeProfile() ?? guestProfile();
  showPokerSetup(stage, pokerPrefs(), { balance: p.coins, regularCoins: (id) => casino.regularBalance(p, id) }, {
    back: menu,
    start: (s) => {
      const cur = activeProfile();
      if (cur) replaceProfile({ ...cur, prefs: { ...cur.prefs, poker: s } });
      else guestPokerPrefs = s;
      playPoker(s);
    },
  });
}

/** The KardCoins behind the table: the active profile, or a guest kept in memory (spec 15 §6.3). */
function pokerBank(useProfile: boolean, stakes: poker.Stakes, start: profile.Profile): { bank: PokerBank; get(): profile.Profile } {
  let guest = start;
  const get = () => (useProfile ? (activeProfile() ?? guest) : guest);
  const put = (p: profile.Profile) => (useProfile && activeProfile() ? replaceProfile(p) : (guest = p));
  const now = () => new Date().toISOString();
  const bank: PokerBank = {
    balance: () => get().coins,
    rebuy: () => {
      const r = casino.rebuy(get(), now());
      if (!r) return null;
      put(r.profile);
      return r.chips;
    },
    regularRebuy: (id) => {
      const r = casino.seatRegular(get(), id);
      if (!r) return null;
      put(r.profile);
      return r.chips;
    },
    regularLeaves: (id) => put(casino.regularLeaves(get(), id)),
    seatRegular: (exclude) => {
      const p = get();
      const free = CHARACTERS.filter((c) => !exclude.includes(c.id) && casino.buyInAmount(casino.regularBalance(p, c.id), stakes) !== null);
      if (free.length === 0) return null;
      const c = free[Math.floor(Math.random() * free.length)]!;
      const r = casino.seatRegular(p, c.id);
      if (!r) return null;
      put(r.profile);
      return { character: c, chips: r.chips };
    },
    saveTable: (you, regulars) => put(casino.saveTable(get(), you, regulars)),
    cashOut: (session) => {
      const r = casino.cashOut(get(), session, REGULARS, now());
      put(r.profile);
      return { net: r.net, cashed: r.cashed, balance: r.profile.coins };
    },
  };
  return { bank, get };
}

function playPoker(prefs: profile.PokerPrefs, demo: Demo = {}): void {
  table?.destroy();
  stage.clear();
  const seed = demo.seed ?? (Date.now() >>> 0);
  const stakes = poker.STAKES[prefs.stakes];
  // A computer-played demo never touches the player's coins.
  const useProfile = !!activeProfile() && (!demo.autoplay || !!demo.record);
  const start = useProfile ? activeProfile()! : guestProfile();
  if (casino.buyInAmount(start.coins, stakes) === null) return pokerSetup();
  const affordable = (id: string) => casino.buyInAmount(casino.regularBalance(start, id), stakes) !== null;
  const chosen = prefs.opponents?.filter(affordable) ?? [];
  const ids = chosen.length > 0 ? chosen : new Rng(seed ^ 0x9e1).shuffle(CHARACTERS.map((c) => c.id).filter(affordable)).slice(0, 3);
  const seated = casino.sitDown(start, prefs.stakes, ids, new Date().toISOString());
  const t0 = seated.casino.pokerTable!;
  const opponents = ids.filter((id) => t0.regulars[id] !== undefined).map((id) => characterById(id)!);
  const { bank } = pokerBank(useProfile, stakes, seated);
  if (useProfile) replaceProfile(seated);
  const t = new PokerTable(stage, {
    stakes,
    chips: [t0.you, ...opponents.map((c) => t0.regulars[c.id]!)],
    bank,
    difficulty: prefs.difficulty,
    opponents,
    seed,
    autoplay: demo.autoplay,
    speed: demo.speed,
    getSettings: activeSettings,
    onExit: (next) => (next === 'again' ? pokerSetup() : menu()),
  });
  table = t;
  void t.run();
}

/** Record a finished game for the active player and return the award to show (D-050). */
function recordResult(settings: Settings, opponents: readonly dialogue.CharacterDef[], g: HeartsGameResult): ReturnType<typeof profile.recordHeartsGame> | null {
  const p = activeProfile();
  if (!p) return null;
  const r = profile.recordHeartsGame(p, { ...g, difficulty: settings.difficulty }, new Date().toISOString());
  replaceProfile(r.profile);
  settleRegulars(casino.heartsCredits(g.finalScores, opponents.map((c) => c.id), settings.difficulty));
  return { ...r, profile: activeProfile()! };
}

function play(settings: Settings, demo: { seed?: number; autoplay?: boolean; speed?: number; record?: boolean } = {}): void {
  table?.destroy();
  stage.clear();
  const seed = demo.seed ?? (Date.now() >>> 0);
  const opponents = pickOpponents(settings, seed);
  table = new HeartsTable(stage, {
    ruleSet: settings.ruleSet,
    difficulty: settings.difficulty,
    opponents,
    seed,
    autoplay: demo.autoplay,
    speed: demo.speed,
    getSettings: activeSettings,
    // A computer-played demo game never counts for the player, unless explicitly asked (screenshots).
    onGameFinished: (g) => (demo.autoplay && !demo.record ? null : recordResult(settings, opponents, g)),
    onExit: (next) => (next === 'again' ? play(settings) : menu()),
  });
  void table.run();
}

const hash = new URLSearchParams(location.hash.slice(1));

/** Show the active player's table felt (spec 16 §6), and follow changes to it. */
function followTableFelt(): void {
  const override = hash.get('felt');
  const show = () => (document.documentElement.dataset['felt'] = override ?? activeSettings().tableFelt);
  show();
  onProfilesChanged(show);
}

async function start(): Promise<void> {
  await loadProfiles();
  followTableFelt();
  if (hash.has('setup')) return setup();
  if (hash.has('spades-setup')) return spadesSetup();
  if (hash.has('spades')) {
    const target = hash.get('target') === '500' ? 500 : 300;
    return playSpades(
      { ...spadesPrefs(), targetScore: target },
      { seed: Number(hash.get('seed') ?? 1), autoplay: hash.has('autoplay'), speed: Number(hash.get('speed') ?? 1), record: hash.has('record') },
    );
  }
  for (const game of ['gin', 'rummy500'] as const) {
    if (hash.has(`${game}-setup`)) return twoPlayerSetup(game);
    if (hash.has(game)) {
      return playTwoPlayer(game, twoPlayerPrefs(game), {
        seed: Number(hash.get('seed') ?? 1),
        autoplay: hash.has('autoplay'),
        speed: Number(hash.get('speed') ?? 1),
        record: hash.has('record'),
      });
    }
  }
  if (hash.has('poker-setup')) return pokerSetup();
  if (hash.has('poker')) {
    const stakes = hash.get('stakes');
    return playPoker(
      { ...pokerPrefs(), stakes: stakes === 'medium' || stakes === 'high' ? stakes : 'low' },
      { seed: Number(hash.get('seed') ?? 1), autoplay: hash.has('autoplay'), speed: Number(hash.get('speed') ?? 1), record: hash.has('record') },
    );
  }
  if (hash.has('welcome')) return welcome();
  if (hash.has('who')) return whoIsPlaying();
  if (hash.has('stats')) {
    statsPage();
    if (hash.has('regulars')) document.querySelectorAll<HTMLElement>('.stats-section:last-child .stats-tabs button')[1]?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    return;
  }
  if (hash.has('about')) {
    aboutPage();
    if (hash.has('licenses')) document.querySelectorAll('.about-tabs button')[1]?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    return;
  }
  if (hash.has('settings')) {
    menu();
    document.querySelectorAll('.menu-footer button')[1]?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    return;
  }
  if (hash.has('sound')) {
    menu();
    document.querySelector('.menu-footer button')?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    if (hash.has('tracks')) document.querySelector('.track-button')?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    return;
  }
  if (hash.has('hearts')) {
    return play(
      { ...loadSettings(), ...(activeProfile()?.prefs.hearts ?? {}) },
      { seed: Number(hash.get('seed') ?? 1), autoplay: hash.has('autoplay'), speed: Number(hash.get('speed') ?? 1), record: hash.has('record') },
    );
  }
  // Normal launch (D-049): first run asks for a name; several players get the picker.
  if (allProfiles().length === 0) welcome();
  else if (allProfiles().length > 1) whoIsPlaying();
  else menu();
}
void start();
