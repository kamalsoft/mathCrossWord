import { type CSSProperties } from 'react';
import { Star, Trophy } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTime } from '../format';
import { solvedEquations } from '../board/grid';
import { useGame, useProfile } from '../storeTypes';
import { Modal } from './Modal';

interface Props {
  onClose: () => void;
}

/** Win-count milestones, derived from the stored stats.wins. */
const MILESTONES = [
  { wins: 1, label: 'First win' },
  { wins: 3, label: '3 wins' },
  { wins: 10, label: '10 wins' },
];

const CONFETTI_COLORS = ['var(--accent)', 'var(--star)', 'var(--ok)', 'var(--wrong)'];
/** Fixed pattern (no randomness) so the burst is the same on every render. */
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  x: `${(i * 37) % 100}%`,
  dx: `${((i * 53) % 120) - 60}px`,
  rot: `${(i * 97) % 720}deg`,
  dur: `${(1.6 + (i % 5) * 0.2).toFixed(1)}s`,
  delay: `${(i % 6) * 80}ms`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

export function VictoryModal({ onClose }: Props) {
  const game = useGame();
  const profile = useProfile();
  const timerVisible = useAppStore((s) => s.settings.timerVisible);
  if (!game) return null;

  const stars = solvedEquations(game.puzzle, game.entries).length;
  const wins = profile?.stats.wins ?? 0;
  const badges = MILESTONES.filter((m) => wins >= m.wins);

  return (
    <Modal title="Puzzle solved" onClose={onClose}>
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div aria-hidden="true" className="confetti">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={
                {
                  '--x': p.x,
                  '--dx': p.dx,
                  '--rot': p.rot,
                  '--dur': p.dur,
                  '--delay': p.delay,
                  '--c': p.color,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <Trophy size={48} className="text-accent" aria-hidden="true" />
        <div className="flex flex-wrap justify-center gap-1 text-star" aria-label={`${stars} stars earned`}>
          {Array.from({ length: stars }, (_, i) => (
            <Star
              key={i}
              size={24}
              className="star-pop fill-star"
              style={{ '--delay': `${i * 80}ms` } as CSSProperties}
              aria-hidden="true"
            />
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-4">
          {timerVisible && (
            <div>
              <dt className="text-sm text-muted">Time</dt>
              <dd className="text-xl font-bold tabular-nums">{formatTime(game.elapsedMs)}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted">Score</dt>
            <dd className="text-xl font-bold tabular-nums">{game.score}</dd>
          </div>
        </dl>
        {badges.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Badges">
            {badges.map((b) => (
              <li key={b.wins} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-fg">
                {b.label}
              </li>
            ))}
          </ul>
        )}
        <div className="flex w-full gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-surface-2 font-semibold">
            View board
          </button>
          <button
            type="button"
            onClick={() => useAppStore.getState().newGame()}
            className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-accent-fg"
          >
            Next puzzle
          </button>
        </div>
      </div>
    </Modal>
  );
}
