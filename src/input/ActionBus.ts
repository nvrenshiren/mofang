import type { PuzzleId } from '../domain/puzzles/Puzzle'

/**
 * 中心动作总线
 * 注意: Action.move 的类型是 unknown, 因为不同 puzzle 有不同 Move 类型.
 * AppStore 知道当前 puzzle, 在路由时把 move 传给对应 puzzle.apply / renderer.enqueueMove.
 */

export type AppMode = 'training' | 'free' | 'challenge'

export type Action =
  | { type: 'move'; move: unknown; source: 'keyboard' | 'button' | 'formula' | 'scramble' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'scramble' }
  | { type: 'request-start' }
  | { type: 'flash-button'; faceLabel: string }
  | { type: 'mode-change'; mode: AppMode }
  | { type: 'puzzle-change'; puzzleId: PuzzleId }
  | { type: 'clear-log' }

type Listener = (action: Action) => void

export class ActionBus {
  private readonly listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dispatch(action: Action): void {
    for (const l of this.listeners) l(action)
  }
}
