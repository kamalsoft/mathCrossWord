import { evaluateEquation, evaluateExpression } from '../engine/evaluator';
import type { Entries, Equation, Operator, Puzzle, TierId } from '../engine/types';

type Token = number | Operator;

/** The player's left side and result for an equation; null while any cell is empty. Given cells come from the puzzle. */
export function sidesOf(puzzle: Puzzle, eq: Equation, entries: Entries): { left: Token[]; result: number } | null {
  const left: Token[] = [];
  let result: number | null = null;
  let afterEquals = false;
  for (const { row, col } of eq.cells) {
    const cell = puzzle.grid[row][col];
    if (cell.type === 'equals') {
      afterEquals = true;
      continue;
    }
    const v = cell.given ? (cell.type === 'operator' ? cell.op : cell.answer) : entries[row][col];
    if (v === undefined || v === null) return null;
    if (afterEquals) result = v as number;
    else left.push(v);
  }
  return result === null ? null : { left, result };
}

const show = (t: Token[]) => t.join(' ');

/** PEMDAS step one: fold × and ÷ left to right. Returns the reduced tokens, or the sentence for a bad division. */
function foldMulDiv(t: Token[]): { tokens: Token[] } | { problem: string } {
  const out: Token[] = [];
  let term = t[0] as number;
  for (let i = 1; i < t.length; i += 2) {
    const op = t[i];
    const b = t[i + 1] as number;
    if (op === '×') {
      term *= b;
    } else if (op === '÷') {
      if (b === 0) return { problem: `You cannot divide ${term} by 0.` };
      if (term % b !== 0) return { problem: `${term} ÷ ${b} is not a whole number here, so the answer should be a whole number.` };
      term /= b;
    } else {
      out.push(term, op as Operator);
      term = b;
    }
  }
  out.push(term);
  return { tokens: out };
}

/** Junior: one sum or difference, with a counting hint on the operands the player used. */
function juniorLine(left: Token[], value: number, result: number): string {
  const head = `${show(left)} is ${value}, not ${result}.`;
  if (left.length !== 3) return head;
  const [a, op, b] = left as [number, Operator, number];
  const up = op === '+';
  if (!up && op !== '-') return head;
  const from = up ? Math.max(a, b) : a;
  const steps = up ? Math.min(a, b) : b;
  if (steps === 0) return head;
  const list = Array.from({ length: steps }, (_, i) => (up ? from + i + 1 : from - i - 1));
  return `${head} Try counting ${up ? 'up' : 'back'} from ${from}: ${list.join(', ')}.`;
}

/** Explains why a completed equation is wrong, in wording for the player's tier. Null when correct or incomplete. */
export function explainWrong(puzzle: Puzzle, eq: Equation, entries: Entries, tier: TierId): string | null {
  if (evaluateEquation(puzzle, eq, entries) !== 'wrong') return null;
  const sides = sidesOf(puzzle, eq, entries);
  if (!sides) return null;
  const { left, result } = sides;

  const folded = foldMulDiv(left);
  if ('problem' in folded) return folded.problem;
  const value = evaluateExpression(left);
  if (value === null) return `${show(left)} goes below zero, which is not allowed here.`;
  if (value === result) return null; // guard: never print "X is 8, not 8"

  const expr = show(left);
  const mixed = left.some((t) => t === '×' || t === '÷') && left.some((t) => t === '+' || t === '-');
  switch (tier) {
    case 'junior':
      return juniorLine(left, value, result);
    case 'elementary':
      return `${expr} is ${value}, not ${result}.`;
    case 'middle':
      return mixed
        ? `Multiply and divide before you add or subtract: ${expr} = ${value}, not ${result}.`
        : `${expr} = ${value}, not ${result}.`;
    case 'adult':
      return mixed
        ? `Work out × and ÷ first: ${expr} becomes ${show(folded.tokens)} = ${value}, not ${result}.`
        : `${expr} = ${value}, not ${result}.`;
  }
}

/** "4 + 5 = 9" for a filled equation, or null while a cell is empty. */
export function equationText(puzzle: Puzzle, eq: Equation, entries: Entries): string | null {
  const s = sidesOf(puzzle, eq, entries);
  return s ? `${show(s.left)} = ${s.result}` : null;
}
