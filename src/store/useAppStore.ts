import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generatePuzzle } from '../engine/puzzleGenerator';
import { hintCell, isSolved } from '../engine/evaluator';
import { TIERS, tierForAge } from '../engine/tierConfig';
import type { Entries, Operator, Puzzle, PuzzleCell, TierId } from '../engine/types';
import { playError, playTap, playWin, setSoundEnabled } from '../utils/sound';

export type Theme = 'system' | 'light' | 'dark';
export type MistakeMode = 'gameover' | 'warning' | 'streak';
export type HintMode = '3' | 'tier' | 'unlimited';
/** Pencil marks keyed 'row,col'. */
export type Notes = Record<string, number[]>;

export interface Settings {
  theme: Theme;
  difficultyOverride: 'auto' | TierId;
  autoCheck: boolean;
  mistakeLimit: boolean;
  mistakeMode: MistakeMode;
  hintMode: HintMode;
  highlightEquations: boolean;
  /** null = tier default (on for Junior only). */
  showNumberBankOverride: boolean | null;
  timerVisible: boolean;
  sound: boolean;
  largeFont: boolean;
}

export interface Stats {
  gamesPlayed: number;
  wins: number;
  streak: number;
  bestTimesMs: Partial<Record<TierId, number>>;
}

export interface Snapshot {
  entries: Entries;
  notes: Notes;
}

export interface GameState {
  puzzle: Puzzle;
  entries: Entries;
  notes: Notes;
  history: Snapshot[];
  selected: { row: number; col: number } | null;
  notesMode: boolean;
  mistakes: number;
  /** Set in 'warning' mistake mode once the limit is reached. */
  warning: boolean;
  hintsUsed: number;
  startedAt: number;
  elapsedMs: number;
  paused: boolean;
  status: 'playing' | 'won' | 'lost';
  score: number;
  lastDigitAt?: number;
  /** Set by check(); cleared by any board change. UI shows wrongCells(game) while true. */
  checked: boolean;
}

export interface ProfileData {
  name: string;
  age: number;
  tier: TierId;
  hasCompletedTour: boolean;
  game: GameState | null;
  stats: Stats;
}

export interface AppState {
  profiles: Record<string, ProfileData>;
  currentProfileKey: string | null;
  settings: Settings;

  /** Returns an error message, or null on success. */
  onboard(name: string, age: number): string | null;
  switchUser(): void;
  clearProfile(): void;
  markTourDone(): void;
  resetStats(): void;
  setSettings(partial: Partial<Settings>): void;
  newGame(tier?: TierId): void;
  select(row: number, col: number): void;
  clearSelection(): void;
  inputDigit(d: number): void;
  inputOperator(op: Operator): void;
  backspace(): void;
  erase(): void;
  toggleNotes(): void;
  undo(): void;
  check(): void;
  hint(): void;
  addMistake(): void;
  togglePause(): void;
  tick(now: number): void;
}

export const MISTAKE_LIMIT = 3;
const HISTORY_MAX = 100;
const HINT_BUDGET: Record<TierId, number> = { junior: 5, elementary: 3, middle: 2, adult: 1 };

export const defaultSettings: Settings = {
  theme: 'system',
  difficultyOverride: 'auto',
  autoCheck: false,
  mistakeLimit: false,
  mistakeMode: 'gameover',
  hintMode: '3',
  highlightEquations: true,
  showNumberBankOverride: null,
  timerVisible: true,
  sound: true,
  largeFont: false,
};

const emptyStats = (): Stats => ({ gamesPlayed: 0, wins: 0, streak: 0, bestTimesMs: {} });
const cellKey = (r: number, c: number) => `${r},${c}`;

function cellAnswer(cell: PuzzleCell): number | Operator | null {
  if (cell.type === 'value') return cell.answer ?? null;
  if (cell.type === 'operator') return cell.op ?? null;
  return null;
}

function setEntry(entries: Entries, r: number, c: number, v: number | Operator | null): Entries {
  return entries.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row));
}

