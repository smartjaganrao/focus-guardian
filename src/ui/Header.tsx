import { useFocusStore } from '../store/focus.store';

interface Props {
  running: boolean;
  onSettings: () => void;
}

// Draggable title strip with window controls (the app is frameless).
export default function Header({ running, onSettings }: Props) {
  const setPill = useFocusStore((s) => s.setPill);

  const toPill = () => { setPill(true); window.electronAPI?.windowSetCompact(true); };

  return (
    <div className="hdr">
      <div className="hdr__brand">
        <span className="hdr__mark" />
        <span className="hdr__title">Focus Guardian</span>
      </div>
      <div className="hdr__controls">
        {running && (
          <button className="hdr__btn" title="Minimize to pill" onClick={toPill}>▭</button>
        )}
        <button className="hdr__btn" title="Settings" onClick={onSettings}>⚙</button>
        <button className="hdr__btn" title="Hide to menu bar" onClick={() => window.electronAPI?.windowHide()}>—</button>
      </div>
    </div>
  );
}
