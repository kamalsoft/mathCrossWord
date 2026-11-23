// Shared contracts. Engine, store and UI all depend on these; change them only with the lead.

export type TierId = 'junior' | 'elementary' | 'middle' | 'adult';
export type Operator = '+' | '-' | '×' | '÷';

/** Cell kinds in a generated grid. `void` is a blocker tile. */
export type CellType = 'void' | 'value' | 'operator' | 'equals';

export interface PuzzleCell {
  row: number;
  col: number;
  type: CellType;
  /** type 'value': the correct number (may be multi-digit). */
  answer?: number;
  /** type 'operator': the correct operator. */
  op?: Operator;
  /** true = pre-filled clue shown to the player (locked). */
  given: boolean;
}

/** A horizontal or vertical equation: `tokens` are the cell coordinates in reading order. */
export interface Equation {
  id: string;
  orientation: 'across' | 'down';
  cells: { row: number; col: number }[];
}

export interface Puzzle {
  id: string;
  tier: TierId;
  size: number;
  grid: PuzzleCell[][];
  equations: Equation[];
  seed: number;
}

/** Player entries, keyed by grid position: numbers for value cells, operators for operator cells. */
export type Entries = (number | Operator | null)[][];

export type EquationStatus = 'correct' | 'wrong' | 'incomplete';
