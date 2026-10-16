import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FocusStatus = 'idle' | 'focused' | 'drifting' | 'blocked';

/** A single confirmed diversion, logged when the user returns to task. */
export interface Distraction {
  app: string;
  title: string;
  at: number;        // when the drift started
  durationMs: number;
}

/** A stray thought captured so the user can let it go and stay on task. */
export interface ParkedThought {
  id: string;
  text: string;
  at: number;
}

// 0 = on task, 1 = gentle toast, 2 = expanded overlay, 3 = full-screen block.
export type EscalationLevel = 0 | 1 | 2 | 3;

/** A completed session, kept for the streak/history display. */
export interface SessionRecord {
  id: string;
  task: string;
  startedAt: number;
  endedAt: number;
  score: number;        // % of time on-task
  diverts: number;
}

interface FocusState {
  currentTask: string;
  timeBoxMins: number;
  startedAt: number | null;
  status: FocusStatus;
  /** App names the user has marked as part of the current task. */
  allowlist: string[];
  distractions: Distraction[];
  parked: ParkedThought[];
  escalationLevel: EscalationLevel;
  currentNudge: string;
  driftingApp: string | null;
  driftingTitle: string | null;
  /** When the current off-task streak began (for the live nudge counter). */
  driftStartedAt: number | null;
  /** The on-task app to yank the user back to (aggressive auto-return). */
  anchorApp: string | null;
  /** Planned break — suppresses nudges until it ends. */
  onBreak: boolean;
  breakUntil: number | null;
  /** Completed sessions (persisted). */
  history: SessionRecord[];
  /** Collapsed pill mode (UI only, not persisted). */
  isPill: boolean;

  setCurrentTask: (task: string) => void;
  setTimeBox: (mins: number) => void;
  startSession: () => void;
  endSession: () => void;
  setStatus: (s: FocusStatus) => void;
  addAllowedApp: (app: string) => void;
  addDistraction: (d: Distraction) => void;
  setEscalation: (level: EscalationLevel, nudge?: string) => void;
  setDrifting: (app: string | null, title: string | null) => void;
  setDriftStart: (ts: number | null) => void;
  setAnchorApp: (app: string | null) => void;
  park: (text: string) => void;
  removeParked: (id: string) => void;
  startBreak: (mins: number) => void;
  endBreak: () => void;
  addSession: (r: SessionRecord) => void;
  setPill: (v: boolean) => void;
  reset: () => void;
}

const initial = {
  currentTask: '',
  timeBoxMins: 25,
  startedAt: null as number | null,
  status: 'idle' as FocusStatus,
  allowlist: [] as string[],
  distractions: [] as Distraction[],
  parked: [] as ParkedThought[],
  escalationLevel: 0 as EscalationLevel,
  currentNudge: '',
  driftingApp: null as string | null,
  driftingTitle: null as string | null,
  driftStartedAt: null as number | null,
  anchorApp: null as string | null,
  onBreak: false,
  breakUntil: null as number | null,
  history: [] as SessionRecord[],
  isPill: false,
};

export const useFocusStore = create<FocusState>()(persist((set, get) => ({
  ...initial,

  setCurrentTask: (currentTask) => set({ currentTask }),
  setTimeBox: (timeBoxMins) => set({ timeBoxMins }),

  startSession: () => set({
    startedAt: Date.now(),
    status: 'focused',
    distractions: [],
    escalationLevel: 0,
    currentNudge: '',
    driftingApp: null,
    driftingTitle: null,
    driftStartedAt: null,
    anchorApp: null,
    onBreak: false,
    breakUntil: null,
  }),

  // Keeps the report data (distractions, startedAt) intact for display; the
  // FocusPanel reads them, then calls reset() when the user dismisses it.
  endSession: () => set({
    status: 'idle',
    escalationLevel: 0,
    currentNudge: '',
    driftingApp: null,
    driftingTitle: null,
    onBreak: false,
    breakUntil: null,
  }),

  setStatus: (status) => set({ status }),

  addAllowedApp: (app) => set((s) =>
    !app || s.allowlist.includes(app) ? s : { allowlist: [...s.allowlist, app] }),

  addDistraction: (d) => set((s) => ({ distractions: [...s.distractions, d] })),

  setEscalation: (escalationLevel, nudge) =>
    set((s) => ({
      escalationLevel,
      currentNudge: nudge ?? s.currentNudge,
      status: escalationLevel > 0 ? (escalationLevel >= 3 ? 'blocked' : 'drifting') : 'focused',
    })),

  setDrifting: (driftingApp, driftingTitle) => set({ driftingApp, driftingTitle }),

  setDriftStart: (driftStartedAt) => set({ driftStartedAt }),

  setAnchorApp: (anchorApp) => set({ anchorApp }),

  park: (text) => set((s) => text.trim()
    ? { parked: [{ id: `p${Date.now()}`, text: text.trim(), at: Date.now() }, ...s.parked] }
    : s),

  removeParked: (id) => set((s) => ({ parked: s.parked.filter((p) => p.id !== id) })),

  startBreak: (mins) => set({
    onBreak: true,
    breakUntil: Date.now() + mins * 60_000,
    escalationLevel: 0,
    status: 'focused',
  }),

  endBreak: () => set({ onBreak: false, breakUntil: null }),

  addSession: (r) => set((s) => ({ history: [r, ...s.history].slice(0, 100) })),

  setPill: (isPill) => set({ isPill }),

  // Reset live session fields but keep what should persist across sessions.
  reset: () => set({ ...initial, allowlist: get().allowlist, history: get().history }),
}), {
  name: 'focus-guardian',
  // Persist only the learned allowlist + completed session history.
  // Live session state (status, timers, escalation, pill) always starts fresh.
  partialize: (s) => ({ allowlist: s.allowlist, history: s.history }),
}));
