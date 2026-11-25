/**
 * Preload bridge (spec runtimes/electron.md §Process model).
 * Exposes a minimal, explicit API to the renderer: app metadata, a tiny JSON document store
 * (profiles and statistics, D-051), and opening the runtime's license notices (D-066). Nothing else
 * from Node or Electron reaches the page.
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions['electron'] ?? '',
    chrome: process.versions['chrome'] ?? '',
  },
  store: {
    /** Read a named JSON document; resolves to null if it does not exist. */
    read: (name: string): Promise<string | null> => ipcRenderer.invoke('store:read', name),
    /** Write a named JSON document atomically. */
    write: (name: string, text: string): Promise<void> => ipcRenderer.invoke('store:write', name, text),
  },
  credits: {
    /** Open Electron's or Chromium's license notice in the system viewer; resolves to false if missing. */
    openNotice: (which: 'electron' | 'chromium'): Promise<boolean> => ipcRenderer.invoke('credits:open-notice', which),
  },
} as const;

contextBridge.exposeInMainWorld('freekards', api);

export type FreeKardsBridge = typeof api;
