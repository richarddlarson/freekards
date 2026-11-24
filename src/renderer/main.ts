/**
 * Renderer entry point. Currently a placeholder title screen; it also proves that the
 * engine-neutral logic layer bundles into the renderer.
 */
import { hearts } from '../logic/index.js';

interface FreeKardsBridge {
  platform: string;
  versions: { electron: string; chrome: string };
}

declare global {
  interface Window {
    freekards?: FreeKardsBridge;
  }
}

// Native-app feel: suppress the browser context menu and pinch/ctrl-wheel zoom.
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

const status = document.getElementById('status');
if (status) {
  const game = hearts.createHeartsGame({ ruleSet: 'standard', seed: Date.now() >>> 0 });
  const bridge = window.freekards;
  const runtime = bridge ? `Electron ${bridge.versions.electron} · ${bridge.platform}` : 'browser preview';
  status.textContent = `Hearts engine ready (phase: ${game.phase}) — ${runtime}`;
}
