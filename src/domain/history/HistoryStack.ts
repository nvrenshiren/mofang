/**
 * 通用 History 栈 —— 不依赖 Move 形状
 *
 * Move 是泛型 T (通常是各 puzzle 的 Move 类型, AppStore 里以 unknown 持有).
 * undo() 需要外部传入 inverseMove 函数, 因为不同 puzzle 算反向的方式不同.
 */

export interface History<T = unknown> {
  readonly moves: readonly T[]
  readonly cursor: number
}

export function emptyHistory<T = unknown>(): History<T> {
  return { moves: [], cursor: 0 }
}

export function push<T>(h: History<T>, m: T): History<T> {
  const kept = h.moves.slice(0, h.cursor)
  const next = [...kept, m]
  return { moves: next, cursor: next.length }
}

export function pushMany<T>(h: History<T>, ms: readonly T[]): History<T> {
  let cur = h
  for (const m of ms) cur = push(cur, m)
  return cur
}

export function undo<T>(h: History<T>, invert: (m: T) => T): { next: History<T>; inverse: T } | null {
  if (h.cursor === 0) return null
  const m = h.moves[h.cursor - 1]!
  return {
    next: { moves: h.moves, cursor: h.cursor - 1 },
    inverse: invert(m),
  }
}

export function redo<T>(h: History<T>): { next: History<T>; move: T } | null {
  if (h.cursor >= h.moves.length) return null
  const m = h.moves[h.cursor]!
  return {
    next: { moves: h.moves, cursor: h.cursor + 1 },
    move: m,
  }
}

export function canUndo<T>(h: History<T>): boolean { return h.cursor > 0 }
export function canRedo<T>(h: History<T>): boolean { return h.cursor < h.moves.length }

export function appliedMoves<T>(h: History<T>): readonly T[] {
  return h.moves.slice(0, h.cursor)
}
