import { useState, useEffect } from 'react';
import { useFocusStore } from '../../store/focus.store';
import { fmtDuration } from '../../lib/format';
import './focus.css';

// Collapsed always-on-top pill: just the one goal, the timer, and a status dot.
export default function PillView() {
  const { currentTask, status, startedAt, onBreak, setPill } = useFocusStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expand = () => { setPill(false); window.electronAPI?.windowSetCompact(false); };
  const dotClass = onBreak ? 'break' : status;

  return (
    <button className="pill" onClick={expand} title="Click to expand">
      <span className={`pill__dot pill__dot--${dotClass}`} />
      <span className="pill__task">{currentTask || 'Focus'}</span>
      <span className="pill__timer">{fmtDuration(now - (startedAt ?? now))}</span>
    </button>
  );
}
