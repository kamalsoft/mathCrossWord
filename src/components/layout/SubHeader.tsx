import { Plus, Star } from 'lucide-react';
import type { TierId } from '../../engine/types';
import { TIERS, TIER_ORDER } from '../../engine/tierConfig';
import { useAppStore } from '../../store/useAppStore';
import { solvedEquations } from '../board/grid';
import { useGame, useProfile } from '../storeTypes';

const CONFIRM_RESET = 'Start a new puzzle? Your current progress on this puzzle will be lost.';

export function SubHeader() {
  const game = useGame();
  const profile = useProfile();
  const override = useAppStore((s) => s.settings.difficultyOverride);
  if (!game || !profile) return null;

  const stars = solvedEquations(game.puzzle, game.entries).length;
  const hasProgress = game.entries.some((row) => row.some((v) => v != null));
  const startNew = (tier?: TierId) => {
    if (hasProgress && !window.confirm(CONFIRM_RESET)) return;
    useAppStore.getState().newGame(tier);
  };
  const onDifficulty = (value: string) => {
    const tier = value === 'auto' ? undefined : (value as TierId);
    useAppStore.getState().setSettings({ difficultyOverride: value as 'auto' | TierId });
    startNew(tier);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="difficulty">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={override}
            onChange={(e) => onDifficulty(e.target.value)}
            className="min-h-11 rounded-xl bg-surface px-3 font-semibold shadow-sm"
          >
            <option value="auto">Auto (by age)</option>
            {TIER_ORDER.map((id) => (
              <option key={id} value={id}>
                {TIERS[id].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => startNew()}
            className="flex min-h-11 items-center gap-1 rounded-xl bg-accent px-4 font-semibold text-accent-fg shadow-sm active:scale-95"
          >
            <Plus size={18} aria-hidden="true" />
            New Game
          </button>
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold tabular-nums text-muted">
          <span>Score {game.score} • Streak {profile.stats.streak}</span>
          <span className="flex items-center gap-1 text-star" aria-label={`${stars} stars`}>
            <Star size={16} className="fill-star" aria-hidden="true" />
            {stars}
          </span>
        </p>
      </div>
      {game.status === 'lost' && (
        <p role="status" className="text-sm font-semibold text-wrong">
          Game over: too many mistakes. Start a new puzzle to keep playing.
        </p>
      )}
    </div>
  );
}
