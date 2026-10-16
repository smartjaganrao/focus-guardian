import { useState, useEffect } from 'react';
import { useFocusGuardian } from './features/focus/useFocusGuardian';
import { useFocusStore } from './store/focus.store';
import FocusPanel from './features/focus/FocusPanel';
import PillView from './features/focus/PillView';
import NudgeOverlay from './features/focus/NudgeOverlay';
import SettingsPanel from './features/settings/SettingsPanel';
import Header from './ui/Header';
import Toasts from './ui/Toasts';

export default function App() {
  // Drive the active-window → classification → escalation engine.
  useFocusGuardian();

  const status = useFocusStore((s) => s.status);
  const isPill = useFocusStore((s) => s.isPill);
  const running = status !== 'idle';

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let alive = true;
    window.electronAPI?.settingsGet()
      .then((r) => { if (alive) setHasKey(r.hasKey); })
      .catch(() => { if (alive) setHasKey(false); });
    return () => { alive = false; };
  }, []);

  const needsKey = hasKey === false;
  const settingsOpen = showSettings || needsKey;

  // Collapsed pill takes over the whole (tiny) window.
  if (isPill && running) {
    return (
      <>
        <PillView />
        <NudgeOverlay />
        <Toasts />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header running={running} onSettings={() => setShowSettings((v) => !v)} />
      <div className="app-body">
        {hasKey === null ? null : settingsOpen ? (
          <SettingsPanel
            hasKey={!!hasKey}
            onSaved={() => { setHasKey(true); setShowSettings(false); }}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <FocusPanel />
        )}
      </div>

      <NudgeOverlay />
      <Toasts />
    </div>
  );
}
