import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/engine/puzzleGenerator';
import { evaluateEquation, evaluateExpression } from '../src/engine/evaluator';
import { countSolutions } from '../src/engine/solver';
import { TIERS, TIER_ORDER } from '../src/engine/tierConfig';
import type { Entries, Equation, Operator, Puzzle } from '../src/engine/types';

const BOARDS = 100;

/** Full answer key as entries (values and operators; null elsewhere). */
function solutionEntries(p: Puzzle): Entries {
  return p.grid.map(row => row.map(c => c.answer ?? c.op ?? null));
}

/** Tokens of an equation before its equals sign, read from the answer key. */
function tokensOf(p: Puzzle, eq: Equation, entries: Entries): (number | Operator)[] {
  const tokens: (number | Operator)[] = [];
  for (const { row, col } of eq.cells) {
    const cell = p.grid[row][col];
    if (cell.type === 'equals') break;
    tokens.push(entries[row][col] as number | Operator);
  }
  return tokens;
}

/** Independent left-to-right walk: every division exact, no negative intermediate values. */
function assertExactArithmetic(tokens: (number | Operator)[]): void {
  let total = 0;
  let sign = 1;
  let term = tokens[0] as number;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const b = tokens[i + 1] as number;
    if (op === '×') term *= b;
    else if (op === '÷') {
      expect(b, 'division by zero').not.toBe(0);
      expect(term % b, 'inexact division').toBe(0);
      term /= b;
    } else {
      total += sign * term;
      expect(total, 'negative intermediate').toBeGreaterThanOrEqual(0);
      sign = op === '+' ? 1 : -1;
      term = b;
    }
  }
  total += sign * term;
  expect(total, 'negative result').toBeGreaterThanOrEqual(0);
}

function checkBoard(p: Puzzle, label: string): void {
  const cfg = TIERS[p.tier];
  const where = `${label} (${p.tier}, seed ${p.seed})`;
  expect(p.size, where).toBe(cfg.gridSize);
  expect(p.equations.length, where).toBeGreaterThanOrEqual(cfg.equations[0]);
  expect(p.equations.length, where).toBeLessThanOrEqual(cfg.equations[1]);

  const entries = solutionEntries(p);
  const cover = new Map<string, number>();
  for (const eq of p.equations) {
    expect(evaluateEquation(p, eq, entries), where).toBe('correct');
    const tokens = tokensOf(p, eq, entries);
    assertExactArithmetic(tokens);

    const ops = eq.cells.filter(({ row, col }) => p.grid[row][col].type === 'operator');
    expect(ops.length === 1 || (cfg.twoStep && ops.length === 2), where).toBe(true);
    tokens.forEach((t, i) => {
      if (i % 2 === 0) {
        expect(t as number, where).toBeGreaterThanOrEqual(1);
        expect(t as number, where).toBeLessThanOrEqual(cfg.operandMax);
      }
    });
    for (const { row, col } of eq.cells) {
      cover.set(`${row},${col}`, (cover.get(`${row},${col}`) ?? 0) + 1);
    }
  }

  // intersections are value cells; every equation touches another one
  for (const [key, n] of cover) {
    const [row, col] = key.split(',').map(Number);
    if (n > 1) expect(p.grid[row][col].type, where).toBe('value');
  }
  for (const eq of p.equations) {
    const touches = eq.cells.some(({ row, col }) => (cover.get(`${row},${col}`) ?? 0) > 1);
    expect(touches, where).toBe(true);
  }

  // value and result ranges
  for (const row of p.grid) {
    for (const cell of row) {
      if (cell.type !== 'value') continue;
      expect(cell.answer!, where).toBeGreaterThanOrEqual(1);
      expect(cell.answer!, where).toBeLessThanOrEqual(cfg.resultMax);
      expect(String(cell.answer).length, where).toBeLessThanOrEqual(cfg.maxDigits);
    }
  }

  // operator restrictions
  const usedOps = new Set(p.grid.flat().filter(c => c.type === 'operator').map(c => c.op));
  for (const op of usedOps) expect(cfg.operators, where).toContain(op);

  // blanks: operators are hidden only where the tier allows it
  const opCells = p.grid.flat().filter(c => c.type === 'operator');
  if (cfg.blankOperatorRatio === 0) expect(opCells.every(c => c.given), where).toBe(true);

  expect(countSolutions(p), where).toBe(1);
}

describe.each(TIER_ORDER)('generatePuzzle: %s tier', tier => {
  it(`produces ${BOARDS} valid, unique boards`, () => {
    let clued = 0;
    let values = 0;
    let twoStepBoards = 0;
    let blankBoards = 0;
    for (let seed = 1; seed <= BOARDS; seed++) {
      const p = generatePuzzle(tier, seed);
      checkBoard(p, 'board');
      const vs = p.grid.flat().filter(c => c.type === 'value');
      values += vs.length;
      clued += vs.filter(c => c.given).length;
      if (p.equations.some(eq => eq.cells.filter(({ row, col }) => p.grid[row][col].type === 'operator').length === 2)) twoStepBoards++;
      if (p.grid.flat().some(c => c.type === 'operator' && !c.given)) blankBoards++;
    }
    expect(twoStepBoards === BOARDS || !TIERS[tier].twoStep, 'two-step equations present').toBe(true);
    if (TIERS[tier].twoStep) expect(twoStepBoards).toBe(BOARDS);
    if (tier === 'adult') expect(blankBoards).toBe(BOARDS);
    expect(clued / values).toBeGreaterThan(0);
  }, 180_000);

  it('is deterministic for a seed', () => {
    expect(generatePuzzle(tier, 42)).toEqual(generatePuzzle(tier, 42));
  });
});

it('evaluateExpression follows PEMDAS and rejects invalid arithmetic', () => {
  expect(evaluateExpression([2, '+', 3, '×', 4])).toBe(14);
  expect(evaluateExpression([12, '÷', 4, '×', 3])).toBe(9);
  expect(evaluateExpression([12, '÷', 5])).toBeNull();
  expect(evaluateExpression([7, '÷', 0])).toBeNull();
  expect(evaluateExpression([3, '-', 5])).toBeNull();
  expect(evaluateExpression([2, '-', 3, '×', 4])).toBeNull();
});
