import { create } from 'zustand';

export type ToastKind = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** Optional sub-line for context (e.g. error code or hint). */
  detail?: string;
  /** Auto-dismiss after this many ms. 0 = sticky until user closes. */
  ttl: number;
  /** Optional click handler — e.g. "Retry" or "Open settings". */
  action?: { label: string; onClick: () => void };
  /** Coalescing key — second toast with same key replaces the first instead
   *  of stacking. Useful when a polling call keeps failing. */
  dedupeKey?: string;
}

interface ToastsState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'> & { ttl?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;
const nextId = () => `t${Date.now()}-${counter++}`;

export const useToastsStore = create<ToastsState>((set, get) => ({
  toasts: [],

  push: (t) => {
    const id = nextId();
    const ttl = t.ttl ?? (t.kind === 'error' ? 8000 : 4000);
    const toast: Toast = { ...t, id, ttl };

    set((s) => {
      // Coalesce by dedupeKey: drop any existing toast with the same key
      const filtered = t.dedupeKey
        ? s.toasts.filter((x) => x.dedupeKey !== t.dedupeKey)
        : s.toasts;
      return { toasts: [...filtered, toast] };
    });

    if (ttl > 0) {
      setTimeout(() => {
        // Only dismiss if the toast is still present (user may have dismissed already)
        if (get().toasts.some((x) => x.id === id)) get().dismiss(id);
      }, ttl);
    }

    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Convenience helpers so callers don't have to import the store. */
export const toast = {
  error: (message: string, detail?: string, dedupeKey?: string) =>
    useToastsStore.getState().push({ kind: 'error', message, detail, dedupeKey, ttl: 8000 }),
  warning: (message: string, detail?: string, dedupeKey?: string) =>
    useToastsStore.getState().push({ kind: 'warning', message, detail, dedupeKey, ttl: 5000 }),
  info: (message: string, detail?: string, dedupeKey?: string) =>
    useToastsStore.getState().push({ kind: 'info', message, detail, dedupeKey, ttl: 4000 }),
  success: (message: string, detail?: string, dedupeKey?: string) =>
    useToastsStore.getState().push({ kind: 'success', message, detail, dedupeKey, ttl: 3000 }),
};
