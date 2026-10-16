import { useToastsStore } from '../store/toasts.store';

export default function Toasts() {
  const { toasts, dismiss } = useToastsStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <div>{t.message}</div>
          {t.detail && <div className="toast__detail">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}
