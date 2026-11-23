import { CircleCheck, Eraser, Lightbulb, Pencil, Undo2 } from 'lucide-react';
import { hintsLeft, useAppStore } from '../../store/useAppStore';
import { useGame } from '../storeTypes';

const BTN =
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface px-1 text-xs font-semibold shadow-sm transition enabled:hover:bg-surface-2 enabled:active:scale-95 disabled:opacity-40';

export function ControlBar() {
  const game = useGame();
  const settings = useAppStore((s) => s.settings);
  if (!game) return null;

  const act = () => useAppStore.getState();
  const left = hintsLeft(game, settings);
  const locked = game.paused || game.status !== 'playing';

  return (
    <div className="flex flex-col gap-2">
      <div data-tour="tools" className="flex gap-2">
        <button type="button" aria-label="Undo" className={BTN} onClick={() => act().undo()} disabled={locked}>
          <Undo2 size={20} aria-hidden="true" />
          Undo
        </button>
        <button type="button" aria-label="Erase" className={BTN} onClick={() => act().erase()} disabled={locked}>
          <Eraser size={20} aria-hidden="true" />
          Erase
        </button>
        <button
          type="button"
          aria-label={`Notes ${game.notesMode ? 'on' : 'off'}`}
          aria-pressed={game.notesMode}
          className={`${BTN} ${game.notesMode ? 'ring-2 ring-accent' : ''}`}
          onClick={() => act().toggleNotes()}
          disabled={locked}
        >
          <Pencil size={20} aria-hidden="true" />
          Notes {game.notesMode ? 'On' : 'Off'}
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" data-tour="validation" className={BTN} onClick={() => act().check()} disabled={locked}>
          <CircleCheck size={20} aria-hidden="true" />
          Check
        </button>
        <button type="button" className={BTN} onClick={() => act().hint()} disabled={locked || left === 0}>
          <Lightbulb size={20} aria-hidden="true" />
          Hint
          <span
            className="rounded-full bg-accent px-1.5 text-[0.65rem] text-accent-fg"
            aria-label={`${left === Infinity ? 'Unlimited' : left} hints left`}
          >
            {left === Infinity ? '∞' : left}
          </span>
        </button>
      </div>
    </div>
  );
}
