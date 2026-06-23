import type { ActionBus } from '../input/ActionBus'
import type { AppMode } from '../types'
import {
  appliedMoves,
  canRedo,
  canUndo,
  emptyHistory,
  push as historyPush,
  redo as historyRedo,
  undo as historyUndo,
  type History,
} from '../domain/history/HistoryStack'
import type { Puzzle, PuzzleId, PuzzleRenderer } from '../domain/puzzles/Puzzle'
import { PUZZLES } from '../domain/puzzles/registry'
import type { Stage } from '../render/Stage'

/**
 * 应用状态编排
 *
 * 泛型参数:
 *   S = 当前 puzzle 的 State 类型
 *   M = 当前 puzzle 的 Move 类型
 *
 * 默认 S = M = unknown — main.ts 等场景里 puzzle 是运行时动态的, 编译期无法静态绑定.
 * 测试和单一谜题宿主可以传具体类型 (如 AppStore<NxNState, NxNMove>) 拿到强类型回调.
 *
 * 类型擦除点: 'move' Action 的 move 字段是 unknown (跨 puzzle 同质 bus), 在 handle('move')
 *           里我们假定 a.move 是当前 puzzle 的 M 类型 — 这是个运行时契约, 静态层用 as 显式标注.
 */

export interface StoreCallbacks<M> {
  onHistoryChanged?: (h: History<M>) => void
  onUserMove?: (move: M) => void
  onScrambleChanged?: (scramble: readonly M[]) => void
  onAnyMoveApplied?: (move: M) => void
  onModeChanged?: (mode: AppMode) => void
  onPuzzleChanged?: (puzzle: Puzzle<unknown, unknown>) => void
}

export class AppStore<S = unknown, M = unknown> {
  history: History<M> = emptyHistory<M>()
  mode: AppMode = 'training'
  currentScramble: M[] = []
  puzzle: Puzzle<S, M>
  renderer: PuzzleRenderer<S, M>
  state: S

  private readonly stage: Stage
  private readonly bus: ActionBus
  private readonly cb: StoreCallbacks<M>

  constructor(stage: Stage, bus: ActionBus, initialPuzzleId: PuzzleId, cb: StoreCallbacks<M> = {}) {
    this.stage = stage
    this.bus = bus
    this.cb = cb

    const entry = PUZZLES.find((p) => p.id === initialPuzzleId) ?? PUZZLES[1]!
    // registry 是异构存储 (Puzzle<unknown,unknown>); 这里向 <S, M> 投影是运行时契约
    this.puzzle = entry.createPuzzle() as Puzzle<S, M>
    this.renderer = entry.createRenderer() as PuzzleRenderer<S, M>
    this.state = this.puzzle.solved()
    this.attachRenderer()

    bus.subscribe((a) => this.handle(a))
  }

  /** mount renderer + 绑 onMoveApplied 回调 — constructor / switchPuzzle 共用 */
  private attachRenderer(): void {
    this.renderer.mount(this.stage, this.state)
    this.renderer.onMoveApplied = (m) => {
      this.state = this.puzzle.apply(this.state, m)
      this.cb.onAnyMoveApplied?.(m)
    }
  }

  switchPuzzle(id: PuzzleId): void {
    const entry = PUZZLES.find((p) => p.id === id)
    if (!entry) return
    if (this.puzzle.meta.id === id) return

    this.renderer.unmount()

    // 切换后 S/M 静态类型不会变 (TS 强类型), 但运行时实际从一个谜题切到另一个;
    // 调用方有责任要么用 <unknown, unknown> 接受动态性, 要么自己重启 store
    this.puzzle = entry.createPuzzle() as Puzzle<S, M>
    this.renderer = entry.createRenderer() as PuzzleRenderer<S, M>
    this.state = this.puzzle.solved()
    this.attachRenderer()

    this.history = emptyHistory<M>()
    this.currentScramble = []
    this.cb.onHistoryChanged?.(this.history)
    this.cb.onScrambleChanged?.(this.currentScramble)
    this.bus.dispatch({ type: 'clear-log' })
    this.cb.onPuzzleChanged?.(this.puzzle as Puzzle<unknown, unknown>)
  }

  private handle(a: import('../input/ActionBus').Action): void {
    switch (a.type) {
      case 'move': {
        // Bus 携带 unknown move; 这里假定当前 puzzle 接受这种 move
        const move = a.move as M
        if (a.source === 'scramble') {
          this.currentScramble.push(move)
          this.cb.onScrambleChanged?.(this.currentScramble)
          void this.renderer.enqueueMove(move, 220)
        } else {
          this.history = historyPush(this.history, move)
          this.cb.onHistoryChanged?.(this.history)
          this.cb.onUserMove?.(move)
          void this.renderer.enqueueMove(move, 220)
        }
        break
      }

      case 'undo': {
        const r = historyUndo(this.history, (m) => this.puzzle.inverseMove(m))
        if (!r) return
        this.history = r.next
        this.cb.onHistoryChanged?.(this.history)
        void this.renderer.enqueueMove(r.inverse, 220)
        break
      }

      case 'redo': {
        const r = historyRedo(this.history)
        if (!r) return
        this.history = r.next
        this.cb.onHistoryChanged?.(this.history)
        void this.renderer.enqueueMove(r.move, 220)
        break
      }

      case 'reset':
        this.renderer.clearQueue()
        this.state = this.puzzle.solved()
        this.renderer.syncToState(this.state)
        this.history = emptyHistory<M>()
        this.currentScramble = []
        this.cb.onHistoryChanged?.(this.history)
        this.cb.onScrambleChanged?.(this.currentScramble)
        this.bus.dispatch({ type: 'clear-log' })
        break

      case 'scramble': {
        this.renderer.clearQueue()
        this.state = this.puzzle.solved()
        this.renderer.syncToState(this.state)
        this.history = emptyHistory<M>()
        this.currentScramble = []
        this.cb.onHistoryChanged?.(this.history)
        this.cb.onScrambleChanged?.(this.currentScramble)
        this.bus.dispatch({ type: 'clear-log' })
        const scr = this.puzzle.generateScramble({ length: this.puzzle.meta.scrambleLength })
        for (const m of scr) this.bus.dispatch({ type: 'move', move: m, source: 'scramble' })
        break
      }

      case 'mode-change':
        this.mode = a.mode
        this.cb.onModeChanged?.(a.mode)
        break

      case 'puzzle-change':
        this.switchPuzzle(a.puzzleId)
        break
    }
  }

  canUndo(): boolean { return canUndo(this.history) }
  canRedo(): boolean { return canRedo(this.history) }
  appliedMoves(): readonly M[] { return appliedMoves(this.history) }
}
