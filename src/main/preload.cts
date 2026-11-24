/**
 * Preload bridge (spec runtimes/electron.md §Process model).
 * Exposes a minimal, explicit API to the renderer. Saving and loading settings, saves and
 * statistics will be added here; for now it exposes only app metadata.
 */
import { contextBridge } from 'electron';

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions['electron'] ?? '',
    chrome: process.versions['chrome'] ?? '',
  },
} as const;

contextBridge.exposeInMainWorld('freekards', api);

export type FreeKardsBridge = typeof api;
