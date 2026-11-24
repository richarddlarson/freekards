/**
 * Preload bridge (spec runtimes/electron.md §Process model).
 * Exposes a minimal, explicit API to the renderer: app metadata and a tiny JSON document store
 * (profiles and statistics, D-051). Nothing else from Node or Electron reaches the page.
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
} as const;

contextBridge.exposeInMainWorld('freekards', api);

export type FreeKardsBridge = typeof api;
