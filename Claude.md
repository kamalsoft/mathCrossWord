# Project Specification: Math CrossWord

Build a complete, production-ready, local-first web application called **Math CrossWord**—an interactive arithmetic crossword puzzle game designed for players aged **5 years and older**. 

Model the visual layout, responsiveness, tactile board interactions, and quality-of-life mechanics after **https://kamalsoft.github.io/sudoku/** (clean centered board, header status bar, integrated number/operator keypad below the grid, and slide-over/modal drawers for secondary views).

---

## 1. Target Audience & Age-Adaptive Difficulty Tiers

Before starting, the app collects the user's **Name** and **Age** (minimum age: `5`) and automatically maps them to a default difficulty tier (which can also be manually overridden in Settings or the New Game selector):

| Tier | Age Group | Grid Size | Operations & Number Ranges | Board Mechanics |
| :--- | :--- | :--- | :--- | :--- |
| **Junior Explorer** | **5 – 7 yrs** | $5 \times 5$ (3–4 interlocking equations) | Addition (`+`) and Subtraction (`-`) only; single-digit operands ($1\text{–}9$), positive results $\le 18$. | High pre-filled clue ratio (~60%); number bank pills available for drag/tap-to-fill. |
| **Elementary** | **8 – 10 yrs** | $7 \times 7$ (6–8 interlocking equations) | `+`, `-`, and basic Multiplication (`×`); operands $1\text{–}12$, results $\le 100$. | Medium clue ratio (~45%); optional pencil-mark notes. |
| **Middle & Teen** | **11 – 15 yrs** | $9 \times 9$ (10–14 interlocking equations) | `+`, `-`, `×`, and exact integer Division (`÷`); multi-step chained equations ($A + B \times C = D$ honoring order of operations). | Lower clue ratio (~35%); multi-digit inputs allowed in cells. |
| **Adult & Master** | **16+ yrs** | $11 \times 11$ (16+ interlocking equations) | All four operators (`+`, `-`, `×`, `÷`), two-step equations, larger integers (up to $250$), and missing operator cells (`?`) alongside missing numbers. | Minimal clue ratio (~25%); strict mistake limits (optional) and speed/streak scoring. |

---

## 2. Core Functional Requirements

### A. Onboarding, Persistence & Session Management
* **First-Visit Gate (Profile Setup Modal):** On initial launch (when no profile exists in `localStorage`), display a clean, welcoming modal requiring:
  * **Player Name** (text input, 2–20 chars).
  * **Player Age** (numeric stepper or input, `5` to `120`).
  * Automatically assign the matching Age Tier upon submission.
* **Browser Persistence:** Save user profile (`name`, `age`, `tier`, `hasCompletedTour`), active board state, game history, statistics, and preferences in browser `localStorage` (backed by Zustand persist middleware or SQLite/IndexedDB WASM if offline sync is enabled). Returning users bypass onboarding and resume directly.
* **Logout / Switch Player:** Accessible from the top header profile badge or Settings menu. Clicking **Logout / Switch User** prompts confirmation (warning if an active game will be cleared or saved per profile) and returns to the Onboarding modal.

### B. Interactive First-Time App Tour
* Triggered automatically right after initial onboarding (and re-launchable anytime from **Help**).
* Implement a lightweight spotlight/step-by-step coachmark overlay (5 steps):
  1. **The Grid:** How horizontal (Across) and vertical (Down) math equations intersect at shared cells.
  2. **Selecting & Inputting:** Tapping an empty cell highlights its intersecting equation(s); use the on-screen keypad or physical keyboard (`0–9`, `Backspace`, `Arrow keys`).
  3. **Smart Tools:** Using **Notes (Pencil Mode)** for candidate numbers, **Undo**, **Erase**, and **Hint**.
  4. **Validation:** Toggleable real-time error highlighting vs. end-of-puzzle check.
  5. **Header Controls:** Accessing **Settings**, **Help/FAQ**, and **Switch Player**.

