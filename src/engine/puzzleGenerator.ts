import { searchSolutions, shuffle } from './solver';
import type { Rng } from './solver';
import { TIERS } from './tierConfig';
import type { TierConfig } from './tierConfig';
import type { Entries, Equation, Operator, Puzzle, PuzzleCell, TierId } from './types';

const MAX_ATTEMPTS = 1000;
const NODE_BUDGET = 5000;

type Kind = PuzzleCell['type'];
/** An equation: `len` cells from `start` on lane `lane` (a row for across, a column for down). */
interface Seg { across: boolean; lane: number; start: number; len: number }
interface Cover { across: boolean; down: boolean; kind: Kind }

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

function coord(s: Seg, k: number): [number, number] {
  const p = s.start + k;
  return s.across ? [s.lane, p] : [p, s.lane];
}

/** Equation shape: value op value ... = value (single step), or two operators for a two-step equation. */
function kindAt(s: Seg, k: number): Kind {
  if (k === s.len - 2) return 'equals';
  return k % 2 === 1 ? 'operator' : 'value';
}

/**
 * Cell layout for the segments, or null when the template is illegal: a cell shared by two
 * equations must be a value in both, two equations of the same direction may not overlap,
 * and an equation's end cells must be followed by an empty cell (so runs stay readable).
 */
function layout(n: number, segs: Seg[]): (Cover | null)[][] | null {
  const cov: (Cover | null)[][] = Array.from({ length: n }, () => Array<Cover | null>(n).fill(null));
  for (const s of segs) {
    for (let k = 0; k < s.len; k++) {
      const [r, c] = coord(s, k);
      const kind = kindAt(s, k);
      const cur = cov[r][c];
      if (!cur) {
        cov[r][c] = { across: s.across, down: !s.across, kind };
        continue;
      }
      if (s.across ? cur.across : cur.down) return null;
      if (cur.kind !== 'value' || kind !== 'value') return null;
      cur.across ||= s.across;
      cur.down ||= !s.across;
    }
  }
  for (const s of segs) {
    for (const k of [-1, s.len]) {
      const [r, c] = coord(s, k);
      if (r >= 0 && c >= 0 && r < n && c < n && cov[r][c]) return null;
    }
  }
  return cov;
}

/**
 * Random legal set of equations. The first equation is placed anywhere; each later one crosses a
 * random existing equation at one of its value cells, so the set stays connected.
 */
function randomTemplate(cfg: TierConfig, rng: Rng): Seg[] | null {
  const n = cfg.gridSize;
  const target = randInt(rng, cfg.equations[0], cfg.equations[1]);
  const pickLen = (): number => (cfg.twoStep && rng() < 0.5 ? 7 : 5);
  const valueOffset = (len: number): number => 2 * randInt(rng, 0, (len - 1) / 2);
  const segs: Seg[] = [];
  for (let t = 0; segs.length < target && t < 2000; t++) {
    if (segs.length === 0) {
      const len = pickLen();
      segs.push({ across: rng() < 0.5, lane: randInt(rng, 0, n - 1), start: randInt(rng, 0, n - len), len });
      continue;
    }
    const e = segs[randInt(rng, 0, segs.length - 1)];
    const len = pickLen();
    const cross = e.start + valueOffset(e.len);     // lane of the new equation
    const start = e.lane - valueOffset(len);        // the new equation's value cell sits on e.lane
    if (start < 0 || start + len > n || cross >= n) continue;
    const seg: Seg = { across: !e.across, lane: cross, start, len };
    if (layout(n, [...segs, seg])) segs.push(seg);
  }
  if (segs.length < target) return null;
  if (cfg.twoStep && !segs.some(s => s.len === 7)) return null;
  return segs;
}

function skeleton(tier: TierId, n: number, segs: Seg[], seed: number): Puzzle {
  const cov = layout(n, segs)!;
  const grid: PuzzleCell[][] = cov.map((row, r) =>
    row.map((k, c): PuzzleCell => (k
      ? { row: r, col: c, type: k.kind, given: k.kind === 'equals' }
      : { row: r, col: c, type: 'void', given: true })),
  );
  const equations = segs.map((s, i): Equation => ({
    id: `${s.across ? 'across' : 'down'}-${i}`,
    orientation: s.across ? 'across' : 'down',
    cells: Array.from({ length: s.len }, (_, k) => {
      const [row, col] = coord(s, k);
      return { row, col };
    }),
  }));
  return { id: `${tier}-${seed}`, tier, size: n, grid, equations, seed };
}

/**
 * Writes the solution into the puzzle, then masks clues: the tier's share of values and
 * blank operators are hidden, and more clues are revealed until the solution is unique.
 */
function applyClues(puzzle: Puzzle, sol: Entries, cfg: TierConfig, rng: Rng): boolean {
  const cells = puzzle.grid.flat();
  for (const cell of cells) {
    if (cell.type === 'value') cell.answer = sol[cell.row][cell.col] as number;
    if (cell.type === 'operator') cell.op = sol[cell.row][cell.col] as Operator;
  }
  const values = shuffle(cells.filter(c => c.type === 'value'), rng);
  const ops = shuffle(cells.filter(c => c.type === 'operator'), rng);
  const clues = Math.round(cfg.clueRatio * values.length);
  values.forEach((c, i) => { c.given = i < clues; });
  const blanks = cfg.blankOperatorRatio > 0 ? Math.max(1, Math.round(cfg.blankOperatorRatio * ops.length)) : 0;
  ops.forEach((c, i) => { c.given = i >= blanks; });

  // reveal values before blank operators (the list is popped from the end), so blanks survive when possible
  const hidden = [
    ...shuffle(ops.filter(c => !c.given), rng),
    ...shuffle(values.filter(c => !c.given), rng),
  ];
  // a search that runs out of budget is not proof of uniqueness: reveal a batch so the next search is cheap
  let found = searchSolutions(puzzle, 2, undefined, NODE_BUDGET);
  while (found?.length !== 1 && hidden.length) {
    for (let n = found ? 1 : Math.ceil(hidden.length / 4); n > 0 && hidden.length; n--) hidden.pop()!.given = true;
    found = searchSolutions(puzzle, 2, undefined, NODE_BUDGET);
  }
  // Adult boards must keep some blank operator; a board that needed all of them revealed is retried
  return found?.length === 1 && (blanks === 0 || ops.some(c => !c.given));
}

/** Deterministic for a given seed. Every returned puzzle has exactly one solution. */
export function generatePuzzle(tier: TierId, seed: number = Date.now()): Puzzle {
  const cfg = TIERS[tier];
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const segs = randomTemplate(cfg, rng);
    if (!segs) continue;
    const puzzle = skeleton(tier, cfg.gridSize, segs, seed);
    const [solution] = searchSolutions(puzzle, 1, rng, NODE_BUDGET) ?? [];
    if (solution && applyClues(puzzle, solution, cfg, rng)) return puzzle;
  }
  throw new Error(`generatePuzzle: no unique ${tier} puzzle found for seed ${seed}`);
}
