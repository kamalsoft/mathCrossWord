import { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    target: 'grid',
    title: 'The grid',
    body: 'Each row (Across) and column (Down) is a math equation. Where they cross, the cell is shared: its number has to work for both equations.',
  },
  {
    target: 'pad',
    title: 'Selecting and typing',
    body: 'Tap an empty cell to highlight its equations. Type with the number pad or your keyboard (0–9, Backspace, arrow keys).',
  },
  {
    target: 'tools',
    title: 'Smart tools',
    body: 'Notes hold candidate numbers in pencil. Undo reverses your last move, Erase clears a cell, and Hint reveals one cell (you have a limited number).',
  },
  {
    target: 'validation',
    title: 'Checking your work',
    body: 'Turn on Auto-check in Settings to see wrong numbers as you go. Press Check at any time to test the board.',
  },
  {
    target: 'header',
    title: 'Header controls',
    body: 'Settings change difficulty, assists and theme. Help has the rules and FAQ. The door icon switches players.',
  },
];

export function AppTourOverlay({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Spotlight the target for this step; re-measure on resize.
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour="${current.target}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [current.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="App tour" className="fixed inset-0 z-[60]">
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl ring-2 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
      )}
      <section className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-surface p-5 shadow-2xl">
        <p className="text-xs font-semibold text-muted">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="text-lg font-bold">{current.title}</h2>
        <p className="text-sm leading-relaxed">{current.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-3 font-semibold text-muted">
            Skip
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
              className="min-h-11 rounded-xl bg-surface-2 px-4 font-semibold disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => (last ? onClose() : setStep(step + 1))}
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-fg"
            >
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
