import { useEffect, useRef, useState } from 'react';
import type { Operator } from './engine/types';
import { useAppStore } from './store/useAppStore';
import { getGame, useGame, useProfile } from './components/storeTypes';
import { Header } from './components/layout/Header';
import { SubHeader } from './components/layout/SubHeader';
import { CrossWordGrid } from './components/board/CrossWordGrid';
import { ControlBar } from './components/board/ControlBar';
import { NumberPad } from './components/board/NumberPad';
import { NumberBank } from './components/board/NumberBank';
import { goNext, selectPos } from './components/board/actions';
import { stepTo, tabTo } from './components/board/grid';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { HelpFaqModal } from './components/modals/HelpFaqModal';
import { VictoryModal } from './components/modals/VictoryModal';
import { AppTourOverlay } from './components/tour/AppTourOverlay';
import { showNumberBank } from './store/useAppStore';
import { playError, playTap, playWin } from './utils/sound';

type ModalName = 'settings' | 'help';

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};
const OP_KEYS: Record<string, Operator> = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷' };

export default function App() {
  const profile = useProfile();
  const game = useGame();
  const settings = useAppStore((s) => s.settings);
  const [modal, setModal] = useState<ModalName | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [victoryDismissedFor, setVictoryDismissedFor] = useState<string | null>(null);
  const prevGame = useRef(game);

  const hasProfile = !!profile;
  const needsTour = !!profile && !profile.hasCompletedTour;
  const keysBlocked = !hasProfile || modal !== null || tourOpen;

  useEffect(() => {
    if (needsTour) setTourOpen(true);
  }, [needsTour]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('large-font', settings.largeFont);
  }, [settings.largeFont]);

  useEffect(() => {
    if (!hasProfile) return;
    const id = window.setInterval(() => useAppStore.getState().tick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasProfile]);

  // Sound cues follow state changes, so the store stays free of audio concerns.
  useEffect(() => {
    const prev = prevGame.current;
    prevGame.current = game;
    if (!game || !prev || !settings.sound || prev.puzzle.id !== game.puzzle.id) return;
    if (game.status === 'won' && prev.status !== 'won') playWin();
    else if (game.mistakes > prev.mistakes) playError();
    else if (game.entries !== prev.entries) playTap();
  }, [game, settings.sound]);

  useEffect(() => {
    if (keysBlocked) return;
    const onKey = (e: KeyboardEvent) => {
      const st = useAppStore.getState();
      const g = getGame();
      if (!g || g.paused || g.status !== 'playing') return;
      if ((e.target as Element).closest?.('input, textarea, select')) return;
      // Tab is left to the browser (cells are focusable buttons in reading order), so focus can leave the board.
      const onCell = !!(e.target as Element).closest?.('[data-cell]');

      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          st.undo();
        }
        return;
      }

      const { puzzle, selected } = g;
      const arrow = ARROWS[e.key];
      const op = OP_KEYS[e.key];
      let handled = true;
      if (/^[0-9]$/.test(e.key)) st.inputDigit(Number(e.key));
      else if (e.key === 'Backspace') st.backspace();
      else if (e.key === 'Delete') st.erase();
      else if (arrow) selectPos(selected ? stepTo(puzzle, selected, arrow[0], arrow[1]) : tabTo(puzzle, null, false));
      else if (e.key === 'Enter') {
        // Only on a grid cell: elsewhere Enter activates the focused button (Hint, Check, Settings).
        if (!onCell) return;
        goNext();
      }
      else if (e.key === 'Escape') st.clearSelection();
      else if (e.key === 'n' || e.key === 'N') st.toggleNotes();
      else if (op && selected && puzzle.grid[selected.row][selected.col].type === 'operator') st.inputOperator(op);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keysBlocked]);

  if (!profile) {
    return <main className="min-h-dvh"><OnboardingModal /></main>;
  }
  // A profile with no game means puzzle generation failed; offer a retry instead of a blank screen.
  if (!game) {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-semibold">We could not make a puzzle this time.</p>
          <button
            type="button"
            onClick={() => useAppStore.getState().newGame()}
            className="min-h-11 rounded-xl bg-accent px-5 font-bold text-accent-fg shadow-sm active:scale-95"
          >
            Try a new puzzle
          </button>
        </div>
      </main>
    );
  }

  const showBank = showNumberBank(settings, game.puzzle.tier);
  const showOperators = game.puzzle.grid.some((row, r) =>
    row.some((cell, c) => cell.type === 'operator' && !cell.given && game.entries[r][c] == null),
  );
  const showVictory = game.status === 'won' && victoryDismissedFor !== game.puzzle.id;

  return (
    <main className="flex min-h-dvh flex-col bg-bg text-fg">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:max-w-[1120px]">
        <Header onOpen={(m) => (m === 'tour' ? setTourOpen(true) : setModal(m))} />
        <SubHeader />
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <CrossWordGrid
              game={game}
              autoCheck={settings.autoCheck}
              showWrong={settings.autoCheck || game.checked}
              highlightEquations={settings.highlightEquations}
            />
          </div>
          <div className="flex flex-col gap-3">
            <ControlBar />
            {showBank && <NumberBank game={game} />}
            <NumberPad showOperators={showOperators} />
          </div>
        </div>
      </div>
      <footer className="border-t border-line px-4 py-3 text-center text-xs text-muted">
        Math CrossWord is a practice game for fun and learning. Puzzles are made on this device, and progress is kept only in this browser; nothing is sent to a server. Children should play with an adult nearby. Results are not an assessment of ability.
      </footer>

      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'help' && (
        <HelpFaqModal
          onClose={() => setModal(null)}
          onRestartTour={() => {
            setModal(null);
            setTourOpen(true);
          }}
        />
      )}
      {showVictory && <VictoryModal onClose={() => setVictoryDismissedFor(game.puzzle.id)} />}
      {tourOpen && (
        <AppTourOverlay
          onClose={() => {
            useAppStore.getState().markTourDone();
            setTourOpen(false);
          }}
        />
      )}
    </main>
  );
}
