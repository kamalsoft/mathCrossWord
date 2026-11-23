import { useState } from 'react';
import { Compass, CircleHelp, LogOut, Menu, Pause, Play, Settings, X } from 'lucide-react';
import { TIERS } from '../../engine/tierConfig';
import { MISTAKE_LIMIT, useAppStore } from '../../store/useAppStore';
import { formatTime } from '../format';
import { useGame, useProfile } from '../storeTypes';

interface Props {
  onOpen: (m: 'settings' | 'help' | 'tour') => void;
}

const ICON_BTN = 'grid size-11 place-items-center rounded-full text-fg transition hover:bg-surface-2';
const MENU_ITEM = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-surface-2';

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
  const [menuOpen, setMenuOpen] = useState(false);
  if (!profile || !game) return null;

  const onLogout = () => {
    if (window.confirm(`Switch player? ${profile.name}'s game is saved and will resume the next time they log in.`)) {
      useAppStore.getState().switchUser();
    }
  };

  // One list drives both the desktop icon row and the phone/tablet menu.
  const actions = [
    { label: 'Tour', icon: Compass, run: () => onOpen('tour') },
    { label: 'Help and FAQ', icon: CircleHelp, run: () => onOpen('help') },
    { label: 'Settings', icon: Settings, run: () => onOpen('settings') },
    { label: 'Switch player', icon: LogOut, run: onLogout },
  ];

  const pick = (run: () => void) => {
    setMenuOpen(false);
    run();
  };

  return (
    <header data-tour="header" className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-extrabold">Math CrossWord</h1>

        {/* Desktop and large tablets: icons in a row. */}
        <div className="hidden lg:flex">
          {actions.map(({ label, icon: Icon, run }) => (
            <button key={label} type="button" aria-label={label} className={ICON_BTN} onClick={run}>
              <Icon size={22} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Phones and tablets below 1024px: the same actions in a menu. */}
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="header-menu"
          className={`${ICON_BTN} lg:hidden`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav
            id="header-menu"
            aria-label="Game menu"
            className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-line bg-surface p-1 shadow-lg lg:hidden"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMenuOpen(false);
            }}
          >
            {actions.map(({ label, icon: Icon, run }) => (
              <button key={label} type="button" className={MENU_ITEM} onClick={() => pick(run)}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </>
      )}

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
            Mistakes {Math.min(game.mistakes, MISTAKE_LIMIT)}/{MISTAKE_LIMIT}
          </span>
        )}
      </div>
    </header>
  );
}
