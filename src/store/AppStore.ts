import type { ActionBus, AppMode } from '../input/ActionBus'
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
 * 持有"当前 puzzle 实例 + 当前 renderer 实例", 路由 ActionBus 的消息.
 * 切换 puzzle 时:
 *   1. 清除挑战 / 历史 / 日志 / 打乱
 *   2. unmount 旧 renderer, 释放 GPU 资源
 *   3. 实例化新 puzzle + renderer, mount 到同一 Stage
 *
 * 历史栈 History 的 Move 类型用 unknown — push/undo/redo 操作不依赖 Move 形状.
 */

export interface StoreCallbacks<M> {
  onHistoryChanged?: (h: History<M>) => void
  onUserMove?: (move: M) => void
  onScrambleChanged?: (scramble: readonly M[]) => void
  onAnyMoveApplied?: (move: M) => void
  onModeChanged?: (mode: AppMode) => void
  onPuzzleChanged?: (puzzle: Puzzle<unknown, unknown>) => void
}

export class AppStore {
  history: History<unknown> = emptyHistory()
  mode: AppMode = 'training'
  currentScramble: unknown[] = []
  puzzle: Puzzle<unknown, unknown>
  renderer: PuzzleRenderer<unknown, unknown>
  state: unknown

  private readonly stage: Stage
  private readonly bus: ActionBus
  private readonly cb: StoreCallbacks<unknown>

  constructor(stage: Stage, bus: ActionBus, initialPuzzleId: PuzzleId, cb: StoreCallbacks<unknown> = {}) {
    this.stage = stage
    this.bus = bus
    this.cb = cb

    const entry = PUZZLES.find((p) => p.id === initialPuzzleId) ?? PUZZLES[1]!
    this.puzzle = entry.createPuzzle()
    this.renderer = entry.createRenderer()
    this.state = this.puzzle.solved()
    this.renderer.mount(stage, this.state)
    this.renderer.onMoveApplied = (m) => {
      this.state = this.puzzle.apply(this.state, m)
      this.cb.onAnyMoveApplied?.(m)
    }

    bus.subscribe((a) => this.handle(a))
  }

  switchPuzzle(id: PuzzleId): void {
    const entry = PUZZLES.find((p) => p.id === id)
    if (!entry) return
    if (this.puzzle.meta.id === id) return

    // 卸载旧
    this.renderer.unmount()

    // 实例化新
    this.puzzle = entry.createPuzzle()
    this.renderer = entry.createRenderer()
    this.state = this.puzzle.solved()
    this.renderer.mount(this.stage, this.state)
    this.renderer.onMoveApplied = (m) => {
      this.state = this.puzzle.apply(this.state, m)
      this.cb.onAnyMoveApplied?.(m)
    }

    // 清空跨谜题不复用的状态
    this.history = emptyHistory()
    this.currentScramble = []
    this.cb.onHistoryChanged?.(this.history)
    this.cb.onScrambleChanged?.(this.currentScramble)
    this.bus.dispatch({ type: 'clear-log' })
    this.cb.onPuzzleChanged?.(this.puzzle)
  }

  private handle(a: import('../input/ActionBus').Action): void {
    switch (a.type) {
      case 'move':
        if (a.source === 'scramble') {
          this.currentScramble.push(a.move)
          this.cb.onScrambleChanged?.(this.currentScramble)
          void this.renderer.enqueueMove(a.move, 220)
        } else {
          this.history = historyPush(this.history, a.move)
          this.cb.onHistoryChanged?.(this.history)
          this.cb.onUserMove?.(a.move)
          void this.renderer.enqueueMove(a.move, 220)
        }
        break

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
        this.history = emptyHistory()
        this.currentScramble = []
        this.cb.onHistoryChanged?.(this.history)
        this.cb.onScrambleChanged?.(this.currentScramble)
        this.bus.dispatch({ type: 'clear-log' })
        break

      case 'scramble': {
        this.renderer.clearQueue()
        this.state = this.puzzle.solved()
        this.renderer.syncToState(this.state)
        this.history = emptyHistory()
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
  appliedMoves(): readonly unknown[] { return appliedMoves(this.history) }
}
