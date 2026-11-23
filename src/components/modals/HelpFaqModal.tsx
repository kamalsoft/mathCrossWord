import { Modal } from './Modal';

interface Props {
  onClose: () => void;
  onRestartTour: () => void;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does age affect puzzles?',
    a: 'Your age picks a starting level: 5 to 7 is Junior Explorer, 8 to 10 is Elementary, 11 to 15 is Middle & Teen, and 16 and over is Adult & Master. Higher levels have bigger grids, more operators and fewer clues. You can change the level in Settings at any time.',
  },
  {
    q: 'Where is my progress saved?',
    a: 'On this device only, in the browser’s localStorage. Nothing is sent to a server. Clearing the site’s data in your browser erases it.',
  },
  {
    q: 'How is order of operations evaluated?',
    a: 'Equations follow PEMDAS (BODMAS in the UK). Brackets come first, then multiplication and division from left to right, then addition and subtraction from left to right. So 2 + 3 × 4 = 14, not 20.',
  },
  {
    q: 'Can multiple kids share one browser?',
    a: 'Yes. Each name is its own profile with its own saved game and statistics. Use Switch player in the header to change players. Entering a name that already exists resumes that profile.',
  },
];

export function HelpFaqModal({ onClose, onRestartTour }: Props) {
  return (
    <Modal title="Help and FAQ" onClose={onClose}>
      <div className="flex flex-col gap-5 text-sm leading-relaxed">
        <section className="flex flex-col gap-2">
          <h3 className="font-bold">How to play</h3>
          <p>
            Each row (Across) and column (Down) is a math equation. Where two equations cross, the cell is shared: its
            number has to make both equations true. Fill every white cell.
          </p>
          <p>
            Order of operations: brackets, then multiplication and division (left to right), then addition and subtraction
            (left to right).
          </p>
          <button
            type="button"
            onClick={onRestartTour}
            className="min-h-11 rounded-xl bg-accent font-semibold text-accent-fg"
          >
            Restart Interactive Tour
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-bold">Keyboard shortcuts</h3>
          <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <li><kbd>0</kbd>–<kbd>9</kbd></li><li>Type a number (up to 3 digits)</li>
            <li><kbd>Backspace</kbd></li><li>Delete the last digit</li>
            <li><kbd>Delete</kbd></li><li>Erase the cell</li>
            <li><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd></li><li>Next / previous cell</li>
            <li><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></li><li>Move the selection</li>
            <li><kbd>N</kbd></li><li>Toggle notes (pencil marks)</li>
            <li><kbd>Enter</kbd></li><li>Next empty cell</li>
            <li><kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd></li><li>Operator cells (Adult &amp; Master)</li>
            <li><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd></li><li>Undo</li>
            <li><kbd>Esc</kbd></li><li>Clear the selection</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-bold">Privacy</h3>
          <p>
            All data (name, age, progress, settings) stays on this device in browser localStorage. Nothing is sent to a
            server.
          </p>
          <p>
            To delete it, use Settings, then Logout / Clear Profile, or Reset Statistics to clear only the statistics.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-bold">Frequently asked questions</h3>
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-xl bg-surface-2 px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">{item.q}</summary>
              <p className="pb-2 text-muted">{item.a}</p>
            </details>
          ))}
        </section>
      </div>
    </Modal>
  );
}
