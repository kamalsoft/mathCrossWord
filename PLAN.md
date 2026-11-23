# Math CrossWord — Build Plan

Source of truth: `CLAUDE.md`. Where it is silent, the decisions below were made with the user (answers recorded) or are flagged as **[DECISION]** for review.

## 1. Confirmed requirements (from user answers)

| Topic | Decision |
| --- | --- |
| Scope this round | Plan + agent team + full app build |
| Age tiers in v1 | All four: Junior Explorer, Elementary, Middle & Teen, Adult & Master |
| Skills | Keep 13 dev-relevant skills in `.claude/skills` (rlm-web-* ×7, rlm-code-review, rlm-test-gap-analysis, rlm-security-audit, rlm-privacy-review, rlm-release-notes, rlm-refactor-planner). 399 others deleted (unstaged in git). |
| Spec file | Renamed `Claude.md` → `CLAUDE.md` |
| Git / deploy | No commit, no Pages setup yet. Repo already exists with one commit (`4b3de2f first commit`). |
| Tier label | "Adult & Master" everywhere, including the Settings dropdown |
| Theme default | Follow system (`prefers-color-scheme`) |
| Logout | Save the active game per profile; warn before switching |
| Mistake limit (3 strikes) | Configurable in Settings; the player chooses one of three behaviours (see §4) |
| Hints | Configurable in Settings: 3 per game, tier-based (Junior 5 / Elementary 3 / Middle 2 / Adult 1), or unlimited |
| Scoring | Points for correct cells and completed equations, plus a speed bonus; streak counts consecutive wins |
| Notes (pencil marks) | Available in every tier |
| Uniqueness | Every generated puzzle has exactly one solution, in every tier |
| Auto-check | Off by default |
| Mistake limit default | Off by default (see §4 for the reading I took) |
| Number Bank | On by default for Junior; toggle in Settings for all tiers |

## 2. Stack

- React 19 (`react@19.3.1`), TypeScript, Vite (`vite@8.3.8`)
- Tailwind CSS v4 (`tailwindcss@4.3.5`, `@tailwindcss/vite@4.3.5`)
- Lucide React (`lucide-react@1.78.0`)
- Zustand (`zustand@5.1.0`) with `persist` middleware (localStorage)
- Vitest (`vitest@5.1.1`) for engine tests
- Web Audio API for sound (no audio files)
- Node 22 is installed locally.

Exact pinned versions go in `package.json`. Nothing is published or deployed.

## 3. Folder structure

Follows the structure in `CLAUDE.md` §5, with one addition: `src/engine/solver.ts` for the uniqueness solver. `CLAUDE.md` describes the solver as the "Uniqueness & Solvability Verifier", so the code gets its own file.

## 4. Engine rules (hard requirements)

**Tiers** (age → tier): 5–7 Junior · 8–10 Elementary · 11–15 Middle · 16+ Adult. Max age 120.

| Tier | Grid | Equations | Operators | Operands / results | Clue ratio (prefilled) |
| --- | --- | --- | --- | --- | --- |
| Junior | 5×5 | 3–4 | `+ −` | 1–9; result ≤ 18 | ~60% |
| Elementary | 7×7 | 6–8 | `+ − ×` | 1–12; result ≤ 100 | ~45% |
| Middle & Teen | 9×9 | 10–14 | `+ − × ÷`, multi-step | multi-digit cells | ~35% |
| Adult & Master | 11×11 | 16+ | all four, two-step, `?` operator cells | up to 250 | ~25% |

Global guardrails (from `CLAUDE.md` §6):
- Division: `B ≠ 0` and `A % B === 0` for every division.
- Intersection cells hold numbers only (never an operator or `=`).
- Multi-digit cells allowed (up to 3 digits) in Middle and Adult; Junior and Elementary keep the spec's ranges.
- **[DECISION]** No negative intermediate or final values in any tier. The spec only names ages 5–12, and I have applied the rule to all tiers for simplicity.
- **Uniqueness**: a solver counts solutions for the clued grid; the puzzle is accepted only if the count is exactly 1. Generation retries on failure.

**[DECISION] 3-strike mistake limit**: The user chose "decide based on the settings", so Settings offers three behaviours — *Game over (restart allowed)*, *Warning only*, *Lose streak only* — and the limit toggle defaults to off. Please confirm this reading.

**[DECISION] Hint allowance**: Settings lets the player choose *3 per game*, *tier-based*, or *unlimited*. Default is *3 per game*.

**[DECISION] Scoring constants**: 10 points per correct cell, 25 per completed equation, speed bonus = `max(0, 300 − seconds)`. Streak increments on each win and resets on a loss.

**[DECISION] Profiles**: Profiles are keyed by name (case-insensitive). Entering a name that already exists resumes that profile and its saved game. This supports "multiple kids share one browser".

## 5. Agent team

