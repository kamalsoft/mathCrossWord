import { memo, type DragEvent } from 'react';
import type { Operator, PuzzleCell } from '../../engine/types';

interface Props {
  cell: PuzzleCell;
  value: number | Operator | null;
  notes?: number[];
  selected: boolean;
  tinted: boolean;
  match: boolean;
  wrong: boolean;
  /** Part of a fully correct equation: plays the completion glow once. */
  done: boolean;
  /** Stable callbacks (take the position) so memo holds across keystrokes. */
  onSelect: (row: number, col: number) => void;
  onDrop: (row: number, col: number, n: number) => void;
}

const SIZE_TEXT = 'text-[clamp(0.7rem,4.2cqw,1.5rem)]';

function GridCellInner({ cell, value, notes, selected, tinted, match, wrong, done, onSelect, onDrop }: Props) {
  if (cell.type === 'void') return <div aria-hidden="true" className="rounded-[4px] bg-void" />;
  if (cell.type === 'equals') {
    return (
      <div role="img" aria-label="equals" className={`flex items-center justify-center rounded-md bg-op font-extrabold text-fg ${SIZE_TEXT}`}>
        =
      </div>
    );
  }

  const bg = selected
    ? 'bg-accent text-accent-fg'
    : match
      ? 'bg-match'
      : tinted
        ? 'bg-accent-soft'
        : cell.type === 'operator'
          ? 'bg-op text-accent'
          : cell.given
            ? 'bg-given'
            : 'bg-surface';
  // A wrong entry on the selected (accent) cell keeps the accent text colour and gets a red ring instead.
  const text = wrong ? (selected ? 'ring-2 ring-inset ring-wrong' : 'text-wrong') : cell.given ? 'font-extrabold' : '';
  const kind = cell.type === 'operator' ? 'Operator cell' : 'Number cell';
  const label = `${kind}, row ${cell.row + 1}, column ${cell.col + 1}${value == null ? ', empty' : `, ${value}`}`;
  const anim = [wrong ? 'cell-wrong' : '', done ? 'cell-done' : ''].join(' ');
  const droppable = cell.type === 'value' && !cell.given;

  const dropProps = droppable
    ? {
        onDragOver: (e: DragEvent<HTMLButtonElement>) => e.preventDefault(),
        onDrop: (e: DragEvent<HTMLButtonElement>) => {
          e.preventDefault();
          const n = Number(e.dataTransfer.getData('text/plain'));
          if (Number.isInteger(n)) onDrop(cell.row, cell.col, n);
        },
      }
    : {};

  const fallback =
    cell.type === 'operator' ? (
      <span className="text-muted">?</span>
    ) : notes && notes.length > 0 ? (
      <span className="block max-w-full truncate text-[clamp(0.45rem,1.8cqw,0.7rem)] font-normal leading-tight text-muted">
        {notes.join(' ')}
      </span>
    ) : null;

  // Keyed on the value so a new digit remounts the span and replays the pop.
  const content = value ?? fallback;
  const pop = !cell.given && value != null;

  return (
    <button
      type="button"
      data-cell
      onClick={() => onSelect(cell.row, cell.col)}
      onFocus={() => onSelect(cell.row, cell.col)}
      aria-label={label}
      className={`cell-tile flex min-h-0 min-w-0 items-center justify-center rounded-md font-semibold tabular-nums focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent ${SIZE_TEXT} ${bg} ${text} ${anim}`}
      {...dropProps}
    >
      <span key={String(value ?? '')} className={pop ? 'cell-pop' : undefined}>
        {content}
      </span>
    </button>
  );
}

export const GridCell = memo(GridCellInner);
