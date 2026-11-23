import { evaluateEquation } from './evaluator';
import { TIERS } from './tierConfig';
import type { TierConfig } from './tierConfig';
import type { Entries, Equation, Operator, Puzzle } from './types';

export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tier rules: operands <= operandMax, results <= resultMax. Values >= 1 come from the domains. */
function inRange(puzzle: Puzzle, eq: Equation, cur: Entries, cfg: TierConfig): boolean {
  let afterEquals = false;
  for (const { row, col } of eq.cells) {
    const cell = puzzle.grid[row][col];
    if (cell.type === 'equals') afterEquals = true;
    else if (cell.type === 'value' && (cur[row][col] as number) > (afterEquals ? cfg.resultMax : cfg.operandMax)) return false;
  }
  return true;
}

/**
 * Backtracking search over every non-given value and operator cell. Returns up to `limit` solutions.
 * Returns null when `maxNodes` ran out (the result is then incomplete, so callers must not treat it as a count).
 * Pass `rng` to explore candidates in random order (used for generation).
 */
export function searchSolutions(puzzle: Puzzle, limit: number, rng?: Rng, maxNodes = Infinity): Entries[] | null {
  const cfg = TIERS[puzzle.tier];
  const n = puzzle.size;
  const eqs = puzzle.equations;
  const cur: Entries = Array.from({ length: n }, () => Array<number | Operator | null>(n).fill(null));
  const varIndex: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  // strictest tier cap per value cell: an operand position caps at operandMax, a result at resultMax
  const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(cfg.resultMax));
  for (const eq of eqs) {
    let afterEquals = false;
    for (const { row, col } of eq.cells) {
      const type = puzzle.grid[row][col].type;
      if (type === 'equals') afterEquals = true;
      else if (type === 'value') cap[row][col] = Math.min(cap[row][col], afterEquals ? cfg.resultMax : cfg.operandMax);
    }
  }
  const vars: { r: number; c: number; domain: (number | Operator)[]; eqs: number[] }[] = [];

  for (const row of puzzle.grid) {
    for (const cell of row) {
      if (cell.given) {
        cur[cell.row][cell.col] = cell.answer ?? cell.op ?? null;
      } else if (cell.type === 'value' || cell.type === 'operator') {
        varIndex[cell.row][cell.col] = vars.length;
        const domain: (number | Operator)[] = cell.type === 'value'
          ? Array.from({ length: cap[cell.row][cell.col] }, (_, i) => i + 1)
          : cfg.operators;
        vars.push({ r: cell.row, c: cell.col, domain, eqs: [] });
      }
    }
  }

  // unknown[i] = number of unassigned variable cells in equation i
  const unknown = eqs.map(() => 0);
  eqs.forEach((eq, i) => {
    for (const { row, col } of eq.cells) {
      const v = varIndex[row][col];
      if (v >= 0) {
        vars[v].eqs.push(i);
        unknown[i]++;
      }
    }
  });

  const holds = (i: number): boolean =>
    evaluateEquation(puzzle, eqs[i], cur) === 'correct' && inRange(puzzle, eqs[i], cur, cfg);

  if (eqs.some((_, i) => unknown[i] === 0 && !holds(i))) return [];

  const solutions: Entries[] = [];
  let nodes = 0;
  let aborted = false;

  const dfs = (): void => {
    if (aborted || solutions.length >= limit) return;
    if (++nodes > maxNodes) {
      aborted = true;
      return;
    }
    // most constrained variable: the one whose tightest equation has the fewest unknowns
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      if (cur[v.r][v.c] !== null) continue;
      const score = Math.min(...v.eqs.map(e => unknown[e]));
      if (score < bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best < 0) {
      solutions.push(cur.map(row => [...row]));
      return;
    }
    const v = vars[best];
    for (const d of rng ? shuffle(v.domain, rng) : v.domain) {
      cur[v.r][v.c] = d;
      for (const e of v.eqs) unknown[e]--;
      if (v.eqs.every(e => unknown[e] > 0 || holds(e))) dfs();
      for (const e of v.eqs) unknown[e]++;
      cur[v.r][v.c] = null;
      if (aborted || solutions.length >= limit) return;
    }
  };

  dfs();
  return aborted ? null : solutions;
}

/** Number of solutions for the clued puzzle, capped at `limit` (default 2). Used to enforce uniqueness. */
export function countSolutions(puzzle: Puzzle, limit = 2): number {
  return searchSolutions(puzzle, limit)?.length ?? 0;
}
