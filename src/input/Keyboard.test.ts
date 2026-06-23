import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionBus, type Action } from './ActionBus'
import { handleKeyboardEvent, type KeyboardEventLike, type KeyboardOptions } from './Keyboard'
import { createNxNCube } from '../domain/puzzles/nxn/NxNCube'

function ev(partial: Partial<KeyboardEventLike>): KeyboardEventLike {
  return {
    key: '',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    target: null,
    preventDefault: vi.fn(),
    ...partial,
  }
}

function capture(bus: ActionBus): Action[] {
  const log: Action[] = []
  bus.subscribe((a) => log.push(a))
  return log
}

describe('handleKeyboardEvent — Puzzle 转动键', () => {
  let bus: ActionBus
  let log: Action[]
  let opts: KeyboardOptions

  beforeEach(() => {
    bus = new ActionBus()
    log = capture(bus)
    opts = { getPuzzle: () => createNxNCube(3) as any }
  })

  it('r 触发 R move + flash-button', () => {
    handleKeyboardEvent(ev({ key: 'r' }), bus, opts)
    const moves = log.filter((a) => a.type === 'move')
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ type: 'move', source: 'keyboard' })
    expect((moves[0] as any).move).toMatchObject({ face: 'R', amount: 1 })

    const flash = log.find((a) => a.type === 'flash-button')
    expect(flash).toMatchObject({ type: 'flash-button', faceLabel: 'R' })
  })

  it('Shift+r → R prime (amount=3)', () => {
    handleKeyboardEvent(ev({ key: 'R', shiftKey: true }), bus, opts)
    const move = (log.find((a) => a.type === 'move') as any).move
    expect(move.amount).toBe(3)
    const flash = log.find((a) => a.type === 'flash-button') as any
    expect(flash.faceLabel).toBe("R'")
  })

  it('Alt+r → R2 (amount=2)', () => {
    handleKeyboardEvent(ev({ key: 'r', altKey: true }), bus, opts)
    const move = (log.find((a) => a.type === 'move') as any).move
    expect(move.amount).toBe(2)
  })

  it('键大小写无关 (R 等同 r)', () => {
    handleKeyboardEvent(ev({ key: 'R' }), bus, opts)
    expect(log.some((a) => a.type === 'move')).toBe(true)
  })

  it('2x2 没有 l 键 (不绑定)', () => {
    opts = { getPuzzle: () => createNxNCube(2) as any }
    handleKeyboardEvent(ev({ key: 'l' }), bus, opts)
    expect(log.filter((a) => a.type === 'move')).toHaveLength(0)
  })

  it('未识别键不派发', () => {
    handleKeyboardEvent(ev({ key: 'q' }), bus, opts)
    expect(log).toHaveLength(0)
  })

  it('整体旋转 ; → y', () => {
    handleKeyboardEvent(ev({ key: ';' }), bus, opts)
    const move = (log.find((a) => a.type === 'move') as any).move
    expect(move.face).toBe('y')
  })

  it('3x3 (奇数 N) 有 m 中层键', () => {
    handleKeyboardEvent(ev({ key: 'm' }), bus, opts)
    const move = (log.find((a) => a.type === 'move') as any).move
    expect(move.face).toBe('M')
  })

  it('4x4 (偶数 N) 没有 m 中层键', () => {
    opts = { getPuzzle: () => createNxNCube(4) as any }
    handleKeyboardEvent(ev({ key: 'm' }), bus, opts)
    expect(log.filter((a) => a.type === 'move')).toHaveLength(0)
  })

  it('preventDefault 在识别到键时被调用', () => {
    const e = ev({ key: 'r' })
    handleKeyboardEvent(e, bus, opts)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('preventDefault 在未识别键时不调', () => {
    const e = ev({ key: 'q' })
    handleKeyboardEvent(e, bus, opts)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})

describe('handleKeyboardEvent — 系统键', () => {
  let bus: ActionBus
  let log: Action[]
  let opts: KeyboardOptions
  beforeEach(() => {
    bus = new ActionBus()
    log = capture(bus)
    opts = { getPuzzle: () => createNxNCube(3) as any }
  })

  it('Ctrl+Z → undo', () => {
    handleKeyboardEvent(ev({ key: 'z', ctrlKey: true }), bus, opts)
    expect(log).toContainEqual({ type: 'undo' })
  })

  it('Ctrl+Shift+Z → redo', () => {
    handleKeyboardEvent(ev({ key: 'z', ctrlKey: true, shiftKey: true }), bus, opts)
    expect(log).toContainEqual({ type: 'redo' })
  })

  it('Ctrl+Y → redo (Windows 习惯)', () => {
    handleKeyboardEvent(ev({ key: 'y', ctrlKey: true }), bus, opts)
    expect(log).toContainEqual({ type: 'redo' })
  })

  it('Meta+Z 也触发 undo (Mac)', () => {
    handleKeyboardEvent(ev({ key: 'z', metaKey: true }), bus, opts)
    expect(log).toContainEqual({ type: 'undo' })
  })

  it('Esc → reset', () => {
    handleKeyboardEvent(ev({ key: 'Escape' }), bus, opts)
    expect(log).toContainEqual({ type: 'reset' })
  })

  it('Space → scramble (非挑战模式)', () => {
    handleKeyboardEvent(ev({ key: ' ' }), bus, opts)
    expect(log).toContainEqual({ type: 'scramble' })
  })

  it('Space → request-start (挑战模式)', () => {
    opts.isChallengeMode = () => true
    handleKeyboardEvent(ev({ key: ' ' }), bus, opts)
    expect(log).toContainEqual({ type: 'request-start' })
  })
})

describe('handleKeyboardEvent — 挑战模式屏蔽', () => {
  let bus: ActionBus
  let log: Action[]
  let opts: KeyboardOptions
  beforeEach(() => {
    bus = new ActionBus()
    log = capture(bus)
    opts = {
      getPuzzle: () => createNxNCube(3) as any,
      isChallengeMode: () => true,
    }
  })

  it('Ctrl+Z 静默', () => {
    handleKeyboardEvent(ev({ key: 'z', ctrlKey: true }), bus, opts)
    expect(log.filter((a) => a.type === 'undo' || a.type === 'redo')).toHaveLength(0)
  })

  it('Ctrl+Shift+Z 静默', () => {
    handleKeyboardEvent(ev({ key: 'z', ctrlKey: true, shiftKey: true }), bus, opts)
    expect(log.filter((a) => a.type === 'redo')).toHaveLength(0)
  })

  it('Esc 静默', () => {
    handleKeyboardEvent(ev({ key: 'Escape' }), bus, opts)
    expect(log.filter((a) => a.type === 'reset')).toHaveLength(0)
  })

  it('转动键仍生效', () => {
    handleKeyboardEvent(ev({ key: 'r' }), bus, opts)
    expect(log.filter((a) => a.type === 'move')).toHaveLength(1)
  })
})

describe('handleKeyboardEvent — 守卫', () => {
  let bus: ActionBus
  let log: Action[]

  beforeEach(() => {
    bus = new ActionBus()
    log = capture(bus)
  })

  it('enabled() = false 时全屏蔽', () => {
    const opts: KeyboardOptions = {
      getPuzzle: () => createNxNCube(3) as any,
      enabled: () => false,
    }
    handleKeyboardEvent(ev({ key: 'r' }), bus, opts)
    handleKeyboardEvent(ev({ key: 'Escape' }), bus, opts)
    expect(log).toHaveLength(0)
  })

  it('焦点在 textarea / input 时不抢键', () => {
    const opts: KeyboardOptions = { getPuzzle: () => createNxNCube(3) as any }
    handleKeyboardEvent(ev({ key: 'r', target: { tagName: 'TEXTAREA' } as any }), bus, opts)
    handleKeyboardEvent(ev({ key: 'r', target: { tagName: 'INPUT' } as any }), bus, opts)
    expect(log.filter((a) => a.type === 'move')).toHaveLength(0)
  })

  it('repeat 事件不响应 (避免长按多次触发)', () => {
    const opts: KeyboardOptions = { getPuzzle: () => createNxNCube(3) as any }
    handleKeyboardEvent(ev({ key: 'r', repeat: true }), bus, opts)
    expect(log).toHaveLength(0)
  })
})