### C. Gameplay Mechanics & Sudoku-Inspired UX
* **Board Layout (Mirrors `kamalsoft.github.io/sudoku`):**
  * **Top Bar:** App title, active player badge (`Name • Age Tier`), Timer (`MM:SS` with Pause/Resume overlay), Mistake counter (`0/3` when enabled), and icon buttons for **Tour**, **Help/FAQ**, **Settings**, and **Logout**.
  * **Sub-Bar:** Difficulty selector dropdown, **New Game** button, and current score/streak indicator.
  * **Center Canvas:** Responsive square-aspect CSS Grid rendering playable white cells, locked pre-filled clue cells (distinct subtle tint/bold font), operator/equals cells (`+`, `-`, `×`, `÷`, `=`), and solid dark/void blocker tiles.
  * **Cell Highlighting:** Selecting a cell highlights the active cell in primary accent color, highlights the entire horizontal and/or vertical equation(s) it belongs to in a soft tint, and highlights matching numbers across the board.
  * **Control Pad (Below Grid):**
    * Action bar: **Undo**, **Erase**, **Notes (On/Off)**, **Check**, **Hint** (with remaining hint badge).
    * Numeric Keypad (`0–9`) + operator keys (`+`, `-`, `×`, `÷` enabled only in Master tier when operator cells are blank) + `Enter/Next` button.
    * **Junior Explorer Mode Enhancement:** Display a clickable/draggable **"Available Numbers Bank"** pill tray showing the exact pool of numbers needed to complete the puzzle (with strikethrough as each is placed).

### D. Help, FAQ & Settings Modals
* **Help & How-to-Play Modal:** Visual guide explaining order of operations (PEMDAS/BODMAS), intersection logic, keyboard shortcuts, and a **"Restart Interactive Tour"** button.
* **FAQ Accordion:** Answers common questions (e.g., *"How does age affect puzzles?"*, *"Where is my progress saved?"*, *"How is order of operations evaluated?"*, *"Can multiple kids share one browser?"*).
* **Settings Drawer/Modal:**
  * **Difficulty Override:** Auto (by Age) or Manual (`Junior`, `Elementary`, `Middle`, `Master`).
  * **Gameplay Assists:** Toggle *Auto-Check Mistakes*, *Mistake Limit (3 strikes)*, *Highlight Intersecting Equations*, *Show Number Bank (for younger players)*, and *Timer Visibility*.
  * **Accessibility & Theme:** Light / Dark mode toggle (defaulting to clean high-contrast dark/light matching the Sudoku reference), Sound Effects toggle (Web Audio API gentle chimes—no external MP3 dependencies), and Large Font / Kid-Friendly UI scale toggle.
  * **Danger Zone:** *Reset Statistics* and *Logout / Clear Profile*.

---

## 3. Recommended Tech Stack

* **Framework:** React 19 + TypeScript + Vite (fast static SPA build deployable directly to GitHub Pages).
* **Styling & UI:** Tailwind CSS v4 + Lucide React icons (clean, crisp vector iconography).
* **State Management & Persistence:** Zustand with `persist` middleware (`localStorage`).
* **Puzzle Engine:** Pure TypeScript procedural generator & constraint solver (zero backend required; runs instantaneously in-browser).
* **Audio Feedback:** Native browser Web Audio API synthesizer for subtle tap, error, and victory chimes.
* **Testing:** Vitest for puzzle generator mathematical validity and intersection verification.

---

