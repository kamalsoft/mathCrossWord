import { Compass, CircleHelp, LogOut, Pause, Play, Settings } from 'lucide-react';
import { TIERS } from '../../engine/tierConfig';
import { MISTAKE_LIMIT, useAppStore } from '../../store/useAppStore';
import { formatTime } from '../format';
import { useGame, useProfile } from '../storeTypes';

interface Props {
  onOpen: (m: 'settings' | 'help' | 'tour') => void;
}

const ICON_BTN = 'grid size-11 place-items-center rounded-full text-fg transition hover:bg-surface-2';

/** Own subscription, so the 1-second tick re-renders only this readout. */
function Clock() {
  const game = useGame();
  return game ? <span className="font-semibold tabular-nums">{formatTime(game.elapsedMs)}</span> : null;
}

export function Header({ onOpen }: Props) {
  const profile = useProfile();
  const game = useGame();
  const timerVisible = useAppStore((s) => s.settings.timerVisible);
  const mistakeLimit = useAppStore((s) => s.settings.mistakeLimit);
  if (!profile || !game) return null;

  const onLogout = () => {
    if (window.confirm(`Switch player? ${profile.name}'s game is saved and will resume the next time they log in.`)) {
      useAppStore.getState().switchUser();
    }
  };

  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-extrabold">Math CrossWord</h1>
        <div className="flex">
          <button type="button" aria-label="Tour" className={ICON_BTN} onClick={() => onOpen('tour')}>
            <Compass size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Help and FAQ" className={ICON_BTN} onClick={() => onOpen('help')}>
            <CircleHelp size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Settings" className={ICON_BTN} onClick={() => onOpen('settings')}>
            <Settings size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Switch player" className={ICON_BTN} onClick={onLogout}>
            <LogOut size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="min-w-0 truncate rounded-full bg-surface px-3 py-1 font-semibold shadow-sm">
          {profile.name} • {TIERS[profile.tier].label}
        </span>
        <div className="flex items-center gap-1">
          {timerVisible && <Clock />}
          <button
            type="button"
            aria-label={game.paused ? 'Resume timer' : 'Pause timer'}
            className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
            onClick={() => useAppStore.getState().togglePause()}
          >
            {game.paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
        </div>
        {mistakeLimit && (
          <span className="font-semibold tabular-nums">
            Mistakes {game.mistakes}/{MISTAKE_LIMIT}
          </span>
        )}
      </div>
    </header>
  );
}
