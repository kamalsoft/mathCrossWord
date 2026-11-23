import type { Entries, Equation, Puzzle } from '../../engine/types';
import { evaluateEquation } from '../../engine/evaluator';

export interface Pos {
  row: number;
  col: number;
}

/** Value shown in a cell: the clue for given cells, otherwise the player's entry. */
export function cellValue(p: Puzzle, entries: Entries, row: number, col: number) {
  const cell = p.grid[row][col];
  if (cell.type === 'operator') return cell.given ? (cell.op ?? null) : entries[row][col];
  if (cell.type !== 'value') return null;
  return cell.given ? (cell.answer ?? null) : entries[row][col];
}

/** Nearest non-void cell in a direction, or `from` when the edge is reached. */
export function stepTo(p: Puzzle, from: Pos, dr: number, dc: number): Pos {
  let r = from.row + dr;
  let c = from.col + dc;
  while (r >= 0 && c >= 0 && r < p.size && c < p.size) {
    if (p.grid[r][c].type !== 'void') return { row: r, col: c };
    r += dr;
    c += dc;
  }
  return from;
}

function playableCells(p: Puzzle): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < p.size; row++) {
    for (let col = 0; col < p.size; col++) {
      if (p.grid[row][col].type !== 'void') out.push({ row, col });
    }
  }
  return out;
}

/** Next or previous playable cell in reading order (wraps). */
export function tabTo(p: Puzzle, from: Pos | null, back: boolean): Pos {
  const list = playableCells(p);
  const n = list.length;
  const i = from
    ? list.findIndex((x) => x.row === from.row && x.col === from.col)
    : back ? n : -1;
  return list[(i + (back ? -1 : 1) + n) % n];
}

/** Next empty value cell after `from` in reading order (wraps); null when the board is full. */
export function nextEmpty(p: Puzzle, entries: Entries, from: Pos | null): Pos | null {
  const list = playableCells(p).filter(({ row, col }) => {
    const cell = p.grid[row][col];
    return cell.type === 'value' && !cell.given && entries[row][col] == null;
  });
  if (list.length === 0) return null;
  const key = (x: Pos) => x.row * p.size + x.col;
  const after = from ? list.find((x) => key(x) > key(from)) : undefined;
  return after ?? list[0];
}

/** Equations fully and correctly filled that include at least one player-entered cell (one star each). */
export function solvedEquations(p: Puzzle, entries: Entries): Equation[] {
  return p.equations.filter(
    (eq) =>
      eq.cells.some(({ row, col }) => p.grid[row][col].type !== 'equals' && !p.grid[row][col].given) &&
      evaluateEquation(p, eq, entries) === 'correct',
  );
}
