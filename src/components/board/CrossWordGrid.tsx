import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, wrongCells } from '../../store/useAppStore';
import { evaluateEquation } from '../../engine/evaluator';
import { explainWrong, equationText } from '../../utils/explain';
import type { GameState } from '../storeTypes';
import { GridCell } from './GridCell';
import { cellValue, solvedEquations } from './grid';
import { fillNumber, selectPos } from './actions';

interface Props {
  game: GameState;
  autoCheck: boolean;
  /** Mark wrong entries: on when auto-check is on, or after the player presses Check. */
  showWrong: boolean;
  highlightEquations: boolean;
}

const key = (r: number, c: number) => `${r},${c}`;
const selectCell = (row: number, col: number) => selectPos({ row, col });
const dropCell = (row: number, col: number, n: number) => fillNumber({ row, col }, n);

function CrossWordGridInner({ game, showWrong, highlightEquations }: Props) {
  const { puzzle, entries, notes, selected, paused } = game;
  const togglePause = useAppStore((s) => s.togglePause);

  // Cells sharing an across/down equation with the selected cell.
  const tinted = useMemo(() => {
    const set = new Set<string>();
    if (!selected || !highlightEquations) return set;
    for (const eq of puzzle.equations) {
      if (!eq.cells.some((c) => c.row === selected.row && c.col === selected.col)) continue;
      for (const c of eq.cells) set.add(key(c.row, c.col));
    }
    return set;
  }, [puzzle, selected, highlightEquations]);

  const wrong = useMemo(
    () => (showWrong ? new Set(wrongCells(game).map((c) => key(c.row, c.col))) : new Set<string>()),
    [game, showWrong],
  );

  const selValue = selected ? cellValue(puzzle, entries, selected.row, selected.col) : null;

  const solved = useMemo(() => solvedEquations(puzzle, entries), [puzzle, entries]);
  const doneCells = useMemo(
    () => new Set(solved.flatMap((eq) => eq.cells.map((c) => key(c.row, c.col)))),
    [solved],
  );

  const explanation = useMemo(() => {
    if (!showWrong) return null;
    const eq = puzzle.equations.find((e) => evaluateEquation(puzzle, e, entries) === 'wrong');
    return eq ? explainWrong(puzzle, eq, entries, puzzle.tier) : null;
  }, [puzzle, entries, showWrong]);

  // Praise the newest equation completed in this puzzle (not the ones already filled on load).
  const [praise, setPraise] = useState<string | null>(null);
  // Starts from the equations already solved, so loading or reloading a board praises nothing.
  const seen = useRef({ puzzleId: puzzle.id, ids: new Set(solved.map((eq) => eq.id)) });
  useEffect(() => {
    const prev = seen.current;
    const fresh = solved.filter((eq) => !(prev.puzzleId === puzzle.id && prev.ids.has(eq.id)));
    seen.current = { puzzleId: puzzle.id, ids: new Set(solved.map((eq) => eq.id)) };
    const text = fresh.length ? equationText(puzzle, fresh[fresh.length - 1], entries) : null;
    if (text) setPraise(`Nice! ${text}`);
  }, [solved, puzzle, entries]);

  useEffect(() => {
    if (!praise) return;
    const t = window.setTimeout(() => setPraise(null), 2500);
    return () => window.clearTimeout(t);
  }, [praise]);

  const message = explanation ?? praise;

  return (
    <div data-tour="grid" className="relative mx-auto w-full [container-type:inline-size]">
      {/* On narrow screens the board scrolls sideways instead of shrinking cells below the 44px touch target. */}
      <div className="overflow-x-auto overflow-y-hidden py-2">
      <div
        className="mx-auto grid aspect-square w-full gap-[3px] rounded-2xl bg-line p-[3px] shadow-md"
        style={{
          minWidth: `${puzzle.size * 44 + (puzzle.size + 1) * 3}px`,
          gridTemplateColumns: `repeat(${puzzle.size}, minmax(44px, 1fr))`,
          gridTemplateRows: `repeat(${puzzle.size}, minmax(0, 1fr))`,
        }}
      >
        {puzzle.grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const k = key(r, c);
            const value = cellValue(puzzle, entries, r, c);
            const isSel = !!selected && selected.row === r && selected.col === c;
            return (
              <GridCell
                key={k}
                cell={cell}
                value={value}
                notes={notes[k]}
                selected={isSel}
                tinted={tinted.has(k) && !isSel}
                match={selValue != null && value === selValue && cell.type === 'value' && !isSel}
                wrong={wrong.has(k)}
                done={doneCells.has(k)}
                onSelect={selectCell}
                onDrop={dropCell}
              />
            );
          }),
        )}
      </div>
      </div>

      <div aria-live="polite" className="mt-2 min-h-11">
        {message && (
          <p
            key={message}
            className={`praise-in rounded-xl px-3 py-2 text-sm font-semibold ${
              explanation ? 'bg-surface text-fg ring-2 ring-wrong' : 'bg-accent-soft text-fg'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg/90 backdrop-blur-sm">
          <p className="text-lg font-bold">Paused</p>
          <button
            type="button"
            onClick={() => togglePause()}
            className="min-h-11 rounded-full bg-accent px-6 font-semibold text-accent-fg"
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}

// The grid re-renders only when the board itself changes, not on each timer tick.
export const CrossWordGrid = memo(
  CrossWordGridInner,
  (a, b) =>
    a.game.puzzle === b.game.puzzle &&
    a.game.entries === b.game.entries &&
    a.game.notes === b.game.notes &&
    a.game.selected === b.game.selected &&
    a.game.paused === b.game.paused &&
    a.showWrong === b.showWrong &&
    a.highlightEquations === b.highlightEquations,
);
