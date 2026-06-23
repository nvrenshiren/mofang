<div align="center">

# 🧊 Cubelab

**A WCA notation practice playground in your browser · speedcubing timer · multi-size cube simulator**

Supports 2×2 through 7×7 NxN cubes · WCA-standard scrambles · keymaps tailored for CFOP / Roux / ZZ · Challenge mode with 15s inspection + Ao5/Ao12

[![CI](https://github.com/nvrenshiren/mofang/actions/workflows/ci.yml/badge.svg)](https://github.com/nvrenshiren/mofang/actions/workflows/ci.yml)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-r170-000000?logo=three.js&logoColor=white)](https://threejs.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/tests-271%20passing-success)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

**English** · [中文](./README.md)

</div>

<p align="center">
  <img src="./screenshot.jpg" alt="Cubelab — initial view in 3x3 training mode" width="900">
</p>

---

## ✨ Features

- 🎲 **Six WCA cube sizes**: 2×2 / 3×3 / 4×4 / 5×5 / 6×6 / 7×7
- 🎨 **Dark-studio 3D rendering**: Three.js r170 with chamfered cubies, raised stickers, key/fill/rim lighting, and a reverse-camera picture-in-picture for the hidden faces
- ⌨️ **Per-puzzle keymaps**: tailored to WCA rules and real-world solving methods (2×2 uses only R/U/F; odd-N cubes get M/E/S middle slices)
- 📝 **WCA notation parser**: supports `R U R'`, `Rw`, `3Rw`, grouping `(R U R' U')6`, line and block comments
- 🔀 **WCA-compliant scrambles**: per-N rules — 4×4+ includes wide turns, 6×6/7×7 includes 3-layer wide
- 🎯 **Three modes**
  - **Training** — locked WCA orientation, full UI assistance
  - **Free** — orbital camera for casual exploration
  - **Challenge** — competition simulation: 15s inspection → timer → solve detection → local Best / Ao5 / Ao12 history
- 💾 **Persistence**: challenge times (last 100 solves), preferences, current puzzle — all stored in `localStorage`
- 🔊 **Audio feedback**: Web Audio API synthesis for layer clicks, completion chimes, inspection ticks
- 🧪 **Test-first architecture**: 271 unit tests + 8 end-to-end tests; domain layer has zero DOM / Three.js dependencies

## 🚀 Quick Start

```bash
# Install dependencies (requires Node ≥ 20.19)
npm install

# Development server
npm run dev            # → http://localhost:5173

# Production build
npm run build          # tsc type-check + vite production bundle

# Tests
npm test               # 271 vitest unit tests
npm run test:watch     # watch mode
npm run test:e2e       # 12 playwright e2e tests
```

## 🎮 Usage

### Three Modes

| Mode | Camera | UI Assists | Constraints |
|---|---|---|---|
| **Training** | WCA standard locked | All visible | None (undo/redo/reset/scramble all available) |
| **Free** | Mouse-drag orbit | All visible | Same as training |
| **Challenge** | Locked | Assists hidden, scramble hidden during solve | Only "Start / Restart" — no undo, no manual reset |

### Keyboard Shortcuts

**Common to all puzzles**

| Key | Action |
|---|---|
| `Shift + key` | Inverse (prime, `'`) |
| `Alt + key` | Double turn (180°) |
| `;` `[` `-` | Whole-cube rotation: `y` / `x` / `z` |
| `Ctrl + Z` / `Ctrl + Shift + Z` | Undo / Redo (disabled in Challenge) |
| `Esc` | Reset cube (disabled in Challenge) |
| `Space` | Training/Free: scramble; Challenge: start / restart |

**Face keys (size-dependent)**

| Puzzle | Turn keys |
|---|---|
| **2×2** | `r` `u` `f` (sufficient for Ortega/CLL/EG — fix the BLD corner) |
| **3×3 / 5×5 / 7×7** (odd) | `r` `u` `f` `l` `d` `b` + `m` `e` `s` (middle slices for Roux) |
| **4×4 / 6×6** (even) | `r` `u` `f` `l` `d` `b` (no dead-middle slice on even N) |

Wide turns `Rw` / `3Rw` are issued via the **WCA button panel** or the formula input (Shift/Alt are already taken by prime/double, so no keyboard shortcut for wide).

### Notation Examples

```
R U R' U'                          # Sexy move
(R U R' U')6                       # Sexy ×6 returns to solved
R U R' U' R' F R2 U' R' U' R U R' F'   # T-Perm
Rw U2 Rw' U2 Rw U2 Rw'             # 4×4 OLL parity (wide turns)
3Rw U2 3Rw' U' 3Rw U2 3Rw' U      # 5×5 inner-slice algorithm
```

Supports `//` line comments, `/* */` block comments, and comma separators.

## 🧩 Puzzle Matrix

| N | Cubies | Faces used | Scramble depth | Length (WCA) |
|---|---|---|---|---|
| 2×2 | 8 | R U F | Single layer | 11 |
| 3×3 | 26 | R L U D F B | Single layer | 20 |
| 4×4 | 56 | R L U D F B | Single + Rw | 45 |
| 5×5 | 98 | R L U D F B | Single + Rw | 60 |
| 6×6 | 152 | R L U D F B | Single + Rw + 3Rw | 80 |
| 7×7 | 218 | R L U D F B | Single + Rw + 3Rw | 100 |

Common scramble constraints: no two consecutive moves on the same face; no three consecutive moves on the same axis.

## 🏗 Architecture

### Directory Layout

```
src/
├─ main.ts                         # Entry — wires everything together
├─ app.css                         # Tailwind 4 + design tokens via @theme
│
├─ domain/                         # Pure logic (zero DOM/Three.js, fully unit-tested)
│  ├─ puzzles/
│  │  ├─ Puzzle.ts                 # Puzzle<S, M> interface
│  │  ├─ registry.ts               # Puzzle factory registry
│  │  └─ nxn/                      # NxN cube — single codebase for all six sizes
│  │     ├─ NxNState.ts            # 26~218 cubies with position + orientation
│  │     ├─ NxNMoves.ts            # R/L/U/D/F/B + M/E/S + wide + x/y/z
│  │     ├─ NxNParser.ts           # WCA notation parser (groups/comments/wide prefix)
│  │     ├─ NxNScramble.ts         # Per-N WCA-compliant scramble generator
│  │     └─ NxNCube.ts             # Assembles into the Puzzle interface
│  ├─ history/HistoryStack.ts      # Generic undo/redo stack
│  ├─ math/{Mat3,Vec3}.ts          # Integer matrix algebra
│
├─ render/                         # Three.js renderer layer
│  ├─ Stage.ts                     # Scene / camera / lights / dual viewport
│  ├─ CubieMesh.ts                 # Chamfered cubie factory
│  ├─ FreeOrbit.ts                 # Free-mode camera dragging
│  └─ puzzles/NxNCubeRenderer.ts   # Single renderer covering N = 2..7
│
├─ input/
│  ├─ ActionBus.ts                 # Central event bus
│  └─ Keyboard.ts                  # Keyboard → Action (puzzle-aware keymap)
│
├─ store/
│  ├─ AppStore.ts                  # Orchestrates puzzle + renderer + history
│  └─ persistence.ts               # User preference persistence
│
├─ challenge/                      # Challenge-mode feature
│  ├─ ChallengeController.ts       # State machine + timer overlay
│  └─ Times.ts                     # Solve persistence + Ao5/Ao12 computation
│
├─ audio/Sfx.ts                    # Web Audio synthesized SFX
│
└─ ui/                             # DOM components (vanilla TS, no framework)
   ├─ TopBar.ts                    # Top bar + mode switch + puzzle dropdown
   ├─ WcaPanel.ts                  # Floating WCA button panel
   ├─ FormulaInput.ts              # Formula input with live validation
   ├─ LogPanel.ts                  # User move log
   ├─ ScramblePanel.ts             # Current scramble display
   ├─ TimesPanel.ts                # Challenge results (Best / Ao5 / Ao12)
   ├─ SettingsPanel.ts             # Settings popover
   └─ MiniBackView.ts              # Reverse-camera picture-in-picture
```

### Data Flow

```
Keyboard / WCA button / Formula / Code        Puzzle dropdown
        │                                            │
        ▼                                            ▼
   ActionBus.dispatch({type:'move', ...})   ActionBus({type:'puzzle-change'})
        │                                            │
        ▼                                            ▼
                        AppStore
        ├── current Puzzle instance
        ├── current Renderer instance
        ├── HistoryStack (undo stack)
        ├── currentScramble[] (problem, not in history)
        └── mode (training / free / challenge)
                │
        ┌───────┼───────────┬─────────────┐
        ▼       ▼           ▼             ▼
    Renderer  History     Scramble     Mode toggles
    anim queue  stack       panel       show/hide UI
        │
        ▼
    onMoveApplied → ChallengeController.notifyMoveApplied
                        └─ check isSolved → stop timer → push to TimesStore
```

### Core Abstractions

```ts
interface Puzzle<State, Move> {
  meta: PuzzleMeta
  solved(): State
  apply(s: State, m: Move): State
  isSolved(s: State): boolean
  inverseMove(m: Move): Move
  parse(src: string): Move[]
  safeParse(src: string): { ok: true; moves: Move[] } | { ok: false; error: string; index: number }
  format(m: Move): string
  formatMoves(moves: readonly Move[]): string
  generateScramble(opts?: { length?: number; seed?: number }): Move[]
  buttonGroups(): readonly ButtonGroup[]    // WCA button panel content
  keymap(): readonly KeyBinding<Move>[]     // keyboard bindings
}

interface PuzzleRenderer<State, Move> {
  mount(stage: Stage, initialState: State): void
  unmount(): void
  syncToState(state: State): void
  enqueueMove(move: Move, durationMs: number): Promise<void>
  clearQueue(): void
  isBusy(): boolean
  onMoveApplied?: (move: Move) => void
}
```

Any new puzzle only needs to implement these two interfaces and register itself in `PUZZLES` — the UI, input handling, history stack, and timer all wire up automatically.

## 🧪 Testing

```bash
npm test              # vitest unit tests
npm run test:e2e      # playwright e2e tests
npm run test:coverage # coverage report (text + HTML, written to coverage/)
```

**Current coverage** (271 unit tests):

| Metric | % | Notes |
|---|---|---|
| Lines | 51 | UI/render largely not unit-tested, covered indirectly by e2e |
| Branches | 90 | Covered code paths are thoroughly branch-tested |
| Functions | 84 | |
| Statements | 51 | Same story as lines |

`domain/` mostly 90%+; `input/` `store/` `challenge/` 80%+; `ui/` and `render/` mostly 0% (see review #10, planned).

| Category | Count | Coverage |
|---|---|---|
| Mat3 / Vec3 math | 7 | Integer matrix algebra |
| NxN moves + cycles + Sexy + T-Perm + middle slices | 87 | Six values of N × multiple move types |
| NxN scramble rules (per-N) | 19 | 2×2 face restriction + even-N has no dead-middle + scramble lengths |
| NxN keymap stratification | 10 | 2×2 / even / odd tiers |
| Puzzle interface contract | 66 | 11 invariants × 6 puzzles |
| Generic history stack | 4 | Undo/redo |
| Renderer animation axis / angle regression | 11 | M/E/S no longer fall back to Z axis |
| Keyboard `handleKeyboardEvent` pure function | 25 | Turn keys + system keys + challenge silencing + guards |
| ChallengeController state machine | 22 | 5-state transitions + 15s countdown + double-click guard |
| AppStore orchestration | 20 | All 7 Action branches + puzzle switching |
| **Unit subtotal** | **271** | |
| E2E: 6 puzzles × { render, scramble, reset } | 6 | |
| E2E: puzzle switching leaves no orphan meshes | 1 | |
| E2E: keyboard `R` + `Ctrl+Z` undo | 1 | |
| **E2E subtotal** | **8** | 1.7 minutes wall time |

## 📜 Design Philosophy

- **Strict domain/render/UI separation** — domain layer is 100% pure (no DOM, no Three.js); all puzzle logic runs in Node for tests
- **`Puzzle<State, Move>` interface** — puzzles, renderers, and UI components are generic; new puzzles don't touch the core
- **WCA rules first-class** — scrambles, notation, and keymaps follow official WCA conventions and real-world solving habits, graded per puzzle size
- **Zero runtime framework** — Vanilla TS + Tailwind, no React/Vue/Svelte tax; bundle is ~135 KB gzipped

## 🛠 Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Build tool | Vite | ^7.0 |
| Language | TypeScript (strict + `verbatimModuleSyntax`) | ^5.6 |
| 3D rendering | Three.js | ^0.170 |
| Styling | Tailwind CSS (`@theme` + CSS variables) | ^4.0 |
| Unit testing | Vitest | ^2.1 |
| E2E testing | Playwright | ^1.60 |
| Audio | Web Audio API | Native |
| Persistence | localStorage | Native |
| Runtime | Node.js | ≥ 20.19 |

## 🤝 Contributing

PRs and issues are welcome. Suggested flow:

1. Fork and create a feature branch
2. Write code + matching tests (`src/**/*.test.ts`)
3. `npm test` + `npm run test:e2e` all green
4. `npm run typecheck` clean
5. Open a PR

### Adding a New Puzzle — Checklist

1. Implement `Puzzle<S, M>` under `src/domain/puzzles/<name>/`
2. Implement matching `PuzzleRenderer<S, M>` under `src/render/puzzles/`
3. Register an entry in `registry.ts`
4. Add the new id to the `PuzzleId` union in `Puzzle.ts`
5. Unit-level coverage is automatic via the Puzzle contract test suite
6. Add the new puzzle id to the e2e test list

## 📄 License

[MIT](./LICENSE) © Cubelab Contributors

## 🙏 Acknowledgments

- [Three.js](https://threejs.org) — 3D rendering
- [WCA Regulations](https://www.worldcubeassociation.org/regulations/) — Scramble and notation standards
- [Speedsolving.com Wiki](https://www.speedsolving.com/wiki/) — Solving method references
- [csTimer](https://cstimer.net) — Timer UX inspiration