| # | Agent | Owns | Depends on | Done when |
| --- | --- | --- | --- | --- |
| 0 | **Lead (me)** | Scaffold, `package.json`, Vite/TS/Tailwind/Vitest config, `src/engine/types.ts`, `src/engine/tierConfig.ts`, `src/store/useAppStore.ts` contract | — | `npm run build` and `npm test` run on an empty suite |
| 1 | **engine-agent** | `src/engine/puzzleGenerator.ts`, `evaluator.ts`, `solver.ts`, `tests/puzzleGenerator.test.ts` | types.ts, tierConfig.ts | 100+ boards per tier pass; uniqueness holds; every division is exact; intersections match |
| 2 | **state-agent** | `src/store/useAppStore.ts` (userSlice, gameSlice, settingsSlice, statsSlice), `src/utils/sound.ts`, store tests | types.ts, engine API | Persist works; per-profile save; undo, notes, hints, mistake modes, scoring all tested |
| 3 | **ui-agent** | All of `src/components/**`, `App.tsx`, `main.tsx`, `index.css` | store API, engine API | Every feature in `CLAUDE.md` §2 is reachable; 44px touch targets; phone width with no horizontal scroll |
| 4 | **qa-agent** | Reviews the combined output; runs typecheck, tests, build; checks the spec checklist (§7) item by item | all | Reports pass/fail per checklist item with evidence |

Agents 1–3 run in parallel after Agent 0 finishes the contracts. Agent 4 runs last. Agents do not commit to git.

## 5a. Project skills (loaded)

Six skills were added to `.claude/skills` after the cleanup. How each is used:

| Skill | Use in this build |
| --- | --- |
| `local-test-runner` | Used by qa-agent for Vitest runs. Targeted test files first, full suite last. No Docker or services are needed. |
| `stack-auditor` | Used by qa-agent on `package.json`, `vite.config.ts`, `tsconfig.json` and env handling; checks syntax and secret leaks. |
| `doc-syncer` | Used at the end to write the README setup and run steps. |
| `token-saver` | Applies to chat replies only, not to code or docs. |
| `rlm` | Not needed. The codebase is small; it is for large-scale audits. |
| `trust-layer-validator` | Not applicable: the app has no decentralized identity, credentials or agent-to-agent messaging. **[QUESTION]** Keep it or remove it? |

## 6. Work order

1. **Lead**: scaffold and contracts (`types.ts`, `tierConfig.ts`, store signatures).
2. **Parallel**: engine-agent, state-agent, ui-agent.
3. **Integration**: fix type mismatches, wire `App.tsx`.
4. **qa-agent**: full review against §7.
5. Report to the user. Stop there. No commit, no deploy.

## 7. Acceptance checklist

- [ ] Onboarding modal: name 2–20 chars, age 5–120, auto-tier assignment
- [ ] Profiles persist; returning users skip onboarding
- [ ] Logout/Switch User warns and saves the active game per profile
- [ ] 5-step tour, re-launchable from Help
- [ ] Header: title, `Name • Tier`, timer (pause/resume overlay), mistakes `0/3` when on, Tour / Help / Settings / Logout
- [ ] Sub-bar: difficulty dropdown, New Game, score and streak
- [ ] Grid: playable, prefilled, operator/`=`, void cells; selecting highlights the active cell and its equations and matching numbers
- [ ] Control bar: Undo, Erase, Notes, Check, Hint (with remaining count)
- [ ] Number pad 0–9, operators enabled only where operator cells are blank (Adult), Enter/Next
- [ ] Number Bank for Junior by default; strikethrough as numbers are placed
- [ ] Keyboard: 0–9, Backspace, Delete, Tab, arrows, N for notes; multi-digit append up to 3 digits
- [ ] Help modal (PEMDAS/BODMAS, intersection logic, shortcuts, Restart Tour); FAQ accordion with the four spec questions
- [ ] Settings: difficulty override, assists, hint and mistake modes, theme (system default), sound, large font, Reset Statistics, Logout / Clear Profile
- [ ] Victory modal: time, next puzzle
- [ ] Vitest: 100+ generated boards per tier pass; uniqueness holds; divisions exact; intersections consistent

## 7a. Security and privacy (confirmed: local-only app)

- Local-only: no backend, accounts, analytics or network calls. Data stays in `localStorage` under `math-crossword-v1`.
- CSP meta tag in `index.html` (`script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `form-action 'none'`).
- `SECURITY.md` documents what is stored, how to delete it, and the known limits.
- Privacy notice added to the Help modal (ui-agent).
- qa-agent: run `rlm-security-audit` and `rlm-privacy-review` against the finished code, and `stack-auditor` on the config.
- Legal: no jurisdiction was named. Children's-data rules (COPPA, GDPR-K) were not reviewed against legal text; the app's local-only design is the basis for the current treatment.

## 8. Open items

- Confirm the two **[DECISION]** readings in §4 (mistake limit, profile keying).
- Git commit and GitHub Pages setup are deferred until you ask.
