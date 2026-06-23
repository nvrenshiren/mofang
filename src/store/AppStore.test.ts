// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { ActionBus, type Action } from '../input/ActionBus'
import { AppStore, type StoreCallbacks } from './AppStore'
import type { Stage } from '../render/Stage'
import type { NxNMove } from '../domain/puzzles/nxn/NxNMoves'

/**
 * 测试策略: 用一个最小 stage stub. AppStore 通过 puzzle registry 拿到真 puzzle +
 * 真 NxNCubeRenderer. Renderer 只需要 stage.cubeRoot 是 THREE.Group + stage.camera 是
 * THREE.PerspectiveCamera + stage.addUpdater 返回一个 cleanup, 不依赖 WebGL.
 */
function makeFakeStage(): Stage {
  return {
    cubeRoot: new THREE.Group(),
    camera: new THREE.PerspectiveCamera(35, 1.5, 0.1, 50),
    scene: new THREE.Scene(),
    renderer: {} as any,
    addUpdater: vi.fn().mockReturnValue(() => {}),
    addOverlay: vi.fn().mockReturnValue(() => {}),
    dispose: vi.fn(),
  } as unknown as Stage
}

function setup(initialId: '2x2' | '3x3' | '4x4' = '3x3', cb: StoreCallbacks<unknown> = {}) {
  const stage = makeFakeStage()
  const bus = new ActionBus()
  const log: Action[] = []
  bus.subscribe((a) => log.push(a))
  const store = new AppStore(stage, bus, initialId, cb)
  return { stage, bus, store, log }
}

describe('AppStore · 初始化', () => {
  it('初始 puzzle = 指定 id', () => {
    const { store } = setup('2x2')
    expect(store.puzzle.meta.id).toBe('2x2')
  })

  it('初始 state = solved', () => {
    const { store } = setup('3x3')
    expect(store.puzzle.isSolved(store.state)).toBe(true)
  })

  it('history + scramble + mode 初值', () => {
    const { store } = setup('3x3')
    expect(store.history.moves).toEqual([])
    expect(store.history.cursor).toBe(0)
    expect(store.currentScramble).toEqual([])
    expect(store.mode).toBe('training')
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
  })
})

describe("AppStore · 'move' Action", () => {
  it('用户 move 进 history + 调 onUserMove + onHistoryChanged', () => {
    const onUserMove = vi.fn()
    const onHistoryChanged = vi.fn()
    const { bus, store } = setup('3x3', { onUserMove, onHistoryChanged })
    const move: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move, source: 'keyboard' })

    expect(store.history.moves).toEqual([move])
    expect(store.history.cursor).toBe(1)
    expect(onUserMove).toHaveBeenCalledWith(move)
    expect(onHistoryChanged).toHaveBeenCalled()
    expect(store.canUndo()).toBe(true)
  })

  it("source='scramble' 进 currentScramble, 不进 history", () => {
    const onScrambleChanged = vi.fn()
    const onUserMove = vi.fn()
    const { bus, store } = setup('3x3', { onScrambleChanged, onUserMove })
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'scramble' })

    expect(store.currentScramble).toEqual([m])
    expect(store.history.moves).toEqual([])
    expect(onScrambleChanged).toHaveBeenCalledWith([m])
    expect(onUserMove).not.toHaveBeenCalled()
  })

  it('多个 source 互不污染', () => {
    const { bus, store } = setup('3x3')
    const a: NxNMove = { face: 'R', depth: 1, amount: 1 }
    const b: NxNMove = { face: 'U', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: a, source: 'scramble' })
    bus.dispatch({ type: 'move', move: b, source: 'keyboard' })

    expect(store.currentScramble).toEqual([a])
    expect(store.history.moves).toEqual([b])
  })
})

describe("AppStore · 'undo' / 'redo'", () => {
  it('undo 把 cursor 后退 + onHistoryChanged', () => {
    const onHistoryChanged = vi.fn()
    const { bus, store } = setup('3x3', { onHistoryChanged })
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    onHistoryChanged.mockClear()
    bus.dispatch({ type: 'undo' })

    expect(store.history.cursor).toBe(0)
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(true)
    expect(onHistoryChanged).toHaveBeenCalled()
  })

  it('undo 在空 history 上 no-op', () => {
    const onHistoryChanged = vi.fn()
    const { bus, store } = setup('3x3', { onHistoryChanged })
    bus.dispatch({ type: 'undo' })
    expect(store.history.cursor).toBe(0)
    expect(onHistoryChanged).not.toHaveBeenCalled()
  })

  it('redo 重新前进 cursor', () => {
    const { bus, store } = setup('3x3')
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    bus.dispatch({ type: 'undo' })
    bus.dispatch({ type: 'redo' })
    expect(store.history.cursor).toBe(1)
    expect(store.canRedo()).toBe(false)
  })

  it('redo 在已到末尾时 no-op', () => {
    const { bus, store } = setup('3x3')
    bus.dispatch({ type: 'redo' })
    expect(store.history.cursor).toBe(0)
  })
})

