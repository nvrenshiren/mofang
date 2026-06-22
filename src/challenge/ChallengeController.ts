import type { ActionBus } from '../input/ActionBus'
import type { Puzzle, PuzzleRenderer } from '../domain/puzzles/Puzzle'
import { sfx } from '../audio/Sfx'

/**
 * 挑战模式状态机
 *
 *   idle ─[start()]─→ scrambling ─[cube idle]─→ inspection (15s ↓) ─[0s]─→ solving (↑)
 *                                                                              │
 *                                                                          [solved]
 *                                                                              ↓
 *                                                                          finished
 *
 * 任何状态下调 start() / 重新开始 → 回到 scrambling
 *
 * 输入锁: scrambling + inspection + finished 时锁住键盘 (避免选手在不该转的时候转)
 */

export type ChallengeState = 'idle' | 'scrambling' | 'inspection' | 'solving' | 'finished'

const INSPECTION_MS = 15_000

export interface ChallengeFinish {
  /** 本局求解用时 (ms) */
  ms: number
  /** 求解开始时间戳 (Date.now()) */
  at: number
}

export interface ChallengeController {
  readonly overlay: HTMLElement
  start(): void
  notifyMoveApplied(): void
  isInputLocked(): boolean
  getState(): ChallengeState
  onStateChange(fn: (s: ChallengeState) => void): void
  /** 本局求解结束时回调 (在 setState('finished') 之前触发) */
  onFinish(fn: (f: ChallengeFinish) => void): void
  /** 切换到挑战模式时调; 切走时也调让 controller 重置 */
  setActive(active: boolean): void
}

export interface ChallengeDeps {
  getPuzzle: () => Puzzle<unknown, unknown>
  getRenderer: () => PuzzleRenderer<unknown, unknown>
  getState: () => unknown
}

