import { useAppStore } from '../../store/useAppStore';
import { getGame } from '../storeTypes';
import { nextEmpty, type Pos } from './grid';

const st = () => useAppStore.getState();

export function selectPos(p: Pos) {
  st().select(p.row, p.col);
}

/** Enter / Next: move to the next empty value cell. */
export function goNext() {
  const g = getGame();
  if (!g) return;
  const p = nextEmpty(g.puzzle, g.entries, g.selected);
  if (p) selectPos(p);
}

/** Tap or drop of a number from the bank: replaces the cell's content with `n`. */
export function fillNumber(p: Pos, n: number) {
  const g = getGame();
  if (!g) return;
  const cell = g.puzzle.grid[p.row][p.col];
  if (cell.type !== 'value' || cell.given) return;
  const s = st();
  s.select(p.row, p.col);
  s.erase();
  for (const d of String(n)) s.inputDigit(Number(d));
}
