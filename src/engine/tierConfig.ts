import type { TierId } from './types';

export interface TierConfig {
  id: TierId;
  label: string;          // exact label shown in UI
  ageMin: number;
  ageMax: number;
  gridSize: number;
  equations: [number, number];      // inclusive range
  operators: ('+' | '-' | '×' | '÷')[];
  operandMax: number;               // max operand value
  resultMax: number;                // max result / intermediate value
  clueRatio: number;                // share of playable value cells pre-filled
  maxDigits: number;                // max digits a cell may hold
  twoStep: boolean;                 // A op B op C = D
  blankOperatorRatio: number;       // share of operator cells left blank (Adult only)
}

export const TIERS: Record<TierId, TierConfig> = {
  junior: {
    id: 'junior', label: 'Junior Explorer', ageMin: 5, ageMax: 7,
    gridSize: 5, equations: [3, 4], operators: ['+', '-'],
    operandMax: 9, resultMax: 18, clueRatio: 0.6, maxDigits: 2,
    twoStep: false, blankOperatorRatio: 0,
  },
  elementary: {
    id: 'elementary', label: 'Elementary', ageMin: 8, ageMax: 10,
    gridSize: 7, equations: [6, 8], operators: ['+', '-', '×'],
    operandMax: 12, resultMax: 100, clueRatio: 0.45, maxDigits: 3,
    twoStep: false, blankOperatorRatio: 0,
  },
  middle: {
    id: 'middle', label: 'Middle & Teen', ageMin: 11, ageMax: 15,
    gridSize: 9, equations: [10, 14], operators: ['+', '-', '×', '÷'],
    operandMax: 12, resultMax: 250, clueRatio: 0.35, maxDigits: 3,
    twoStep: true, blankOperatorRatio: 0,
  },
  adult: {
    id: 'adult', label: 'Adult & Master', ageMin: 16, ageMax: 120,
    gridSize: 11, equations: [16, 20], operators: ['+', '-', '×', '÷'],
    operandMax: 25, resultMax: 250, clueRatio: 0.25, maxDigits: 3,
    twoStep: true, blankOperatorRatio: 0.2,
  },
};

export const TIER_ORDER: TierId[] = ['junior', 'elementary', 'middle', 'adult'];

/** Age (5–120) → default tier. Returns null when out of range. */
export function tierForAge(age: number): TierId | null {
  for (const id of TIER_ORDER) {
    if (age >= TIERS[id].ageMin && age <= TIERS[id].ageMax) return id;
  }
  return null;
}
