import { useMemo } from 'react';
import type { GameState } from '../storeTypes';
import { fillNumber } from './actions';

interface Props {
  game: GameState;
}

/** Pool of numbers still needed. Each placed number is struck through. */
export function NumberBank({ game }: Props) {
  const { puzzle, entries, selected } = game;

  const pills = useMemo(() => {
    const need = new Map<number, number>();
    const placed = new Map<number, number>();
    puzzle.grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell.type !== 'value' || cell.given || cell.answer == null) return;
        need.set(cell.answer, (need.get(cell.answer) ?? 0) + 1);
        if (entries[r][c] === cell.answer) placed.set(cell.answer, (placed.get(cell.answer) ?? 0) + 1);
      }),
    );
    const out: { n: number; struck: boolean }[] = [];
    for (const [n, count] of [...need].sort((a, b) => a[0] - b[0])) {
      const done = placed.get(n) ?? 0;
      for (let i = 0; i < count; i++) out.push({ n, struck: i < done });
    }
    return out;
  }, [puzzle, entries]);

  return (
    <section aria-label="Available numbers" className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted">{selected ? 'Tap or drag a number into the selected cell' : 'Select a cell, then tap a number'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {pills.map((p, i) => (
          <button
            key={`${p.n}-${i}`}
            type="button"
            disabled={p.struck}
            draggable={!p.struck}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', String(p.n))}
            onClick={() => selected && fillNumber(selected, p.n)}
            className={`min-h-11 min-w-11 rounded-full bg-surface-2 px-3 font-semibold tabular-nums shadow-sm active:scale-95 ${p.struck ? 'opacity-40' : ''}`}
          >
            {p.struck ? <s>{p.n}</s> : p.n}
          </button>
        ))}
      </div>
    </section>
  );
}