/** Givens are pre-filled so the entries grid is a complete board for isSolved. */
function emptyEntries(puzzle: Puzzle): Entries {
  return puzzle.grid.map(row => row.map(cell => (cell.given ? cellAnswer(cell) : null)));
}

const snapshot = (g: GameState): Snapshot => ({ entries: g.entries, notes: g.notes });
const pushHistory = (g: GameState) => [...g.history.slice(-(HISTORY_MAX - 1)), snapshot(g)];

const selAt = (g: GameState) => {
  const s = g.selected;
  return s ? { r: s.row, c: s.col, cell: g.puzzle.grid[s.row][s.col] } : null;
};

/** Player-entered cells that differ from the answer. */
export function wrongCells(g: GameState): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  g.puzzle.grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      const v = g.entries[r][c];
      if (!cell.given && v !== null && v !== cellAnswer(cell)) out.push({ row: r, col: c });
    }),
  );
  return out;
}

/** 10 per correct player value cell, 25 per completed equation with at least one player cell. */
function computeScore(puzzle: Puzzle, entries: Entries): number {
  const ok = (r: number, c: number) => entries[r][c] === cellAnswer(puzzle.grid[r][c]);
  let pts = 0;
  puzzle.grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.type === 'value' && !cell.given && ok(r, c)) pts += 10;
    }),
  );
  for (const eq of puzzle.equations) {
    if (eq.cells.some(({ row, col }) => !puzzle.grid[row][col].given) && eq.cells.every(({ row, col }) => ok(row, col))) {
      pts += 25;
    }
  }
  return pts;
}

export function hintsLeft(g: GameState, s: Settings): number {
  if (s.hintMode === 'unlimited') return Infinity;
  const total = s.hintMode === 'tier' ? HINT_BUDGET[g.puzzle.tier] : 3;
  return Math.max(0, total - g.hintsUsed);
}

export function showNumberBank(s: Settings, tier: TierId): boolean {
  return s.showNumberBankOverride ?? tier === 'junior';
}

type Patch = Partial<ProfileData> | null;

/**
 * Applies a board change: recomputes score, counts a mistake if requested (applying the
 * mistake mode), and settles a win. Pure apart from the sound cues.
 */
