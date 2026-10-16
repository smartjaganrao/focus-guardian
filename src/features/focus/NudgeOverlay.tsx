import { useState, useEffect } from 'react';
import { useFocusStore } from '../../store/focus.store';
import { returnToTask, allowDriftingApp, takeBreak } from './useFocusGuardian';
import { fmtDuration } from '../../lib/format';
import './focus.css';

// A single, polished intervention. Visual intensity escalates with the level;
// the window itself is also resized in the main process (normal → expanded →
// full-screen) so the card has room to breathe at higher tiers.
export default function NudgeOverlay() {
  const { escalationLevel, currentNudge, driftingApp, currentTask, driftStartedAt } = useFocusStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (escalationLevel === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [escalationLevel]);

  if (escalationLevel === 0) return null;

  const offFor = driftStartedAt ? fmtDuration(now - driftStartedAt) : '';

  return (
    <div className={`nudge nudge--l${escalationLevel}`} role="alertdialog" aria-modal="true">
      <div className="nudge__scrim" />
      <div className="nudge__card">
        <div className="nudge__halo">
          <span className="nudge__ring" />
          <svg className="nudge__icon" viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.45" />
            <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.75" />
            <circle cx="24" cy="24" r="4.5" fill="currentColor" />
          </svg>
        </div>

        <p className="nudge__eyebrow">
          {escalationLevel >= 3 ? 'Refocus now' : 'Off task'}
          {offFor && <span className="nudge__since"> · {offFor}</span>}
        </p>

        <h2 className="nudge__msg">{currentNudge || `Back to “${currentTask}”.`}</h2>

        <div className="nudge__goal">
          <span className="nudge__goal-label">Your focus</span>
          <span className="nudge__goal-text">{currentTask}</span>
        </div>

        {driftingApp && <p className="nudge__where">You drifted to {driftingApp}</p>}

        <div className="nudge__actions">
          <button className="nudge__btn nudge__btn--primary" onClick={returnToTask}>
            Back to my focus
          </button>
          <div className="nudge__row">
            {driftingApp && (
              <button className="nudge__btn nudge__btn--soft" onClick={allowDriftingApp}>
                This belongs here
              </button>
            )}
            <button className="nudge__btn nudge__btn--soft" onClick={() => takeBreak(5)}>
              Take 5
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
