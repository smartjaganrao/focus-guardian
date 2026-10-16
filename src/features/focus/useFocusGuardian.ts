import { useEffect } from 'react';
import { useFocusStore, type EscalationLevel } from '../../store/focus.store';
import { classifyActivity, generateNudge } from '../../services/ai/focus-prompts';
import { toast } from '../../store/toasts.store';

// Aggressive: a short leash. Seconds of *continuous* off-task time per tier.
const GRACE_SEC = 5;    // → level 1: warn + auto-return to the task app
const EXPAND_SEC = 12;  // → level 2: expanded overlay (only if return failed)
const BLOCK_SEC = 20;   // → level 3: full-screen block (last resort)
// How long the warning shows before we yank the user back.
const RETURN_DELAY_MS = 1500;
// Past this idle time we assume the user stepped away — never nag.
const IDLE_AWAY_SEC = 90;

// Single-instance engine state (the guardian hook is mounted once, in App).
let driftStartedAt: number | null = null;
let classifyBusy = false;
let permissionWarned = false;
let returnScheduled = false;

function elapsedToLevel(ms: number): EscalationLevel {
  const s = ms / 1000;
  if (s >= BLOCK_SEC) return 3;
  if (s >= EXPAND_SEC) return 2;
  if (s >= GRACE_SEC) return 1;
  return 0;
}

function overlayForLevel(level: EscalationLevel): 'normal' | 'expanded' | 'fullscreen' {
  if (level >= 3) return 'fullscreen';
  if (level === 2) return 'expanded';
  return 'normal';
}

/** End the current drift streak. Logs it as a distraction unless suppressed. */
function endDrift(logIt: boolean) {
  const st = useFocusStore.getState();
  if (driftStartedAt && logIt && st.driftingApp) {
    st.addDistraction({
      app: st.driftingApp,
      title: st.driftingTitle ?? '',
      at: driftStartedAt,
      durationMs: Date.now() - driftStartedAt,
    });
  }
  driftStartedAt = null;
  returnScheduled = false;
  if (st.escalationLevel !== 0 || st.driftingApp) {
    st.setDrifting(null, null);
    st.setDriftStart(null);
    st.setEscalation(0);
    window.electronAPI?.setOverlayMode('normal');
  }
}

// Aggressive auto-return: after a brief warning, force the task app back to the
// foreground. Guarded so only one return is scheduled per drift streak.
function scheduleReturn() {
  if (returnScheduled) return;
  returnScheduled = true;
  const streak = driftStartedAt;
  setTimeout(() => {
    returnScheduled = false;
    const s = useFocusStore.getState();
    // Bail if the streak ended, the session stopped, or we're on a break.
    if (s.status === 'idle' || s.onBreak) return;
    if (driftStartedAt === null || driftStartedAt !== streak) return;
    if (s.anchorApp) window.electronAPI?.activateApp(s.anchorApp);
  }, RETURN_DELAY_MS);
}

// ── Actions used by the nudge UI ────────────────────────────────────────────
export function returnToTask() {
  endDrift(true);
  useFocusStore.getState().setStatus('focused');
}

export function allowDriftingApp() {
  const app = useFocusStore.getState().driftingApp;
  if (app) useFocusStore.getState().addAllowedApp(app);
  endDrift(false); // it's now part of the task — don't count it
}

export function takeBreak(mins: number) {
  endDrift(false);
  useFocusStore.getState().startBreak(mins);
  window.electronAPI?.setOverlayMode('normal');
}

/**
 * The Focus Guardian engine. Mount once near the app root. Subscribes to
 * main-process active-window samples and drives the escalation state machine.
 */
export function useFocusGuardian() {
  useEffect(() => {
    if (!window.electronAPI?.onActiveWindow) return;

    const unsub = window.electronAPI.onActiveWindow(async (data) => {
      const st = useFocusStore.getState();
      if (st.status === 'idle') return; // no active session

      // Break handling
      if (st.onBreak) {
        if (st.breakUntil && Date.now() > st.breakUntil) st.endBreak();
        else return;
      }

      // Permission not granted yet → tell the user once, then stop nagging.
      if (data.permissionDenied) {
        if (!permissionWarned) {
          permissionWarned = true;
          toast.warning(
            'Focus Guardian needs Accessibility access',
            'System Settings → Privacy & Security → Accessibility → enable this app.',
            'focus-permission',
          );
        }
        return;
      }

      // Stepped away from the keyboard — not a distraction.
      if (data.idleSeconds > IDLE_AWAY_SEC) { endDrift(false); return; }

      // Our own overlay or an unknown foreground app → neutral (don't anchor).
      if (data.isOwnApp || !data.app) { endDrift(false); return; }

      // Seed the task app: the first real app you work in after starting
      // becomes the anchor we return you to. Works with no AI key at all.
      if (!st.anchorApp) { st.setAnchorApp(data.app); endDrift(true); return; }

      // On-task: the task app itself, or an app you've marked as belonging.
      if (data.app === st.anchorApp || st.allowlist.includes(data.app)) { endDrift(true); return; }

      // Anything else is a candidate distraction. If an AI key is configured,
      // let the model rescue clearly-related apps (docs, reference, etc.);
      // otherwise (and on UNSURE) we stay aggressive and treat it as off-task.
      if (classifyBusy) return;
      classifyBusy = true;
      let verdict;
      try {
        verdict = await classifyActivity(st.currentTask, data.app, data.title ?? '');
      } finally {
        classifyBusy = false;
      }

      // Re-read state — the foreground may have changed during the await.
      const cur = useFocusStore.getState();
      if (cur.status === 'idle' || cur.onBreak) return;
      // Foreground moved on while we were classifying — re-evaluate next tick.
      if (cur.anchorApp && data.app === cur.anchorApp) { endDrift(true); return; }

      if (verdict === 'RELATED') {
        // A genuine task-related app — allow it for the rest of the session.
        cur.addAllowedApp(data.app);
        endDrift(true);
        return;
      }

      // ── Confirmed off-task ──────────────────────────────────────────────
      if (driftStartedAt === null) { driftStartedAt = Date.now(); cur.setDriftStart(driftStartedAt); }
      cur.setDrifting(data.app, data.title ?? '');

      const elapsed = Date.now() - driftStartedAt;
      const targetLevel = elapsedToLevel(elapsed);
      if (targetLevel === 0 || targetLevel <= cur.escalationLevel) return;

      // Crossed a new tier — escalate.
      window.electronAPI?.setOverlayMode(overlayForLevel(targetLevel));

      if (cur.escalationLevel === 0) {
        // First nudge of this streak — generate a personal line.
        const nudge = await generateNudge(cur.currentTask, data.app, data.title ?? '');
        const latest = useFocusStore.getState();
        if (latest.status === 'idle' || latest.onBreak || driftStartedAt === null) return;
        latest.setEscalation(targetLevel, nudge);
        // Aggressive: warn briefly, then yank back to the task app.
        scheduleReturn();
      } else {
        cur.setEscalation(targetLevel);
      }
    });

    return () => { unsub?.(); };
  }, []);
}
