/**
 * Renderer entry point: screen flow (spec 12 §1).
 * Demo hashes for development screenshots (scripts/capture.cjs):
 *   #setup                         the Hearts setup screen
 *   #sound                         the main menu with the Sound panel open
 *   #hearts&seed=7&autoplay&speed=3  a Hearts game with fixed seed, optionally self-playing
 */
import type { dialogue } from '../logic/index.js';
import { Rng } from '../logic/index.js';
import { CHARACTERS, characterById } from './content.js';
import { showHeartsSetup, showMainMenu } from './screens.js';
import { loadSettings, saveSettings, type Settings } from './settings.js';
import { Stage } from './stage.js';
import { audio } from './audio.js';
import { HeartsTable } from './table/hearts-table.js';

// Native-app feel: no browser context menu, no ctrl+wheel zoom (spec runtimes/electron.md).
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

const stage = new Stage(document.getElementById('app')!);
audio.setVolumes(loadSettings().volumes);
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
  showMainMenu(stage, { playHearts: setup, quit: () => window.close() });
}

function setup(): void {
  showHeartsSetup(stage, loadSettings(), {
    back: menu,
    start: (s) => {
      saveSettings(s);
      play(s);
    },
  });
}

function play(settings: Settings, demo: { seed?: number; autoplay?: boolean; speed?: number } = {}): void {
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
    onExit: (next) => (next === 'again' ? play(settings) : menu()),
  });
  void table.run();
}

const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has('setup')) setup();
else if (hash.has('sound')) {
  menu();
  document.querySelector('.menu-footer button')?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
}
else if (hash.has('hearts')) {
  play(loadSettings(), {
    seed: Number(hash.get('seed') ?? 1),
    autoplay: hash.has('autoplay'),
    speed: Number(hash.get('speed') ?? 1),
  });
} else menu();
