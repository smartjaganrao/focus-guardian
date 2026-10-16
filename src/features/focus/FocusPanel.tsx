import { useState, useEffect, useMemo } from 'react';
import { useFocusStore, type Distraction } from '../../store/focus.store';
import { takeBreak } from './useFocusGuardian';
import { fmtDuration } from '../../lib/format';
import './focus.css';

const TIME_BOXES = [15, 25, 45, 60, 90];

/** Focus score = share of session time spent on-task. */
function focusScore(startedAt: number, endedAt: number, distractions: Distraction[]): number {
  const total = endedAt - startedAt;
  if (total <= 0) return 100;
  const drifted = distractions.reduce((a, d) => a + d.durationMs, 0);
  return Math.max(0, Math.round((1 - drifted / total) * 100));
}

export default function FocusPanel() {
  const {
    currentTask, timeBoxMins, startedAt, status, allowlist, distractions, parked,
    driftingApp, driftStartedAt, anchorApp, onBreak, breakUntil, history,
    setCurrentTask, setTimeBox, startSession, endSession, reset,
    addAllowedApp, setAnchorApp, park, removeParked, endBreak, addSession, setPill,
  } = useFocusStore();

  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [parkText, setParkText] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [report, setReport] = useState<null | {
    task: string; startedAt: number; endedAt: number; distractions: Distraction[];
  }>(null);
  const [now, setNow] = useState(Date.now());

  const running = status !== 'idle' && startedAt !== null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = () => {
    setShowMore(false);
    setPill(false);
    window.electronAPI?.windowSetCompact(false);
    startSession();
    window.electronAPI?.focusWatchStart();
  };

  const handleEnd = () => {
    const endedAt = Date.now();
    const start = startedAt ?? endedAt;
    const score = focusScore(start, endedAt, distractions);
    addSession({
      id: `s${endedAt}`,
      task: currentTask,
      startedAt: start,
      endedAt,
      score,
      diverts: distractions.length,
    });
    setReport({ task: currentTask, startedAt: start, endedAt, distractions: [...distractions] });
    window.electronAPI?.focusWatchStop();
    window.electronAPI?.setOverlayMode('normal');
    setPill(false);
    window.electronAPI?.windowSetCompact(false);
    endSession();
  };

  const score = useMemo(
    () => report ? focusScore(report.startedAt, report.endedAt, report.distractions) : 0,
    [report],
  );

  // ── Report ────────────────────────────────────────────────────────────────
  if (report) {
    const drifted = report.distractions.reduce((a, d) => a + d.durationMs, 0);
    return (
      <div className="fg-panel fg-center">
        <p className="fg-eyebrow">Session complete</p>
        <div className={`fg-bigscore ${score >= 80 ? 'good' : score >= 50 ? 'ok' : 'low'}`}>{score}%</div>
        <p className="fg-sub">on task · {report.task || 'your task'}</p>
        <p className="fg-sub">
          {fmtDuration(report.endedAt - report.startedAt)} focused ·{' '}
          {report.distractions.length} divert{report.distractions.length === 1 ? '' : 's'} ·{' '}
          {fmtDuration(drifted)} lost
        </p>
        {report.distractions.length > 0 && (
          <ul className="fg-report-list">
            {report.distractions.slice(0, 6).map((d, i) => (
              <li key={i}>{d.app}{d.title ? ` — ${d.title}` : ''} ({fmtDuration(d.durationMs)})</li>
            ))}
          </ul>
        )}
        <button className="fg-btn fg-btn--primary fg-btn--block" onClick={() => { setReport(null); reset(); }}>
          New focus session
        </button>
      </div>
    );
  }

  // ── Running (goal-centric) ──────────────────────────────────────────────────
  if (running) {
    const elapsed = now - (startedAt ?? now);
    const boxMs = timeBoxMins * 60_000;
    const progress = Math.min(100, (elapsed / boxMs) * 100);
    // Live focus score, including any drift in progress right now.
    const driftedNow = distractions.reduce((a, d) => a + d.durationMs, 0)
      + (driftStartedAt ? now - driftStartedAt : 0);
    const liveScore = elapsed > 0 ? Math.max(0, Math.round((1 - driftedNow / elapsed) * 100)) : 100;
    const scoreClass = liveScore >= 80 ? 'good' : liveScore >= 50 ? 'ok' : 'low';
    const breakLeft = onBreak && breakUntil ? breakUntil - now : 0;
    const statusClass =
      onBreak ? 'fg-status--focused'
      : status === 'blocked' ? 'fg-status--blocked'
      : status === 'drifting' ? 'fg-status--drifting'
      : 'fg-status--focused';
    const statusLabel = onBreak ? 'On break' : status === 'blocked' ? 'Off task' : status === 'drifting' ? 'Drifting' : 'Focused';

    return (
      <div className="fg-panel">
        <div className="fg-row fg-row--center">
          <span className={`fg-status ${statusClass}`}><span className="fg-dot" />{statusLabel}</span>
        </div>

        <p className="fg-goal-label">Your one focus</p>
        <h2 className="fg-goal">{currentTask}</h2>

        <div className="fg-timer fg-center-text">{fmtDuration(elapsed)}</div>
        <div className="fg-progress"><div className="fg-progress__bar" style={{ width: `${progress}%` }} /></div>
        <p className="fg-sub fg-center-text">{Math.round(elapsed / 60000)} of {timeBoxMins} min</p>

        <div className="fg-stats">
          <div className="fg-stat">
            <span className={`fg-stat__val ${scoreClass}`}>{liveScore}%</span>
            <span className="fg-stat__lbl">Focus score</span>
          </div>
          <div className="fg-stat">
            <span className="fg-stat__val">{distractions.length}</span>
            <span className="fg-stat__lbl">Diverts</span>
          </div>
        </div>

        <div className="fg-anchor">
          {anchorApp ? (
            <span>🔒 Guarding <b>{anchorApp}</b> · <button className="fg-link" onClick={() => setAnchorApp(null)}>change</button></span>
          ) : (
            <span>Open the app you'll work in — it locks in as your task app.</span>
          )}
        </div>

        {onBreak && breakLeft > 0 && (
          <p className="fg-sub fg-center-text">
            Break ends in {fmtDuration(breakLeft)} ·{' '}
            <button className="fg-link" onClick={endBreak}>resume now</button>
          </p>
        )}

        {driftingApp && !onBreak && (
          <button className="fg-btn fg-btn--block" onClick={() => addAllowedApp(driftingApp)}>
            ✓ “{driftingApp}” is part of this task
          </button>
        )}

        <button className="fg-btn fg-btn--primary fg-btn--block" onClick={handleEnd}>End session</button>

        <button className="fg-more" onClick={() => setShowMore((v) => !v)}>
          {showMore ? 'Less ▴' : 'More ▾'}
        </button>

        {showMore && (
          <div className="fg-more-body">
            <div className="fg-row">
              <input
                className="fg-input"
                placeholder="Park a stray thought…"
                value={parkText}
                onChange={(e) => setParkText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { park(parkText); setParkText(''); } }}
              />
              <button className="fg-btn" onClick={() => { park(parkText); setParkText(''); }}>Park</button>
            </div>
            {parked.length > 0 && (
              <ul className="fg-parked">
                {parked.map((p) => (
                  <li key={p.id}><span>{p.text}</span><button className="fg-x" onClick={() => removeParked(p.id)}>✕</button></li>
                ))}
              </ul>
            )}
            {!onBreak && (
              <button className="fg-btn fg-btn--block" onClick={() => takeBreak(5)}>Take a 5-min break</button>
            )}
            {allowlist.length > 0 && (
              <div className="fg-allow">
                {allowlist.map((a) => <span key={a} className="fg-allow-tag">{a}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Confirm (intention ritual) ───────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="fg-panel fg-center">
        <p className="fg-eyebrow">Commit to one thing</p>
        <h2 className="fg-goal">{currentTask}</h2>
        <p className="fg-sub">
          For the next {timeBoxMins} minutes, this is the only thing.
          If you drift, I'll pull you back.
        </p>
        <button className="fg-btn fg-btn--primary fg-btn--block" onClick={handleStart}>Start focus</button>
        <button className="fg-link" onClick={() => setStep('setup')}>Back</button>
      </div>
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────
  const last = history[0];
  return (
    <div className="fg-panel">
      <p className="fg-eyebrow">What's your one focus?</p>
      <input
        className="fg-input fg-input--lg"
        placeholder="e.g. Finish the Q3 report"
        value={currentTask}
        onChange={(e) => setCurrentTask(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && currentTask.trim()) setStep('confirm'); }}
        autoFocus
      />
      <p className="fg-sub">How long?</p>
      <div className="fg-chips">
        {TIME_BOXES.map((m) => (
          <button key={m} className={`fg-chip${timeBoxMins === m ? ' fg-chip--on' : ''}`} onClick={() => setTimeBox(m)}>{m}m</button>
        ))}
      </div>
      <button className="fg-btn fg-btn--primary fg-btn--block" disabled={!currentTask.trim()} onClick={() => setStep('confirm')}>
        Continue
      </button>

      {history.length > 0 && (
        <p className="fg-foot">
          🔥 {history.length} session{history.length === 1 ? '' : 's'}
          {last ? ` · last ${last.score}% on “${last.task.slice(0, 24)}${last.task.length > 24 ? '…' : ''}”` : ''}
        </p>
      )}
    </div>
  );
}