describe("AppStore · 'reset'", () => {
  it('reset 清空 history + scramble + 派发 clear-log', () => {
    const { bus, store, log } = setup('3x3')
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    bus.dispatch({ type: 'move', move: m, source: 'scramble' })

    log.length = 0
    bus.dispatch({ type: 'reset' })

    expect(store.history.moves).toEqual([])
    expect(store.currentScramble).toEqual([])
    expect(store.puzzle.isSolved(store.state)).toBe(true)
    expect(log).toContainEqual({ type: 'clear-log' })
  })
})

describe("AppStore · 'scramble'", () => {
  it('生成 N 步并 dispatch 进 currentScramble', () => {
    const { bus, store } = setup('3x3')
    bus.dispatch({ type: 'scramble' })
    // 3x3 默认 20 步
    expect(store.currentScramble.length).toBe(20)
    expect(store.history.moves).toEqual([])
  })

  it('scramble 前先清空旧状态', () => {
    const { bus, store } = setup('3x3')
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    expect(store.history.moves.length).toBe(1)
    bus.dispatch({ type: 'scramble' })
    expect(store.history.moves).toEqual([]) // 旧 history 清掉
  })

  it("不同 N 步数不同 (2x2=11, 3x3=20)", () => {
    const a = setup('2x2')
    a.bus.dispatch({ type: 'scramble' })
    expect(a.store.currentScramble.length).toBe(11)

    const b = setup('3x3')
    b.bus.dispatch({ type: 'scramble' })
    expect(b.store.currentScramble.length).toBe(20)
  })
})

describe("AppStore · 'mode-change'", () => {
  it('更新 mode + onModeChanged 回调', () => {
    const onModeChanged = vi.fn()
    const { bus, store } = setup('3x3', { onModeChanged })
    bus.dispatch({ type: 'mode-change', mode: 'challenge' })
    expect(store.mode).toBe('challenge')
    expect(onModeChanged).toHaveBeenCalledWith('challenge')
  })
})

describe("AppStore · 'puzzle-change' / switchPuzzle", () => {
  it('切换 puzzle 重置 history/scramble + onPuzzleChanged', () => {
    const onPuzzleChanged = vi.fn()
    const { bus, store } = setup('3x3', { onPuzzleChanged })
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    bus.dispatch({ type: 'puzzle-change', puzzleId: '4x4' })

    expect(store.puzzle.meta.id).toBe('4x4')
    expect(store.history.moves).toEqual([])
    expect(store.currentScramble).toEqual([])
    expect(store.puzzle.isSolved(store.state)).toBe(true)
    expect(onPuzzleChanged).toHaveBeenCalledWith(store.puzzle)
  })

  it('切到相同 puzzle 不动状态', () => {
    const onPuzzleChanged = vi.fn()
    const { bus, store } = setup('3x3', { onPuzzleChanged })
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: m, source: 'keyboard' })
    bus.dispatch({ type: 'puzzle-change', puzzleId: '3x3' })

    expect(store.history.moves.length).toBe(1) // 没被清
    expect(onPuzzleChanged).not.toHaveBeenCalled()
  })

  it('未知 puzzleId 安全忽略', () => {
    const { bus, store } = setup('3x3')
    bus.dispatch({ type: 'puzzle-change', puzzleId: 'unknown' as any })
    expect(store.puzzle.meta.id).toBe('3x3')
  })
})

describe('AppStore · onAnyMoveApplied', () => {
  it('renderer.onMoveApplied 触发时调 onAnyMoveApplied + 更新 state', () => {
    const onAnyMoveApplied = vi.fn()
    const { store } = setup('3x3', { onAnyMoveApplied })
    const before = store.state
    const m: NxNMove = { face: 'R', depth: 1, amount: 1 }
    // 直接调 renderer.onMoveApplied 模拟动画完成回调
    store.renderer.onMoveApplied?.(m)
    expect(onAnyMoveApplied).toHaveBeenCalledWith(m)
    expect(store.state).not.toBe(before) // state 应该被 puzzle.apply 更新
    expect(store.puzzle.isSolved(store.state)).toBe(false)
  })
})

describe('AppStore · appliedMoves 视图', () => {
  it('appliedMoves 反映当前 cursor 范围', () => {
    const { bus, store } = setup('3x3')
    const a: NxNMove = { face: 'R', depth: 1, amount: 1 }
    const b: NxNMove = { face: 'U', depth: 1, amount: 1 }
    bus.dispatch({ type: 'move', move: a, source: 'keyboard' })
    bus.dispatch({ type: 'move', move: b, source: 'keyboard' })
    expect(store.appliedMoves()).toEqual([a, b])
    bus.dispatch({ type: 'undo' })
    expect(store.appliedMoves()).toEqual([a])
  })
})
