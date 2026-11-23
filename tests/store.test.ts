import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../src/store/useAppStore';

// Node has no localStorage: a Map-backed shim must exist before the store module loads.
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
});

let useAppStore: typeof import('../src/store/useAppStore').useAppStore;
let wrongCells: typeof import('../src/store/useAppStore').wrongCells;
let hintsLeft: typeof import('../src/store/useAppStore').hintsLeft;
let defaultSettings: typeof import('../src/store/useAppStore').defaultSettings;

beforeAll(async () => {
  const mod = await import('../src/store/useAppStore');
  ({ useAppStore, wrongCells, hintsLeft, defaultSettings } = mod);
});

beforeEach(() => {
  mem.clear();
  useAppStore.setState({ profiles: {}, currentProfileKey: null, settings: { ...defaultSettings } });
});

const game = (): GameState => {
  const g = useAppStore.getState().profiles[useAppStore.getState().currentProfileKey!]?.game;
  if (!g) throw new Error('no game');
  return g;
};

/** Non-given value cells in reading order. */
const blankValueCells = (g: GameState) =>
  g.puzzle.grid.flat().filter(c => c.type === 'value' && !c.given);

/** A number with the same digit count as `answer` that differs from it. */
const wrongFor = (answer: number) => {
  const len = String(answer).length;
  const w = Number('1'.repeat(len));
  return w === answer ? Number('2'.repeat(len)) : w;
};

const typeNumber = (n: number) => {
  for (const ch of String(n)) useAppStore.getState().inputDigit(Number(ch));
};

const select = (row: number, col: number) => useAppStore.getState().select(row, col);

describe('onboarding and profiles', () => {
  it('rejects invalid names and ages', () => {
    const s = useAppStore.getState();
    expect(s.onboard('A', 8)).not.toBeNull();
    expect(s.onboard('Ann', 4)).not.toBeNull();
    expect(s.onboard('Ann', 121)).not.toBeNull();
    expect(s.onboard('Ann', 8.5)).not.toBeNull();
    expect(useAppStore.getState().profiles).toEqual({});
  });

  it('assigns the tier from age and starts a game', () => {
    expect(useAppStore.getState().onboard('  Ann ', 6)).toBeNull();
    const p = useAppStore.getState().profiles['ann'];
    expect(p.name).toBe('Ann');
    expect(p.tier).toBe('junior');
    expect(p.hasCompletedTour).toBe(false);
    expect(p.game?.status).toBe('playing');
  });

  it('keeps per-profile games and resumes them by name', () => {
    const s = useAppStore.getState();
    s.onboard('Ann', 6);
    const annPuzzle = game().puzzle.id;
    s.switchUser();
    expect(useAppStore.getState().currentProfileKey).toBeNull();

    s.onboard('Bob', 9);
    expect(useAppStore.getState().profiles['bob'].tier).toBe('elementary');
    useAppStore.getState().switchUser();

    s.onboard('ANN', 99);
    expect(useAppStore.getState().currentProfileKey).toBe('ann');
    expect(game().puzzle.id).toBe(annPuzzle);
    expect(JSON.parse(mem.get('math-crossword-v1')!).state.profiles.ann.name).toBe('Ann');
  });
});

describe('game input', () => {
  beforeEach(() => {
    useAppStore.getState().onboard('Ann', 6);
  });

  it('undo restores the previous entry', () => {
    const cell = blankValueCells(game())[0];
    select(cell.row, cell.col);
    useAppStore.getState().inputDigit(1);
    expect(game().entries[cell.row][cell.col]).toBe(1);
    useAppStore.getState().undo();
    expect(game().entries[cell.row][cell.col]).toBeNull();
  });

  it('appends digits up to the tier maximum (Junior = 2)', () => {
    const cell = blankValueCells(game())[0];
    select(cell.row, cell.col);
    typeNumber(123);
    expect(game().entries[cell.row][cell.col]).toBe(12);
  });

  it('gameover mode loses the game at three mistakes', () => {
    useAppStore.getState().setSettings({ mistakeLimit: true, mistakeMode: 'gameover' });
    strikeThree();
    expect(game().status).toBe('lost');
    expect(game().mistakes).toBe(3);
  });

  it('warning mode flags but keeps playing', () => {
    useAppStore.getState().setSettings({ mistakeLimit: true, mistakeMode: 'warning' });
    strikeThree();
    expect(game().status).toBe('playing');
    expect(game().warning).toBe(true);
  });

  it('streak mode keeps playing and resets the strike count', () => {
    useAppStore.getState().setSettings({ mistakeLimit: true, mistakeMode: 'streak' });
    strikeThree();
    expect(game().status).toBe('playing');
    expect(game().mistakes).toBe(0);
  });

  it('check marks wrong entries until the next board change', () => {
    const cell = blankValueCells(game())[0];
    select(cell.row, cell.col);
    typeNumber(wrongFor(cell.answer!));
    expect(game().checked).toBe(false);
    useAppStore.getState().check();
    expect(game().checked).toBe(true);
    expect(wrongCells(game())).toEqual([{ row: cell.row, col: cell.col }]);
    useAppStore.getState().erase();
    expect(game().checked).toBe(false);
  });

  it.each([['3', 3], ['tier', 5], ['unlimited', Infinity]] as const)('hint enforces hintsLeft for hintMode %s', (mode, budget) => {
    const settings = { ...useAppStore.getState().settings, hintMode: mode };
    useAppStore.getState().setSettings({ hintMode: mode });
    expect(hintsLeft(game(), settings)).toBe(budget);
    for (let i = 0; i < 7; i++) {
      const before = game();
      if (before.status !== 'playing') break;
      const left = hintsLeft(before, settings);
      useAppStore.getState().hint();
      expect(game().hintsUsed - before.hintsUsed).toBe(left > 0 ? 1 : 0);
    }
    if (budget !== Infinity) expect(game().hintsUsed).toBeLessThanOrEqual(budget);
  });

  it('solving the board wins, records stats and scores', () => {
    for (const cell of blankValueCells(game())) {
      select(cell.row, cell.col);
      typeNumber(cell.answer!);
    }
    for (const row of game().puzzle.grid) for (const cell of row) {
      if (cell.type === 'operator' && !cell.given) {
        select(cell.row, cell.col);
        useAppStore.getState().inputOperator(cell.op!);
      }
    }
    const g = game();
    expect(g.status).toBe('won');
    expect(wrongCells(g)).toEqual([]);
    expect(g.score).toBeGreaterThanOrEqual(10 * blankValueCells(g).length);
    const stats = useAppStore.getState().profiles['ann'].stats;
    expect(stats).toMatchObject({ gamesPlayed: 1, wins: 1, streak: 1 });
    expect(stats.bestTimesMs.junior).toBeTypeOf('number');
  });
});

/** Three wrong commits. Uses addMistake directly: a Junior board can have fewer than three blanks. */
function strikeThree() {
  for (let i = 0; i < 3; i++) useAppStore.getState().addMistake();
}
