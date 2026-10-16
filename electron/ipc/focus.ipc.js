// IPC handlers for Focus Guardian: active-window polling, idle time, and
// escalating overlay window modes.
//
// Active-window detection uses macOS `osascript` (System Events) so we ship
// ZERO native dependencies — important because this project's node_modules
// are not always rebuilt per-platform. Reading the front window *title*
// requires Accessibility permission; the app name alone usually does not.
// On non-darwin platforms the poller degrades gracefully (app/title null) —
// a native module (get-windows) can be slotted in later behind getActiveWindow().
import { ipcMain, powerMonitor, screen } from 'electron';
import { execFile } from 'child_process';

const POLL_MS = 2000;

// AppleScript: front app name + front window title, joined by a sentinel.
const OSA_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set winTitle to ""
  try
    set winTitle to name of front window of frontApp
  end try
end tell
return appName & "|||" & winTitle
`;

function getActiveWindowMac() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ app: null, title: null, supported: false });
      return;
    }
    execFile('osascript', ['-e', OSA_SCRIPT], { timeout: 2500 }, (err, stdout) => {
      if (err) {
        // errAuthorizationDenied / -1743 ⇒ Accessibility not granted yet.
        const denied = /not allowed|assistive|-1743|errAEPrivilege/i.test(err.message || '');
        resolve({ app: null, title: null, supported: true, permissionDenied: denied });
        return;
      }
      const raw = (stdout || '').trim();
      const [app, title = ''] = raw.split('|||');
      resolve({ app: app || null, title: title || null, supported: true });
    });
  });
}

export function registerFocusHandlers(mainWindow, { ownAppNames = ['Electron', 'JavihAI', 'AI Interview Helper'] } = {}) {
  let pollTimer = null;
  let originalBounds = null; // saved before entering a non-normal overlay mode

  async function tick() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const win = await getActiveWindowMac();
    const idleSeconds = (() => {
      try { return powerMonitor.getSystemIdleTime(); } catch { return 0; }
    })();
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('focus-active-window', {
      app: win.app,
      title: win.title,
      // The overlay itself stealing focus is not a distraction.
      isOwnApp: !!win.app && ownAppNames.some(n => win.app === n),
      idleSeconds,
      supported: win.supported !== false,
      permissionDenied: !!win.permissionDenied,
      ts: Date.now(),
    });
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  ipcMain.on('focus-watch-start', () => {
    stopPolling();
    tick(); // fire immediately so the UI doesn't wait a full interval
    pollTimer = setInterval(tick, POLL_MS);
  });

  ipcMain.on('focus-watch-stop', () => {
    stopPolling();
  });

  // Aggressive auto-return: force a given app back to the foreground.
  // Uses System Events so an already-running app is raised, not relaunched.
  ipcMain.on('focus-activate-app', (_, { app }) => {
    if (process.platform !== 'darwin' || !app) return;
    const script =
      `tell application "System Events" to set frontmost of ` +
      `(first process whose name is ${JSON.stringify(app)}) to true`;
    execFile('osascript', ['-e', script], { timeout: 2000 }, () => { /* best effort */ });
  });

  // Escalating overlay presentation. 'normal' restores the saved bounds.
  ipcMain.on('focus-set-overlay-mode', (_, { mode }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mode !== 'normal' && !originalBounds) {
      originalBounds = mainWindow.getBounds();
    }

    if (mode === 'normal') {
      if (originalBounds) { mainWindow.setBounds(originalBounds, true); originalBounds = null; }
      return;
    }

    // Make sure the nudge is actually seen.
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    mainWindow.focus();

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const wa = display.workArea;

    if (mode === 'expanded') {
      const w = 560, h = 360;
      mainWindow.setBounds({
        x: wa.x + Math.round((wa.width - w) / 2),
        y: wa.y + Math.round((wa.height - h) / 3),
        width: w, height: h,
      }, true);
    } else if (mode === 'fullscreen') {
      // Cover the active display to physically block the distraction.
      mainWindow.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height }, true);
    }
  });

  // Tear down with the window.
  mainWindow.on('closed', stopPolling);
}
