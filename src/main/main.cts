/**
 * Electron main process (spec runtimes/electron.md §Process model).
 * Responsibilities: create the window, app lifecycle, single-instance lock, the document store,
 * and opening the runtime's license notices for the Credits screen.
 * The game itself runs entirely in the renderer.
 */
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';

const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

/**
 * Internal identity (spec D-034). Brand-independent and permanent, so a product rename never
 * orphans settings or saves, or breaks Windows taskbar grouping and shortcuts.
 */
const APP_ID = 'io.github.richarddlarson.cardtable';
const DATA_FOLDER = 'cardtable';
app.setPath('userData', path.join(app.getPath('appData'), DATA_FOLDER));
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

/**
 * JSON document store (D-051): <userData>/data/<name>.json. Names are restricted to [a-z0-9-] so the
 * renderer can never reach other paths. Writes go to a temp file, the previous version is kept as
 * <name>.json.bak, and the temp file is renamed into place.
 */
const STORE_NAME = /^[a-z0-9-]{1,40}$/;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

function storePath(name: unknown): string {
  if (typeof name !== 'string' || !STORE_NAME.test(name)) throw new Error('invalid store name');
  return path.join(app.getPath('userData'), 'data', `${name}.json`);
}

function registerStore(): void {
  ipcMain.handle('store:read', async (_event, name: unknown) => {
    const file = storePath(name);
    for (const candidate of [file, `${file}.bak`]) {
      try {
        const text = await fs.readFile(candidate, 'utf8');
        JSON.parse(text); // fall back to the backup if the main file is damaged
        return text;
      } catch {
        /* missing or unreadable: try the next candidate */
      }
    }
    return null;
  });
  ipcMain.handle('store:write', async (_event, name: unknown, text: unknown) => {
    const file = storePath(name);
    if (typeof text !== 'string' || text.length > MAX_DOC_BYTES) throw new Error('invalid document');
    JSON.parse(text);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, text, 'utf8');
    await fs.copyFile(file, `${file}.bak`).catch(() => undefined);
    await fs.rename(tmp, file);
  });
}

/**
 * Runtime license notices (spec 09 §5, D-066). electron-builder copies Electron's LICENSE (renamed
 * LICENSE.electron.txt) and LICENSES.chromium.html next to the executable; in a development run they
 * sit next to the Electron binary under node_modules with the original names. Only these two files
 * can be opened, in the system's default viewer.
 */
const NOTICES: Record<string, readonly string[]> = {
  electron: ['LICENSE.electron.txt', 'LICENSE'],
  chromium: ['LICENSES.chromium.html'],
};

function registerNotices(): void {
  ipcMain.handle('credits:open-notice', async (_event, which: unknown) => {
    const names = typeof which === 'string' ? NOTICES[which] : undefined;
    if (!names) throw new Error('unknown notice');
    const dir = path.dirname(process.execPath);
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        await fs.access(file);
      } catch {
        continue;
      }
      const error = await shell.openPath(file);
      return error === '';
    }
    return false;
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'FreeKards',
    // Linux window icon for unpackaged runs; installed builds use the desktop entry's icon.
    ...(process.platform === 'linux' && !app.isPackaged ? { icon: path.join(__dirname, '..', 'build', 'icon.png') } : {}),
    backgroundColor: '#0b5d2a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // Never navigate away from the app or open new windows; external links go to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL)) return;
    event.preventDefault();
  });

  if (DEV_SERVER_URL) void win.loadURL(DEV_SERVER_URL);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // No application menu: the game provides its own in-window menus.
  Menu.setApplicationMenu(null);

  registerStore();
  registerNotices();

  void app.whenReady().then(() => {
    mainWindow = createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
