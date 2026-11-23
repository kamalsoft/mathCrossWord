import { ArrowRight, Delete } from 'lucide-react';
import type { Operator } from '../../engine/types';
import { useAppStore } from '../../store/useAppStore';
import { goNext } from './actions';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const OPS: { op: Operator; name: string }[] = [
  { op: '+', name: 'Plus' },
  { op: '-', name: 'Minus' },
  { op: '×', name: 'Multiply' },
  { op: '÷', name: 'Divide' },
];

const KEY = 'min-h-12 rounded-xl bg-surface text-xl font-bold shadow-sm transition hover:bg-surface-2 active:scale-95';

interface Props {
  showOperators: boolean;
}

export function NumberPad({ showOperators }: Props) {
  const act = () => useAppStore.getState();

  return (
    <div data-tour="pad" className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-2">
        {DIGITS.map((d) => (
          <button key={d} type="button" className={KEY} onClick={() => act().inputDigit(d)}>
            {d}
          </button>
        ))}
      </div>
      {showOperators && (
        <div className="grid grid-cols-4 gap-2">
          {OPS.map(({ op, name }) => (
            <button key={op} type="button" aria-label={name} className={KEY} onClick={() => act().inputOperator(op)}>
              {op}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Backspace"
          className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-surface shadow-sm hover:bg-surface-2 active:scale-95"
          onClick={() => act().backspace()}
        >
          <Delete size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-accent-fg shadow-sm active:scale-95"
          onClick={goNext}
        >
          Next
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
