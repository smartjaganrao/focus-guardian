// Focus Guardian — Electron main process (ESM).
// A small always-on-top overlay whose only job is to keep you on one task.
import { app, BrowserWindow, Tray, Menu, nativeImage, screen, globalShortcut, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { registerFocusHandlers } from './electron/ipc/focus.ipc.js';
import { registerAiHandlers } from './electron/ipc/ai.ipc.js';
import { registerPermHandlers } from './electron/ipc/perm.ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG = process.argv.includes('--fg-debug') || process.env.FG_DEBUG === '1';

let mainWindow = null;
let tray = null;
let localServer = null;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json',
};

// Serve the built dist/ over http so relative asset paths resolve in production.
function startLocalServer(distDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = '/index.html';
      try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { /* default */ }
      const rel = pathname.replace(/^\//, '') || 'index.html';
      const file = path.join(distDir, rel);
      const ext = path.extname(file).toLowerCase();
      try {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          fs.createReadStream(file).pipe(res);
          return;
        }
      } catch { /* fall through to index */ }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(distDir, 'index.html')).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => { localServer = server; resolve(server.address().port); });
  });
}

const NORMAL = { w: 380, h: 560 };
const PILL = { w: 320, h: 60 };
const MARGIN = 16;

// Keep the window pinned to the top-right of its current display.
function anchorTopRight(w, h) {
  if (!mainWindow) return;
  const wa = screen.getDisplayNearestPoint(mainWindow.getBounds()).workArea;
  mainWindow.setBounds({ x: wa.x + wa.width - w - MARGIN, y: wa.y + MARGIN, width: w, height: h }, true);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: NORMAL.w,
    height: NORMAL.h,
    show: false,
    frame: DEBUG,
    transparent: !DEBUG,
    backgroundColor: DEBUG ? '#16161a' : '#00000000',
    hasShadow: true,
    resizable: true,
    alwaysOnTop: !DEBUG,
    title: 'Focus Guardian',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  anchorTopRight(NORMAL.w, NORMAL.h);
  if (!DEBUG) mainWindow.setAlwaysOnTop(true, 'pop-up-menu');

  if (app.isPackaged) {
    const distDir = fs.existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : path.join(app.getAppPath(), 'dist');
    const port = await startLocalServer(distDir);
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.setMenu(null);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (DEBUG) { try { mainWindow.webContents.openDevTools({ mode: 'detach' }); } catch { /* noop */ } }
  });

  // Open external links in the default browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  registerFocusHandlers(mainWindow, { ownAppNames: ['Electron', 'Focus Guardian'] });
  registerAiHandlers();

  // Window chrome controls (frameless app provides its own).
  ipcMain.on('win-hide', () => mainWindow?.hide());
  ipcMain.on('win-quit', () => app.quit());
  ipcMain.on('win-compact', (_, { compact }) =>
    anchorTopRight(compact ? PILL.w : NORMAL.w, compact ? PILL.h : NORMAL.h));

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  let icon;
  try { icon = nativeImage.createFromPath(path.join(__dirname, 'public', 'tray-iconTemplate.png')); }
  catch { icon = nativeImage.createEmpty(); }
  if (!icon.isEmpty()) icon.setTemplateImage(true); // macOS recolors for menu bar
  tray = new Tray(icon);
  tray.setToolTip('Focus Guardian');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Show', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Hide', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', () => { if (mainWindow?.isVisible()) mainWindow.hide(); else { mainWindow?.show(); mainWindow?.focus(); } });
}

app.whenReady().then(async () => {
  await createWindow();
  createTray();
  globalShortcut.register('Alt+F', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (localServer) { try { localServer.close(); } catch { /* noop */ } }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
