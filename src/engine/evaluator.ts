import type { Entries, Equation, EquationStatus, Operator, Puzzle, PuzzleCell } from './types';

/** Value of a cell: pre-filled clues come from the puzzle, everything else from the player's entries. */
function cellValue(cell: PuzzleCell, entries: Entries): number | Operator | null {
  if (cell.given) return cell.answer ?? cell.op ?? null;
  return entries[cell.row][cell.col];
}

/**
 * Safe PEMDAS evaluator for alternating `number op number ...` tokens.
 * Returns null for malformed input, non-exact division, division by zero, or any negative intermediate/final value.
 */
export function evaluateExpression(tokens: (number | Operator)[]): number | null {
  const first = tokens[0];
  if (tokens.length % 2 === 0 || typeof first !== 'number' || !Number.isInteger(first) || first < 0) return null;
  let total = 0;
  let sign = 1;
  let term: number = first;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const b = tokens[i + 1];
    if (typeof b !== 'number' || !Number.isInteger(b) || b < 0) return null;
    if (op === '×') {
      term *= b;
    } else if (op === '÷') {
      if (b === 0 || term % b !== 0) return null;
      term /= b;
    } else if (op === '+' || op === '-') {
      total += sign * term;
      if (total < 0) return null;
      sign = op === '+' ? 1 : -1;
      term = b;
    } else {
      return null;
    }
  }
  total += sign * term;
  return total < 0 ? null : total;
}

/** Checks one equation against the player's entries (pre-filled clues count as entries). */
export function evaluateEquation(puzzle: Puzzle, eq: Equation, entries: Entries): EquationStatus {
  const tokens: (number | Operator)[] = [];
  let result: number | null = null;
  let afterEquals = false;
  let incomplete = false;
  for (const { row, col } of eq.cells) {
    const cell = puzzle.grid[row][col];
    if (cell.type === 'equals') {
      afterEquals = true;
      continue;
    }
    const v = cellValue(cell, entries);
    if (v === null) {
      incomplete = true;
    } else if (afterEquals) {
      result = v as number;
    } else {
      tokens.push(v);
    }
  }
  if (incomplete) return 'incomplete';
  const got = evaluateExpression(tokens);
  return got !== null && got === result ? 'correct' : 'wrong';
}

/** True when every value and operator cell holds its answer. */
export function isSolved(puzzle: Puzzle, entries: Entries): boolean {
  return puzzle.grid.every(row =>
    row.every(cell => {
      if (cell.type === 'value') return cellValue(cell, entries) === cell.answer;
      if (cell.type === 'operator') return cellValue(cell, entries) === cell.op;
      return true;
    }),
  );
}

/** A hintable cell: empty entries come first, then the first wrong entry. Null when nothing is left to hint. */
export function hintCell(puzzle: Puzzle, entries: Entries): { row: number; col: number } | null {
  let wrong: { row: number; col: number } | null = null;
  for (const row of puzzle.grid) {
    for (const cell of row) {
      if (cell.given || (cell.type !== 'value' && cell.type !== 'operator')) continue;
      const v = entries[cell.row][cell.col];
      if (v === null) return { row: cell.row, col: cell.col };
      const correct = cell.type === 'value' ? cell.answer : cell.op;
      if (v !== correct && !wrong) wrong = { row: cell.row, col: cell.col };
    }
  }
  return wrong;
}
