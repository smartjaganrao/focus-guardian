const { contextBridge, ipcRenderer } = require('electron');

// Track listeners so re-registering a channel doesn't leak handlers.
const listeners = new Map();
function registerListener(channel, callback) {
  if (listeners.has(channel)) ipcRenderer.off(channel, listeners.get(channel));
  const handler = (_, d) => callback(d);
  ipcRenderer.on(channel, handler);
  listeners.set(channel, handler);
  return () => { ipcRenderer.off(channel, handler); listeners.delete(channel); };
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Focus Guardian: active-window watcher + escalating overlay modes ──
  focusWatchStart: () => ipcRenderer.send('focus-watch-start'),
  focusWatchStop:  () => ipcRenderer.send('focus-watch-stop'),
  onActiveWindow:  (cb) => registerListener('focus-active-window', cb),
  setOverlayMode:  (mode) => ipcRenderer.send('focus-set-overlay-mode', { mode }),
  activateApp:     (app) => ipcRenderer.send('focus-activate-app', { app }),

  // ── Settings: Groq API key lives in main-process userData, never here ──
  settingsGet: () => ipcRenderer.invoke('settings-get'),       // { hasKey: boolean }
  settingsSetKey: (key) => ipcRenderer.invoke('settings-set-key', { key }),

  // ── Groq streaming — key stays in main, chunks arrive over IPC ──
  groqStream: (options, onChunk) => {
    const streamId = Math.random().toString(36).slice(2, 10);
    const channel = `groq-chunk-${streamId}`;
    return new Promise((resolve, reject) => {
      const handler = (_, { content, done, error, totalTokens }) => {
        if (done) {
          ipcRenderer.removeListener(channel, handler);
          if (error) reject(new Error(error));
          else resolve({ totalTokens: totalTokens || 0 });
        } else if (content) {
          onChunk(content);
        }
      };
      ipcRenderer.on(channel, handler);
      ipcRenderer.invoke('groq-stream', { streamId, ...options }).catch((err) => {
        ipcRenderer.removeListener(channel, handler);
        reject(err);
      });
    });
  },

  // ── Window chrome ──
  windowHide: () => ipcRenderer.send('win-hide'),
  windowQuit: () => ipcRenderer.send('win-quit'),
  windowSetCompact: (compact) => ipcRenderer.send('win-compact', { compact }),

  openExternal: (url) => ipcRenderer.send('open-external', url),
});
