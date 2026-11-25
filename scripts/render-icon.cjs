/**
 * Renders build/icon.svg to build/icon.png (1024×1024, transparent corners) in a hidden Electron
 * window (D-067), plus the Linux icon set build/icons/<n>x<n>.png. electron-builder makes the Windows
 * .ico from icon.png. Linux needs the separate sizes because the hicolor icon theme on Debian and Mint
 * has no 1024×1024 folder, so a desktop entry with only a 1024 px icon falls back to a generic one.
 *
 *   npx electron scripts/render-icon.cjs      (run through `npm run icon`; commit the result)
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SIZE = 1024;
const svgFile = path.join(__dirname, '..', 'build', 'icon.svg');
const pngFile = path.join(__dirname, '..', 'build', 'icon.png');
const linuxDir = path.join(__dirname, '..', 'build', 'icons');
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    useContentSize: true,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true },
  });
  const svg = fs.readFileSync(svgFile, 'utf8');
  const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 500));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  fs.writeFileSync(pngFile, image.toPNG());
  console.log(`saved ${path.relative(process.cwd(), pngFile)} (${image.getSize().width}x${image.getSize().height})`);
  fs.mkdirSync(linuxDir, { recursive: true });
  for (const n of LINUX_SIZES) {
    fs.writeFileSync(path.join(linuxDir, `${n}x${n}.png`), image.resize({ width: n, height: n, quality: 'best' }).toPNG());
  }
  console.log(`saved ${path.relative(process.cwd(), linuxDir)}/ (${LINUX_SIZES.join(', ')} px)`);
  app.quit();
});
