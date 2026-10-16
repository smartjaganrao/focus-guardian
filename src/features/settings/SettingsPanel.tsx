import { useState } from 'react';
import { toast } from '../../store/toasts.store';
import '../focus/focus.css';

interface Props {
  hasKey: boolean;
  onSaved: () => void;
  onClose?: () => void;
}

export default function SettingsPanel({ hasKey, onSaved, onClose }: Props) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await window.electronAPI.settingsSetKey(key.trim());
      if (res.hasKey) {
        toast.success('Groq key saved');
        setKey('');
        onSaved();
      } else {
        toast.error('Could not save key');
      }
    } catch (e) {
      toast.error('Could not save key', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fg-panel">
      <div className="fg-row fg-row--between">
        <h3 className="fg-title">Settings</h3>
        {onClose && hasKey && <button className="fg-btn fg-btn--ghost" onClick={onClose}>✕</button>}
      </div>

      <p className="fg-sub">
        Focus Guardian uses Groq to judge whether what's on screen matches your task.
        Paste a free API key from{' '}
        <a
          href="https://console.groq.com/keys"
          onClick={(e) => { e.preventDefault(); window.electronAPI.openExternal('https://console.groq.com/keys'); }}
          style={{ color: 'var(--color-accent)' }}
        >console.groq.com/keys</a>.
      </p>

      <input
        className="fg-input"
        type="password"
        placeholder="gsk_…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        autoFocus
      />
      <button className="fg-btn fg-btn--primary" disabled={!key.trim() || saving} onClick={save}>
        {saving ? 'Saving…' : hasKey ? 'Replace key' : 'Save key'}
      </button>
      {hasKey && <p className="fg-sub">A key is already set ✓ — saving will replace it.</p>}

      <div className="fg-divider" />
      <p className="fg-sub">
        <strong>Heads up:</strong> to read window titles, macOS will ask for
        <em> Accessibility</em> access on first use. Approve it in
        System Settings → Privacy &amp; Security → Accessibility.
      </p>
    </div>
  );
}
