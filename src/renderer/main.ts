/**
 * Renderer entry point: screen flow (spec 12 §1).
 * Demo hashes for development screenshots (scripts/capture.cjs):
 *   #setup                         the Hearts setup screen
 *   #sound[&tracks]                the main menu with the Sound panel open (and its track list)
 *   #settings                      the main menu with the Settings panel open
 *   #welcome / #who / #stats       first-run name entry, the player picker, the stats page
 *   #about[&licenses]              the About & Credits screen (on its Licenses tab)
 *   (add &record to a #hearts autoplay demo to record its result for the active player)
 *   #hearts&seed=7&autoplay&speed=3  a Hearts game with fixed seed, optionally self-playing
 */
import type { dialogue } from '../logic/index.js';
import { Rng } from '../logic/index.js';
import { CHARACTERS, characterById } from './content.js';
import { showHeartsSetup, showMainMenu } from './screens.js';
import { loadSettings, saveSettings, type Settings } from './settings.js';
import { Stage } from './stage.js';
import { audio } from './audio.js';
import { HeartsTable, type HeartsGameResult } from './table/hearts-table.js';
import { profile } from '../logic/index.js';
import { activeProfile, activeSettings, allProfiles, loadProfiles, replaceProfile } from './profiles.js';
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
let table: HeartsTable | null = null;

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
    { playHearts: setup, quit: () => window.close(), stats: statsPage, switchPlayer: whoIsPlaying, about: aboutPage },
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

/** Record a finished game for the active player and return the award to show (D-050). */
function recordResult(settings: Settings, g: HeartsGameResult): ReturnType<typeof profile.recordHeartsGame> | null {
  const p = activeProfile();
  if (!p) return null;
  const r = profile.recordHeartsGame(p, { ...g, difficulty: settings.difficulty }, new Date().toISOString());
  replaceProfile(r.profile);
  return r;
}

function play(settings: Settings, demo: { seed?: number; autoplay?: boolean; speed?: number; record?: boolean } = {}): void {
  table?.destroy();
  stage.clear();
  const seed = demo.seed ?? (Date.now() >>> 0);
  table = new HeartsTable(stage, {
    ruleSet: settings.ruleSet,
    difficulty: settings.difficulty,
    opponents: pickOpponents(settings, seed),
    seed,
    autoplay: demo.autoplay,
    speed: demo.speed,
    getSettings: activeSettings,
    // A computer-played demo game never counts for the player, unless explicitly asked (screenshots).
    onGameFinished: (g) => (demo.autoplay && !demo.record ? null : recordResult(settings, g)),
    onExit: (next) => (next === 'again' ? play(settings) : menu()),
  });
  void table.run();
}

const hash = new URLSearchParams(location.hash.slice(1));

async function start(): Promise<void> {
  await loadProfiles();
  if (hash.has('setup')) return setup();
  if (hash.has('welcome')) return welcome();
  if (hash.has('who')) return whoIsPlaying();
  if (hash.has('stats')) return statsPage();
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
