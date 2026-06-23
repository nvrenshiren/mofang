import type { ActionBus } from './ActionBus'
import type { Puzzle } from '../domain/puzzles/Puzzle'

/**
 * 键盘 → ActionBus
 *
 * Puzzle 提供 keymap() —— 每个 puzzle 定义自己的键→move 映射.
 * 修饰键 Shift = prime, Alt = 180° 是公共约定 (跨 puzzle 通用).
 *
 * 系统快捷键 (Ctrl+Z / Esc / Space) 跟 puzzle 无关, 直接发 ActionBus.
 */

export interface KeyboardOptions {
  enabled?: () => boolean
  isChallengeMode?: () => boolean
  /** 当前 puzzle 的 getter (切换 puzzle 时键位即时更新) */
  getPuzzle: () => Puzzle<unknown, unknown>
}

/** KeyboardEvent 中本模块用到的字段 — 提取为接口便于单元测试 (不依赖 DOM) */
export interface KeyboardEventLike {
  readonly key: string
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly repeat: boolean
  readonly target: EventTarget | null
  preventDefault(): void
}

/**
 * 纯函数: 处理一次键盘事件 → 派发 0~2 个 ActionBus action.
 * 与 window 解耦, 单元测试用这个即可.
 */
export function handleKeyboardEvent(
  ev: KeyboardEventLike,
  bus: ActionBus,
  opts: KeyboardOptions,
): void {
  const enabled = opts.enabled ?? (() => true)
  const isChallenge = opts.isChallengeMode ?? (() => false)

  if (!enabled()) return
  // 输入框内的键盘事件不抢
  const tag = (ev.target as { tagName?: string } | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (ev.repeat) return

  const inChallenge = isChallenge()

  // 系统键 (挑战模式全部静默)
  if (ev.ctrlKey || ev.metaKey) {
    if (inChallenge) return
    const k = ev.key.toLowerCase()
    if (k === 'z' && !ev.shiftKey) {
      ev.preventDefault()
      bus.dispatch({ type: 'undo' })
      return
    }
    if ((k === 'z' && ev.shiftKey) || k === 'y') {
      ev.preventDefault()
      bus.dispatch({ type: 'redo' })
      return
    }
    return
  }

  if (ev.key === 'Escape') {
    if (inChallenge) return
    ev.preventDefault()
    bus.dispatch({ type: 'reset' })
    return
  }

  if (ev.key === ' ') {
    ev.preventDefault()
    bus.dispatch({ type: inChallenge ? 'request-start' : 'scramble' })
    return
  }

  // Puzzle 的转动键
  const puzzle = opts.getPuzzle()
  const map = puzzle.keymap()
  const k = ev.key.toLowerCase()
  const binding = map.find((b) => b.key === k)
  if (!binding) return
  ev.preventDefault()

  // 修饰 Shift = prime, Alt = 180°
  let move = binding.move
  if (ev.altKey) move = doubleMove(move)
  else if (ev.shiftKey) move = puzzle.inverseMove(move)

  const label = puzzle.format(move)
  bus.dispatch({ type: 'flash-button', faceLabel: label })
  bus.dispatch({ type: 'move', move, source: 'keyboard' })
}

export function installKeyboard(bus: ActionBus, opts: KeyboardOptions): () => void {
  const handler = (ev: KeyboardEvent): void => handleKeyboardEvent(ev, bus, opts)
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}

/**
 * 把一个 move 变成它的 180° 版本
 * 约定: Move 是 { amount: 1|2|3, ... } 结构 (NxN 是这样)
 * 不符合该约定的 puzzle 退化为 90°
 */
function doubleMove(m: unknown): unknown {
  if (typeof m !== 'object' || m === null) return m
  const obj = m as { amount?: number }
  if (obj.amount === undefined) return m
  return { ...obj, amount: 2 }
}
