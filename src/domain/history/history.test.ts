import { describe, it, expect } from 'vitest'
import {
  appliedMoves, canRedo, canUndo, emptyHistory, push, pushMany, redo, undo,
} from './HistoryStack'

// 测试用最小 Move 类型: 一个数字 + 它的反向 (取负)
type TestMove = number
const inv = (m: TestMove): TestMove => -m

describe('HistoryStack (generic)', () => {
  it('空历史', () => {
    const h = emptyHistory<TestMove>()
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
    expect(undo(h, inv)).toBeNull()
    expect(redo(h)).toBeNull()
  })

  it('push 后可撤销', () => {
    const h = push(emptyHistory<TestMove>(), 1)
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)
    expect(appliedMoves(h)).toEqual([1])
  })

  it('undo 给出反向', () => {
    let h = push(emptyHistory<TestMove>(), 5)
    const u = undo(h, inv)!
    expect(u.inverse).toBe(-5)
    expect(canRedo(u.next)).toBe(true)
    h = u.next
    const r = redo(h)!
    expect(r.move).toBe(5)
  })

  it('在中间 push 会丢弃 redo 队列', () => {
    let h = pushMany(emptyHistory<TestMove>(), [1, 2, 3])
    h = undo(h, inv)!.next
    h = undo(h, inv)!.next
    h = push(h, 4)
    expect(appliedMoves(h)).toEqual([1, 4])
    expect(canRedo(h)).toBe(false)
  })
})