## 4. Project Architecture
+-------------------------------------------------------------------+
|                        Presentation Layer                         |
|  (Header, CrossWordGrid, NumberPad, NumberBank, Modals, AppTour)  |
+---------------------------------+---------------------------------+
| Actions & Selectors
+---------------------------------v---------------------------------+
|                     State Management (Zustand)                    |
|  - userSlice (name, age, tier, tourCompleted, login/logout)       |
|  - gameSlice (grid, equations, history/undo, notes, timer, hints) |
|  - settingsSlice (theme, autoCheck, sound, numberBank, tierLock)  |
|  - statsSlice (gamesPlayed, winStreak, bestTimesByTier)           |
+---------------------------------+---------------------------------+
| Pure Functions
+---------------------------------v---------------------------------+
|                    Core Math Puzzle Engine (TS)                   |
|  1. Template / Graph Builder (interlocking H & V equation slots)  |
|  2. Constraint Solver (validates integer division & PEMDAS rules) |
|  3. Clue Masker (carves blanks based on age-tier density)         |
|  4. Uniqueness & Solvability Verifier                             |
+-------------------------------------------------------------------+

---

## 5. Folder Structure

```text
math-crossword/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── board/
│   │   │   ├── CrossWordGrid.tsx       # Responsive CSS grid & cell rendering
│   │   │   ├── GridCell.tsx            # Value, clue, operator, void, & pencil notes
│   │   │   ├── ControlBar.tsx          # Undo, Erase, Notes, Hint, Check
│   │   │   ├── NumberPad.tsx           # On-screen 0-9 & operator keypad
│   │   │   └── NumberBank.tsx          # Tap-to-place answer pool (Age 5-7 / assist)
│   │   ├── layout/
│   │   │   ├── Header.tsx              # Title, player pill, timer, modal triggers
│   │   │   └── SubHeader.tsx           # Difficulty badge, New Game, mistakes, score
│   │   ├── modals/
│   │   │   ├── OnboardingModal.tsx     # Name & Age entry gate
│   │   │   ├── SettingsModal.tsx       # Theme, assists, difficulty override, logout
│   │   │   ├── HelpFaqModal.tsx        # Rules, shortcuts, FAQ accordion, tour trigger
│   │   │   └── VictoryModal.tsx        # Completion summary, time, next puzzle CTA
│   │   └── tour/
│   │       └── AppTourOverlay.tsx      # 5-step spotlight walkthrough
│   ├── engine/
│   │   ├── types.ts                    # Cell, Equation, Grid, TierConfig interfaces
│   │   ├── tierConfig.ts               # Age-to-difficulty rules & number ranges
│   │   ├── puzzleGenerator.ts          # Interlocking crossword equation generator
│   │   └── evaluator.ts                # Safe PEMDAS equation & board validator
│   ├── store/
│   │   └── useAppStore.ts              # Persisted Zustand store (profile, game, settings)
│   ├── utils/
│   │   └── sound.ts                    # Lightweight Web Audio API feedback
│   ├── App.tsx                         # Main layout shell & keyboard listeners
│   ├── main.tsx                        # Entry point
│   └── index.css                       # Tailwind directives & custom cell animations
├── tests/
│   └── puzzleGenerator.test.ts         # Validates 100+ generated boards per age tier
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
6. Key Implementation Guardrails for the GeneratorExact Integer Arithmetic Only: Every division operation (A ÷ B) generated by puzzleGenerator.ts must satisfy A % B === 0 and B !== 0. Avoid negative intermediate or final values for ages 5–12.Intersection Integrity: Shared intersection cells must strictly hold numeric values (never operators or =) so intersecting equations naturally constrain each other like a real crossword.Multi-Digit Cell Support: Unlike Sudoku (single digit 1–9), a Math CrossWord cell can hold a multi-digit number (e.g., 12 or 144). Typing digits while a cell is focused appends digits (up to 3 digits) until Backspace is pressed or focus moves to the next empty cell.Zero-Friction Keyboard & Touch UX: Support physical keyboard typing (0–9, Backspace, Delete, Tab, ArrowUp/Down/Left/Right, N to toggle notes) alongside mobile-first touch targets ($\ge 44\text{px}$).
---

If you would like, I can immediately scaffold the **Core Math Puzzle Engine (`puzzleGenerator.ts` & `evaluator.ts`)** or build an interactive prototype right here.