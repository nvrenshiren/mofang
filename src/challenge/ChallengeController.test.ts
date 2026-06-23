// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActionBus, type Action } from '../input/ActionBus'
import {
  createChallengeController,
  type ChallengeController,
  type ChallengeDeps,
} from './ChallengeController'

/**
 * 注意: ChallengeController 内部用 requestAnimationFrame + setTimeout +
 * performance.now() + Date.now() 驱动状态机. 用 vi.useFakeTimers 控制时间.
 *
 * happy-dom 提供 document.createElement / requestAnimationFrame.
 */

function makeDeps(overrides: Partial<ChallengeDeps> = {}): ChallengeDeps {
  return {
    getPuzzle: () => ({ isSolved: () => false }) as any,
    getRenderer: () => ({ isBusy: () => false }) as any,
    getState: () => ({}),
    ...overrides,
  }
}

describe('ChallengeController · 初始 + 激活', () => {
  let bus: ActionBus
  let ctrl: ChallengeController

  beforeEach(() => {
    bus = new ActionBus()
    ctrl = createChallengeController(bus, makeDeps())
  })

  it('初始 state = idle', () => {
    expect(ctrl.getState()).toBe('idle')
  })

  it('setActive(false) 时 isInputLocked 始终 false', () => {
    expect(ctrl.isInputLocked()).toBe(false)
  })

  it('overlay 默认 hidden', () => {
    expect(ctrl.overlay.classList.contains('hidden')).toBe(true)
  })
})

describe('ChallengeController · 状态机', () => {
  let bus: ActionBus
  let log: Action[]
  let ctrl: ChallengeController
  let isSolvedMock: ReturnType<typeof vi.fn>
  let isBusyMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
    bus = new ActionBus()
    log = []
    bus.subscribe((a) => log.push(a))
    isSolvedMock = vi.fn().mockReturnValue(false)
    isBusyMock = vi.fn().mockReturnValue(false)
    ctrl = createChallengeController(bus, makeDeps({
      getPuzzle: () => ({ isSolved: isSolvedMock }) as any,
      getRenderer: () => ({ isBusy: isBusyMock }) as any,
    }))
    ctrl.setActive(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('start() 转 scrambling 并 dispatch scramble', () => {
    ctrl.start()
    expect(ctrl.getState()).toBe('scrambling')
    expect(log).toContainEqual({ type: 'scramble' })
  })

  it('start() 在 scrambling 中重入会被忽略 (防双击)', () => {
    ctrl.start()
    log.length = 0
    ctrl.start()
    // 不应再 dispatch scramble
    expect(log.filter((a) => a.type === 'scramble')).toHaveLength(0)
  })

  it('cube 队列空后 → inspection', async () => {
    ctrl.start()
    isBusyMock.mockReturnValue(false)
    // start 内部 setTimeout(wait, 150)
    await vi.advanceTimersByTimeAsync(160)
    expect(ctrl.getState()).toBe('inspection')
  })

  it('cube 一直 busy 则停在 scrambling 轮询', async () => {
    isBusyMock.mockReturnValue(true)
    ctrl.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(ctrl.getState()).toBe('scrambling')
  })

  it('inspection 15s 倒计时结束 → solving', async () => {
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160)
    expect(ctrl.getState()).toBe('inspection')
    // render() 在 raf loop 里轮询 remaining<=0 时 beginSolving
    await vi.advanceTimersByTimeAsync(15_100)
    expect(ctrl.getState()).toBe('solving')
  })

  it('solving 中 isSolved() = true + notifyMoveApplied → finished', async () => {
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160 + 15_100)
    expect(ctrl.getState()).toBe('solving')
    isSolvedMock.mockReturnValue(true)
    ctrl.notifyMoveApplied()
    expect(ctrl.getState()).toBe('finished')
  })

  it('solving 中 isSolved=false 时 notifyMoveApplied 不改状态', async () => {
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160 + 15_100)
    expect(ctrl.getState()).toBe('solving')
    ctrl.notifyMoveApplied()
    expect(ctrl.getState()).toBe('solving')
  })

  it('非 solving 状态 notifyMoveApplied 是 no-op', () => {
    isSolvedMock.mockReturnValue(true)
    // idle, inspection 都不该触发 finished
    expect(ctrl.getState()).toBe('idle')
    ctrl.notifyMoveApplied()
    expect(ctrl.getState()).toBe('idle')
  })

  it('onFinish 回调收到 ms + at', async () => {
    const onFinish = vi.fn()
    ctrl.onFinish(onFinish)
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160 + 15_100 + 500) // 进 solving 后再过 0.5s
    isSolvedMock.mockReturnValue(true)
    ctrl.notifyMoveApplied()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const arg = onFinish.mock.calls[0]![0]
    expect(arg.ms).toBeGreaterThan(0)
    expect(arg.at).toBeGreaterThan(0)
  })

  it('onStateChange 在每次状态切换时收到通知', async () => {
    const seen: string[] = []
    ctrl.onStateChange((s) => seen.push(s))
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160)
    expect(seen).toContain('scrambling')
    expect(seen).toContain('inspection')
  })
})

describe('ChallengeController · isInputLocked', () => {
  let bus: ActionBus
  let ctrl: ChallengeController

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
    bus = new ActionBus()
    ctrl = createChallengeController(bus, makeDeps({
      getPuzzle: () => ({ isSolved: () => false }) as any,
      getRenderer: () => ({ isBusy: () => false }) as any,
    }))
    ctrl.setActive(true)
  })
  afterEach(() => vi.useRealTimers())

  it('idle: 不锁', () => {
    expect(ctrl.isInputLocked()).toBe(false)
  })

  it('scrambling: 锁', () => {
    ctrl.start()
    expect(ctrl.isInputLocked()).toBe(true)
  })

  it('inspection: 锁', async () => {
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160)
    expect(ctrl.isInputLocked()).toBe(true)
  })

  it('solving: 不锁 (用户需要能转 cube)', async () => {
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160 + 15_100)
    expect(ctrl.isInputLocked()).toBe(false)
  })

  it('setActive(false) 强制不锁 (切走挑战模式)', () => {
    ctrl.start()
    ctrl.setActive(false)
    expect(ctrl.isInputLocked()).toBe(false)
  })
})

describe('ChallengeController · setActive', () => {
  let bus: ActionBus
  let ctrl: ChallengeController

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
    bus = new ActionBus()
    ctrl = createChallengeController(bus, makeDeps())
  })
  afterEach(() => vi.useRealTimers())

  it('setActive(true) 不会自动 start', () => {
    ctrl.setActive(true)
    expect(ctrl.getState()).toBe('idle')
  })

  it('setActive(false) 把 state 强制回 idle', async () => {
    ctrl.setActive(true)
    ctrl.start()
    await vi.advanceTimersByTimeAsync(160)
    expect(ctrl.getState()).toBe('inspection')
    ctrl.setActive(false)
    expect(ctrl.getState()).toBe('idle')
  })

  it('未激活时 request-start 不触发', () => {
    // active=false 默认
    let dispatched = 0
    bus.subscribe((a) => { if (a.type === 'scramble') dispatched++ })
    bus.dispatch({ type: 'request-start' })
    expect(dispatched).toBe(0)
    expect(ctrl.getState()).toBe('idle')
  })

  it('激活时 request-start 触发 start()', () => {
    ctrl.setActive(true)
    bus.dispatch({ type: 'request-start' })
    expect(ctrl.getState()).toBe('scrambling')
  })
})
