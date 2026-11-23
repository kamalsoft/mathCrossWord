import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/store/useAppStore';

// Generation can be forced to fail so the B1 recovery path is testable.
const gen = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/engine/puzzleGenerator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/puzzleGenerator')>();
  return {
    ...actual,
    generatePuzzle: (...args: Parameters<typeof actual.generatePuzzle>) => {
      if (gen.fail) throw new Error('forced failure');
      return actual.generatePuzzle(...args);
    },
  };
});

const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
});

const { useAppStore, defaultSettings } = await import('../src/store/useAppStore');
const KEY = 'math-crossword-v1';

beforeEach(() => {
  gen.fail = false;
  mem.clear();
  useAppStore.setState({ profiles: {}, currentProfileKey: null, settings: { ...defaultSettings } });
});

const game = (): GameState => {
  const s = useAppStore.getState();
  const g = s.profiles[s.currentProfileKey!]?.game;
  if (!g) throw new Error('no game');
  return g;
};

describe('B1: puzzle generation failure', () => {
  it('onboarding keeps the profile and leaves game null when generation throws', () => {
    gen.fail = true;
    expect(useAppStore.getState().onboard('Ann', 6)).toBeNull();
    const p = useAppStore.getState().profiles['ann'];
    expect(p).toBeDefined();
    expect(p.game).toBeNull();
  });

  it('a retry after failure creates the game', () => {
    gen.fail = true;
    useAppStore.getState().onboard('Ann', 6);
    gen.fail = false;
    useAppStore.getState().newGame();
    expect(game().status).toBe('playing');
  });

  it('a failed New Game keeps the current game', () => {
    useAppStore.getState().onboard('Ann', 6);
    const before = game().puzzle.id;
    gen.fail = true;
    useAppStore.getState().newGame();
    expect(game().puzzle.id).toBe(before);
  });
});

describe('M5: retyping a correct answer', () => {
  it('does not append digits or count a mistake', () => {
    useAppStore.getState().setSettings({ mistakeLimit: true, mistakeMode: 'gameover' });
    useAppStore.getState().onboard('Ann', 6);
    const cell = game().puzzle.grid.flat().find(c => c.type === 'value' && !c.given)!;
    const s = useAppStore.getState();
    s.select(cell.row, cell.col);
    s.inputDigit(cell.answer!);
    const after = game();
    s.inputDigit(cell.answer!);
    expect(game().entries[cell.row][cell.col]).toBe(cell.answer);
    expect(game().mistakes).toBe(0);
    expect(game().history.length).toBe(after.history.length);
  });
});

describe('onboarding with an existing name', () => {
  it('returns an error and does not resume when the age differs', () => {
    const s = useAppStore.getState();
    s.onboard('Ann', 6);
    s.switchUser();
    expect(useAppStore.getState().onboard('ann', 7)).toMatch(/already exists at age 6/);
    expect(useAppStore.getState().currentProfileKey).toBeNull();
  });
});

describe('M3: persisted data validation', () => {
  it('drops malformed profiles, resets bad stats, drops bad games and bad settings', async () => {
    mem.set(
      KEY,
      JSON.stringify({
        state: {
          profiles: {
            junk: { name: 42 },
            ann: {
              name: 'Ann',
              age: 6,
              tier: 'junior',
              hasCompletedTour: true,
              stats: { gamesPlayed: 'many' },
              game: { puzzle: 'nope' },
            },
          },
          currentProfileKey: 'ann',
          settings: { theme: 42, sound: false, mistakeMode: 'bogus' },
        },
        version: 1,
      }),
    );
    await useAppStore.persist.rehydrate();
    const st = useAppStore.getState();
    expect(Object.keys(st.profiles)).toEqual(['ann']);
    expect(st.profiles.ann.stats).toEqual({ gamesPlayed: 0, wins: 0, streak: 0, bestTimesMs: {} });
    expect(st.profiles.ann.game).toBeNull();
    expect(st.settings.theme).toBe(defaultSettings.theme);
    expect(st.settings.mistakeMode).toBe(defaultSettings.mistakeMode);
    expect(st.settings.sound).toBe(false);
    expect(st.currentProfileKey).toBe('ann');
  });

  it('does not crash on unparseable saved data', async () => {
    mem.set(KEY, '{not json');
    await expect(useAppStore.persist.rehydrate()).resolves.not.toThrow();
  });
});

describe('M4: storage that throws', () => {
  it('keeps saving profiles in memory when localStorage fails', async () => {
    const real = globalThis.localStorage;
    const broken = () => {
      throw new Error('storage denied');
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: broken });
    try {
      expect(() => useAppStore.getState().onboard('Zed', 9)).not.toThrow();
      // Saved to the in-memory fallback while localStorage is unreachable.
      const saved = useAppStore.persist.getOptions().storage!.getItem('math-crossword-v1') as { state: { profiles: object } };
      expect(saved.state.profiles).toHaveProperty('zed');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: real });
    }
  });
});

describe('persist version 1 migrate placeholder', () => {
  it('returns persisted state unchanged', () => {
    const opts = useAppStore.persist.getOptions();
    const state = { profiles: {}, currentProfileKey: null, settings: defaultSettings };
    expect(opts.version).toBe(1);
    expect(opts.migrate?.(state, 1)).toBe(state);
  });
});
