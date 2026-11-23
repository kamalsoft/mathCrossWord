import { describe, expect, it } from 'vitest';
import { explainWrong } from '../src/utils/explain';
import type { Entries, Equation, Operator, Puzzle, PuzzleCell, TierId } from '../src/engine/types';

/** A one-row across equation: `left` tokens, then '=', then `result` (null = empty). */
function explain(left: (number | Operator)[], result: number | null, tier: TierId): string | null {
  const cells: PuzzleCell[] = [];
  const values: (number | Operator | null)[] = [];
  left.forEach((t, col) => {
    const isOp = typeof t === 'string';
    cells.push({ row: 0, col, type: isOp ? 'operator' : 'value', given: false, ...(isOp ? { op: t } : { answer: t }) });
    values.push(t);
  });
  cells.push({ row: 0, col: left.length, type: 'equals', given: true });
  values.push(null);
  cells.push({ row: 0, col: left.length + 1, type: 'value', given: false, answer: result ?? undefined });
  values.push(result);

  const puzzle: Puzzle = { id: 't', tier, size: cells.length, seed: 1, equations: [], grid: [cells] };
  const eq: Equation = { id: 'e', orientation: 'across', cells: cells.map(({ row, col }) => ({ row, col })) };
  const entries: Entries = [values];
  return explainWrong(puzzle, eq, entries, tier);
}

describe('explainWrong', () => {
  it('returns null for a correct or incomplete equation', () => {
    expect(explain([3, '+', 4], 7, 'junior')).toBeNull();
    expect(explain([3, '+', 4], null, 'junior')).toBeNull();
  });

  it('junior: operation, operands and a counting hint', () => {
    expect(explain([3, '+', 4], 8, 'junior')).toBe('3 + 4 is 7, not 8. Try counting up from 4: 5, 6, 7.');
  });

  it('elementary: one sentence with the correct result', () => {
    expect(explain([5, '×', 6], 35, 'elementary')).toBe('5 × 6 is 30, not 35.');
  });

  it('middle: names the order of operations when it matters', () => {
    expect(explain([3, '+', 2, '×', 4], 20, 'middle')).toBe(
      'Multiply and divide before you add or subtract: 3 + 2 × 4 = 11, not 20.',
    );
  });

  it('adult: shows the PEMDAS reduction and the division remainder note', () => {
    expect(explain([2, '+', 3, '×', 4], 20, 'adult')).toBe(
      'Work out × and ÷ first: 2 + 3 × 4 becomes 2 + 12 = 14, not 20.',
    );
    expect(explain([12, '÷', 5], 2, 'adult')).toBe(
      '12 ÷ 5 is not a whole number here, so the answer should be a whole number.',
    );
  });
});
