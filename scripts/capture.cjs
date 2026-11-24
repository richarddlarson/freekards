/**
 * Development tool: render a page in a hidden Electron window and save a PNG screenshot.
 * Used to check art and layout visually (spec runtimes/electron.md §Dev tools).
 *
 *   npx electron scripts/capture.cjs <url-or-file> <out.png> [width] [height] [waitMs[,waitMs...]] [scaleFactor]
 *
 * For the app itself, pass dist/renderer/index.html plus a hash such as "#demo=hearts-play".
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const [target, out, w = '1440', h = '960', wait = '1500', scale = '1'] = process.argv.slice(2);
if (!target || !out) {
  console.error('usage: electron scripts/capture.cjs <url-or-file> <out.png> [width] [height] [waitMs] [scaleFactor]');
  process.exit(2);
}
app.commandLine.appendSwitch('force-device-scale-factor', scale);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: Number(w),
    height: Number(h),
    show: false,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      offscreen: true, // render continuously at full frame rate without showing a window
    },
  });
  win.webContents.setFrameRate(60);
  let lastFrame = null;
  win.webContents.on('paint', (_event, _dirty, image) => {
    lastFrame = image;
  });
  win.webContents.on('console-message', (event) => {
    const { level, message } = event;
    console.log(`[renderer:${level}] ${message}`);
  });
  if (/^(https?|file):/.test(target)) await win.loadURL(target);
  else {
    const [file, hash] = target.split('#');
    await win.loadFile(path.resolve(file), hash ? { hash } : undefined);
  }
  // waitMs may be a comma-separated list of times (ms since load); one PNG per time: out-1.png, out-2.png, ...
  const times = String(wait).split(',').map(Number);
  const start = Date.now();
  for (const [i, t] of times.entries()) {
    await new Promise((r) => setTimeout(r, Math.max(0, start + t - Date.now())));
    const image = lastFrame ?? (await win.webContents.capturePage());
    const file = times.length === 1 ? out : out.replace(/\.png$/, `-${i + 1}.png`);
    fs.writeFileSync(file, image.toPNG());
    console.log(`saved ${file} (${image.getSize().width}x${image.getSize().height})`);
  }
  app.quit();
});