function advance(p: ProfileData, g: GameState, s: Settings, change: Partial<GameState>, mistake = false): Patch {
  let game: GameState = { ...g, ...change, checked: false };
  let stats = p.stats;

  if (mistake) {
    playError();
    game = { ...game, mistakes: game.mistakes + 1 };
    if (s.mistakeLimit && game.mistakes >= MISTAKE_LIMIT) {
      if (s.mistakeMode === 'warning') {
        game = { ...game, warning: true };
      } else {
        stats = { ...stats, streak: 0 };
        if (s.mistakeMode === 'gameover') {
          game = { ...game, status: 'lost', elapsedMs: Date.now() - game.startedAt };
          stats = { ...stats, gamesPlayed: stats.gamesPlayed + 1 };
        } else {
          game = { ...game, mistakes: 0 };
        }
      }
    }
  }

  game = { ...game, score: computeScore(game.puzzle, game.entries) };
  if (game.status === 'playing' && isSolved(game.puzzle, game.entries)) {
    const elapsedMs = Date.now() - game.startedAt;
    const tier = game.puzzle.tier;
    const best = stats.bestTimesMs[tier];
    stats = {
      gamesPlayed: stats.gamesPlayed + 1,
      wins: stats.wins + 1,
      streak: stats.streak + 1,
      bestTimesMs: { ...stats.bestTimesMs, [tier]: best === undefined ? elapsedMs : Math.min(best, elapsedMs) },
    };
    game = { ...game, status: 'won', elapsedMs, score: game.score + Math.max(0, 300 - Math.floor(elapsedMs / 1000)) };
    playWin();
  }
  return { game, stats };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      // Applies fn to the current profile; a null result leaves state untouched.
      const updateProfile = (fn: (p: ProfileData, st: AppState) => Patch) =>
        set(st => {
          const key = st.currentProfileKey;
          if (!key || !st.profiles[key]) return st;
          const p = st.profiles[key];
          const patch = fn(p, st);
          return patch ? { profiles: { ...st.profiles, [key]: { ...p, ...patch } } } : st;
        });

      // Input actions only act on a game that is being played and not paused.
      const playGame = (fn: (g: GameState, p: ProfileData, st: AppState) => Patch) =>
        updateProfile((p, st) => {
          const g = p.game;
          if (!g || g.status !== 'playing' || g.paused) return null;
          const patch = fn(g, p, st);
          if (patch) playTap();
          return patch;
        });

      return {
        profiles: {},
        currentProfileKey: null,
        settings: defaultSettings,

        onboard: (rawName, age) => {
          const name = rawName.trim();
          const tier = Number.isInteger(age) ? tierForAge(age) : null;
          if (name.length < 2 || name.length > 20) return 'Name must be 2–20 characters.';
          if (!tier) return 'Age must be a whole number from 5 to 120.';
          const key = name.toLowerCase();
          if (get().profiles[key]) {
            set({ currentProfileKey: key });
          } else {
            set(st => ({
              profiles: {
                ...st.profiles,
                [key]: { name, age, tier, hasCompletedTour: false, game: null, stats: emptyStats() },
              },
              currentProfileKey: key,
            }));
          }
          if (!get().profiles[key].game) get().newGame();
          return null;
        },

        switchUser: () => {
          updateProfile(p => (p.game ? { game: { ...p.game, paused: true } } : null));
          set({ currentProfileKey: null });
        },

        clearProfile: () =>
          set(st => {
            if (!st.currentProfileKey) return st;
            const profiles = { ...st.profiles };
            delete profiles[st.currentProfileKey];
            return { profiles, currentProfileKey: null };
          }),

        markTourDone: () => updateProfile(() => ({ hasCompletedTour: true })),
        resetStats: () => updateProfile(() => ({ stats: emptyStats() })),

        setSettings: partial => {
          set(st => ({ settings: { ...st.settings, ...partial } }));
          if (partial.sound !== undefined) setSoundEnabled(partial.sound);
        },

        newGame: tier =>
          updateProfile((p, st) => {
            const { difficultyOverride } = st.settings;
            const puzzle = generatePuzzle(tier ?? (difficultyOverride === 'auto' ? p.tier : difficultyOverride));
            return {
              game: {
                puzzle,
                entries: emptyEntries(puzzle),
                notes: {},
                history: [],
                selected: null,
                notesMode: false,
                mistakes: 0,
                warning: false,
                hintsUsed: 0,
                startedAt: Date.now(),
                elapsedMs: 0,
                paused: false,
                status: 'playing',
                score: 0,
                checked: false,
              },
            };
          }),

        select: (row, col) => updateProfile(p => (p.game ? { game: { ...p.game, selected: { row, col } } } : null)),
        clearSelection: () => updateProfile(p => (p.game ? { game: { ...p.game, selected: null } } : null)),

        inputDigit: d =>
          playGame((g, p, st) => {
            const sel = selAt(g);
            if (!sel || sel.cell.type !== 'value' || sel.cell.given) return null;
            const { r, c, cell } = sel;
            const k = cellKey(r, c);

            if (g.notesMode) {
              if (g.entries[r][c] !== null) return null;
              const cur = g.notes[k] ?? [];
              const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort((a, b) => a - b);
              return { game: { ...g, notes: { ...g.notes, [k]: next }, history: pushHistory(g) } };
            }

            const cur = g.entries[r][c];
            const digits = typeof cur === 'number' ? String(cur) : '';
            if (digits.length >= TIERS[g.puzzle.tier].maxDigits) return null;
            const value = Number(digits + d);
            const notes = { ...g.notes };
            delete notes[k];
            // Committed once it has as many digits as the answer.
            const complete = cell.answer !== undefined && String(value).length >= String(cell.answer).length;
            return advance(
              p,
              g,
              st.settings,
              { entries: setEntry(g.entries, r, c, value), notes, history: pushHistory(g), lastDigitAt: Date.now() },
              complete && value !== cell.answer,
            );
          }),

        inputOperator: op =>
          playGame((g, p, st) => {
            const sel = selAt(g);
            if (!sel || sel.cell.type !== 'operator' || sel.cell.given) return null;
            return advance(
              p,
              g,
              st.settings,
              { entries: setEntry(g.entries, sel.r, sel.c, op), history: pushHistory(g) },
              op !== sel.cell.op,
            );
          }),

        backspace: () =>
          playGame((g, p, st) => {
            const sel = selAt(g);
            if (!sel || sel.cell.given) return null;
            const cur = g.entries[sel.r][sel.c];
            if (cur === null) return null;
            const next = typeof cur === 'number' && String(cur).length > 1 ? Number(String(cur).slice(0, -1)) : null;
            return advance(p, g, st.settings, { entries: setEntry(g.entries, sel.r, sel.c, next), history: pushHistory(g) });
          }),

        erase: () =>
          playGame((g, p, st) => {
            const sel = selAt(g);
            if (!sel || sel.cell.given) return null;
            const k = cellKey(sel.r, sel.c);
            if (g.entries[sel.r][sel.c] === null && !(k in g.notes)) return null;
            const notes = { ...g.notes };
            delete notes[k];
            return advance(p, g, st.settings, {
              entries: setEntry(g.entries, sel.r, sel.c, null),
              notes,
              history: pushHistory(g),
            });
          }),

        toggleNotes: () => updateProfile(p => (p.game ? { game: { ...p.game, notesMode: !p.game.notesMode } } : null)),

        undo: () =>
          playGame((g, p, st) => {
            const prev = g.history[g.history.length - 1];
            if (!prev) return null;
            return advance(p, g, st.settings, {
              entries: prev.entries,
              notes: prev.notes,
              history: g.history.slice(0, -1),
            });
          }),

        check: () => playGame(g => ({ game: { ...g, checked: true } })),

        hint: () =>
          playGame((g, p, st) => {
            if (hintsLeft(g, st.settings) <= 0) return null;
            const target = hintCell(g.puzzle, g.entries);
            if (!target) return null;
            const value = cellAnswer(g.puzzle.grid[target.row][target.col]);
            if (value === null) return null;
            const notes = { ...g.notes };
            delete notes[cellKey(target.row, target.col)];
            return advance(p, g, st.settings, {
              entries: setEntry(g.entries, target.row, target.col, value),
              notes,
              history: pushHistory(g),
              hintsUsed: g.hintsUsed + 1,
            });
          }),

        addMistake: () => playGame((g, p, st) => advance(p, g, st.settings, {}, true)),

        togglePause: () =>
          updateProfile(p => {
            const g = p.game;
            if (!g || g.status !== 'playing') return null;
            const now = Date.now();
            // Pausing freezes elapsedMs; resuming rebases startedAt so the timer continues from it.
            return {
              game: g.paused
                ? { ...g, paused: false, startedAt: now - g.elapsedMs }
                : { ...g, paused: true, elapsedMs: now - g.startedAt },
            };
          }),

        tick: now =>
          updateProfile(p => {
            const g = p.game;
            if (!g || g.status !== 'playing' || g.paused) return null;
            return { game: { ...g, elapsedMs: now - g.startedAt } };
          }),
      };
    },
    {
      name: 'math-crossword-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ profiles: s.profiles, currentProfileKey: s.currentProfileKey, settings: s.settings }),
      // Restored games start paused so time spent with the page closed is not counted.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        const settings = { ...current.settings, ...saved.settings };
        setSoundEnabled(settings.sound);
        const profiles = Object.fromEntries(
          Object.entries(saved.profiles ?? {}).map(([k, p]): [string, ProfileData] => [
            k,
            p.game?.status === 'playing' ? { ...p, game: { ...p.game, paused: true } } : p,
          ]),
        );
        return { ...current, profiles, currentProfileKey: saved.currentProfileKey ?? null, settings };
      },
    },
  ),
);
