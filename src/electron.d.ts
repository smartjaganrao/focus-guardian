export interface ElectronAPI {
  // ── Focus Guardian ──────────────────────────────────────────────────────
  focusWatchStart: () => void;
  focusWatchStop: () => void;
  onActiveWindow: (cb: (data: {
    app: string | null;
    title: string | null;
    isOwnApp: boolean;
    idleSeconds: number;
    supported: boolean;
    permissionDenied: boolean;
    ts: number;
  }) => void) => (() => void) | undefined;
  setOverlayMode: (mode: 'normal' | 'expanded' | 'fullscreen') => void;
  /** Force a given app back to the foreground (aggressive auto-return). */
  activateApp: (app: string) => void;

  // ── Settings ────────────────────────────────────────────────────────────
  settingsGet: () => Promise<{ hasKey: boolean }>;
  settingsSetKey: (key: string) => Promise<{ ok: boolean; hasKey: boolean }>;

  // ── Groq streaming (key stays in main) ──────────────────────────────────
  groqStream: (
    options: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | unknown[] }>;
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
    onChunk: (chunk: string) => void,
  ) => Promise<{ totalTokens: number }>;

  // ── Window chrome ──────────────────────────────────────────────────────
  windowHide: () => void;
  windowQuit: () => void;
  windowSetCompact: (compact: boolean) => void;

  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