export function createChallengeController(bus: ActionBus, deps: ChallengeDeps): ChallengeController {
  // 顶部横条,不与魔方重叠
  // 之所以用 pointer-events-none + 内部 .pip 圆角加边:不挡鼠标拖拽 (自由模式时 OrbitControls 仍可用)
  const overlay = document.createElement('div')
  overlay.className = 'absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none hidden'
  overlay.innerHTML = `
    <div class="flex items-center gap-5 px-6 py-2.5 rounded-full"
         style="background: color-mix(in oklab, var(--color-stage-2) 80%, transparent); border: 1px solid color-mix(in oklab, var(--color-ink-1) 8%, transparent); box-shadow: 0 4px 24px rgba(0,0,0,0.4);">
      <div data-role="phase" class="text-[color:var(--color-accent)] text-[10px] uppercase tracking-[0.3em] font-semibold"></div>
      <div data-role="time" class="text-3xl font-mono font-bold leading-none tabular-nums tracking-tight min-w-[140px] text-center"></div>
      <div data-role="note" class="text-xs text-[color:var(--color-ink-3)] font-mono"></div>
    </div>
  `
  const phaseEl = overlay.querySelector<HTMLElement>('[data-role="phase"]')!
  const timeEl = overlay.querySelector<HTMLElement>('[data-role="time"]')!
  const noteEl = overlay.querySelector<HTMLElement>('[data-role="note"]')!

  let state: ChallengeState = 'idle'
  let active = false
  let inspectionEndAt = 0
  let solveStartAt = 0
  let solveStartAtWallclock = 0 // Date.now() at solve start
  let solveEndAt = 0
  let rafHandle = 0
  let lastBeepSec = -1
  const listeners: ((s: ChallengeState) => void)[] = []
  const finishListeners: ((f: ChallengeFinish) => void)[] = []

  function setState(s: ChallengeState): void {
    state = s
    if (s === 'idle') overlay.classList.add('hidden')
    else overlay.classList.remove('hidden')
    listeners.forEach((l) => l(s))
    render()
  }

  function render(): void {
    const now = performance.now()
    switch (state) {
      case 'idle':
        return
      case 'scrambling':
        phaseEl.textContent = '准备中'
        timeEl.textContent = '⋯'
        timeEl.style.color = 'var(--color-ink-2)'
        noteEl.textContent = '打乱中, 请稍候'
        break
      case 'inspection': {
        const remaining = Math.max(0, inspectionEndAt - now)
        phaseEl.textContent = '观察阶段'
        timeEl.textContent = (remaining / 1000).toFixed(2)
        timeEl.style.color = remaining < 3000 ? 'var(--color-cube-r)' : 'var(--color-cube-d)'
        noteEl.textContent = '记题, 不要转动'
        // 倒计时整秒提示音 (最后 3 秒)
        const secLeft = Math.ceil(remaining / 1000)
        if (secLeft <= 3 && secLeft > 0 && secLeft !== lastBeepSec) {
          lastBeepSec = secLeft
          sfx.tick()
        }
        if (remaining <= 0) beginSolving()
        break
      }
      case 'solving': {
        const elapsed = now - solveStartAt
        phaseEl.textContent = '计时中'
        timeEl.textContent = formatMs(elapsed)
        timeEl.style.color = 'var(--color-ink-1)'
        noteEl.textContent = '完成时自动停表'
        break
      }
      case 'finished': {
        phaseEl.textContent = '完成'
        timeEl.textContent = formatMs(solveEndAt - solveStartAt)
        timeEl.style.color = 'var(--color-cube-f)'
        noteEl.textContent = '点击 "重新开始" 再来一次'
        break
      }
    }
  }

  function loop(): void {
    if (active) render()
    rafHandle = requestAnimationFrame(loop)
  }

  function start(): void {
    // 防双击 / 防在 scrambling 期间重入: 已经在准备中就忽略, 避免动画堆叠和闭包重复触发
    if (state === 'scrambling') return
    if (rafHandle === 0) rafHandle = requestAnimationFrame(loop)
    setState('scrambling')
    lastBeepSec = -1
    bus.dispatch({ type: 'scramble' })
    const wait = (): void => {
      if (!active || state !== 'scrambling') return
      if (deps.getRenderer().isBusy()) {
        setTimeout(wait, 50)
        return
      }
      beginInspection()
    }
    setTimeout(wait, 150)
  }

  function beginInspection(): void {
    inspectionEndAt = performance.now() + INSPECTION_MS
    setState('inspection')
  }

  function beginSolving(): void {
    solveStartAt = performance.now()
    solveStartAtWallclock = Date.now()
    setState('solving')
  }

  function notifyMoveApplied(): void {
    if (state === 'solving' && deps.getPuzzle().isSolved(deps.getState())) {
      solveEndAt = performance.now()
      sfx.chime()
      const ms = solveEndAt - solveStartAt
      for (const fn of finishListeners) fn({ ms, at: solveStartAtWallclock })
      setState('finished')
    }
  }

  function isInputLocked(): boolean {
    if (!active) return false
    return state === 'scrambling' || state === 'inspection' || state === 'finished'
  }

  function getState(): ChallengeState { return state }
  function onStateChange(fn: (s: ChallengeState) => void): void { listeners.push(fn) }
  function onFinish(fn: (f: ChallengeFinish) => void): void { finishListeners.push(fn) }

  function setActive(a: boolean): void {
    active = a
    if (!a) {
      setState('idle')
    }
  }

  // 订阅键盘 Space 等触发的 request-start
  bus.subscribe((a) => {
    if (a.type === 'request-start' && active) start()
  })

  return { overlay, start, notifyMoveApplied, isInputLocked, getState, onStateChange, onFinish, setActive }
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec - min * 60
  const cs = Math.floor((ms - totalSec * 1000) / 10) // 厘秒, 两位
  const secStr = String(sec).padStart(2, '0')
  const csStr = String(cs).padStart(2, '0')
  return min > 0 ? `${min}:${secStr}.${csStr}` : `${sec}.${csStr}`
}
