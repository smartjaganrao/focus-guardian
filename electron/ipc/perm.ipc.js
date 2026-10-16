// macOS permission backbone for a smooth, guided onboarding.
//  • Accessibility — required to read the foreground window title.
//  • Automation (Apple Events → System Events) — required to switch you back.
// We can't grant these for the user (TCC is OS-controlled), but we can trigger
// the prompts, deep-link to the exact settings pane, and live-detect the state.
import { ipcMain, systemPreferences, shell } from 'electron';
import { execFile } from 'child_process';

// Probe Automation by asking System Events something harmless. The first call
// triggers the consent dialog; later calls just report granted/denied.
function checkAutomation() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve('granted');
    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to return name of first process'],
      { timeout: 2500 },
      (err) => {
        if (!err) return resolve('granted');
        const denied = /not allowed|-1743|errAEPrivilege|assistive/i.test(err.message || '');
        resolve(denied ? 'denied' : 'unknown');
      },
    );
  });
}

function hasAccessibility(prompt) {
  if (process.platform !== 'darwin') return true;
  try { return systemPreferences.isTrustedAccessibilityClient(!!prompt); }
  catch { return false; }
}

export function registerPermHandlers() {
  ipcMain.handle('perm-get', async () => ({
    platform: process.platform,
    accessibility: hasAccessibility(false),
    automation: await checkAutomation(),
  }));

  // Trigger the native Accessibility prompt (no-op if already granted).
  ipcMain.handle('perm-request-accessibility', async () => ({ accessibility: hasAccessibility(true) }));

  // Running the probe triggers the Automation consent dialog on first use.
  ipcMain.handle('perm-request-automation', async () => ({ automation: await checkAutomation() }));

  // Deep-link straight to the relevant Privacy pane.
  ipcMain.on('perm-open', (_, { which }) => {
    const url = which === 'automation'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
    shell.openExternal(url).catch(() => {});
  });
}
