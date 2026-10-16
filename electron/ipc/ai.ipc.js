// Groq streaming + local settings (the API key never reaches the renderer).
// The key is stored in userData/config.json and read only here in main.
import { ipcMain, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import Groq from 'groq-sdk';

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    const p = configPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* ignore corrupt config */ }
  return {};
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  try { fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8'); } catch { /* ignore */ }
  return next;
}

export function registerAiHandlers() {
  ipcMain.handle('settings-get', () => {
    const cfg = readConfig();
    return { hasKey: !!cfg.groqApiKey };
  });

  ipcMain.handle('settings-set-key', (_, { key }) => {
    const trimmed = (key || '').trim();
    writeConfig({ groqApiKey: trimmed });
    return { ok: true, hasKey: !!trimmed };
  });

  ipcMain.on('open-external', (_, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
  });

  ipcMain.handle('groq-stream', async (e, { streamId, messages, model, temperature, maxTokens }) => {
    const channel = `groq-chunk-${streamId}`;
    const key = readConfig().groqApiKey;
    const send = (payload) => { if (!e.sender.isDestroyed()) e.sender.send(channel, payload); };

    if (!key) {
      send({ content: '', done: true, error: 'No Groq API key set. Add one in Settings.' });
      return { success: false };
    }

    try {
      const groq = new Groq({ apiKey: key });
      const stream = await groq.chat.completions.create({
        messages,
        model: model || 'llama-3.1-8b-instant',
        temperature: temperature ?? 0.5,
        max_tokens: maxTokens ?? 1024,
        stream: true,
        stream_options: { include_usage: true },
      });
      let totalTokens = 0;
      for await (const chunk of stream) {
        if (e.sender.isDestroyed()) break;
        const content = chunk.choices[0]?.delta?.content ?? '';
        if (content) send({ content, done: false });
        if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens;
      }
      send({ content: '', done: true, totalTokens });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      send({ content: '', done: true, error: msg });
      return { success: false };
    }
  });
}
