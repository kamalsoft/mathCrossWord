import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose?: () => void;
  drawer?: boolean;
  children: ReactNode;
}

/** Shared dialog shell: role=dialog, Escape closes, backdrop closes. */
export function Modal({ title, onClose, drawer = false, children }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const panel = drawer
    ? 'ml-auto h-full w-full max-w-md overflow-y-auto bg-surface p-5 shadow-2xl'
    : 'm-4 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/50 ${drawer ? '' : 'items-center justify-center'}`}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={panel}>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {onClose && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}
