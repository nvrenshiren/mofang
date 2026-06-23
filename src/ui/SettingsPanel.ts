import type { ActionBus } from '../input/ActionBus'
import type { AppMode } from '../types'
import { load, update } from '../store/persistence'
import { sfx } from '../audio/Sfx'

/**
 * 设置面板 (浮层) —— 音效开关、反向视角开关
 *
 * 挑战模式下: 反向视角开关被强制禁用 (模拟实战, 不允许 peek 背面)
 */

export interface SettingsPanel {
  readonly root: HTMLElement
  toggle(): void
  /** 切换 mode 时同步禁用/启用反向视角开关 */
  setMode(mode: AppMode): void
}

export function createSettingsPanel(
  bus: ActionBus,
  opts: { onShowMiniUnfold: (show: boolean) => void },
): SettingsPanel {
  const root = document.createElement('div')
  root.className = 'fixed top-16 right-3 z-10 glass p-3 hidden flex-col gap-2 text-sm'
  root.style.width = '240px'

  const persisted = load()

  root.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="text-sm font-semibold text-[color:var(--color-ink-2)]">设置</span>
      <button data-role="close" class="text-[color:var(--color-ink-3)] hover:text-[color:var(--color-accent)] w-5 h-5 rounded grid place-items-center text-base leading-none">×</button>
    </div>
    <label class="flex items-center justify-between gap-2 py-1">
      <span>🔊 音效</span>
      <input data-role="sound" type="checkbox" ${!persisted.soundMuted ? 'checked' : ''} />
    </label>
    <label data-role="unfold-label" class="flex items-center justify-between gap-2 py-1">
      <span>👁 反向视角 PiP</span>
      <input data-role="unfold" type="checkbox" checked />
    </label>
    <div data-role="challenge-hint" class="hidden text-[10px] text-[color:var(--color-cube-d)] -mt-1 italic">
      挑战模式下不允许偷瞄背面
    </div>
    <div class="text-[10px] text-[color:var(--color-ink-3)] mt-2 leading-relaxed border-t border-[color:var(--color-stage-4)] pt-2">
      挑战模式下数据持久化:<br/>
      • 最近 100 局成绩自动保留<br/>
      • Best / Ao5 / Ao12 实时计算
    </div>
  `

  const unfoldCb = root.querySelector<HTMLInputElement>('[data-role="unfold"]')!
  const unfoldLabel = root.querySelector<HTMLElement>('[data-role="unfold-label"]')!
  const challengeHint = root.querySelector<HTMLElement>('[data-role="challenge-hint"]')!

  root.querySelector<HTMLButtonElement>('[data-role="close"]')!.addEventListener('click', () => toggle())

  root.querySelector<HTMLInputElement>('[data-role="sound"]')!.addEventListener('change', (e) => {
    const muted = !(e.target as HTMLInputElement).checked
    sfx.setMuted(muted)
    update({ soundMuted: muted })
  })

  unfoldCb.addEventListener('change', (e) => {
    // 挑战模式下禁用 — 即使用户绕过 (比如 devtools) 也兜底拒绝
    // (change 事件不可取消, 直接复位 checked 状态即可)
    if (unfoldCb.disabled) {
      unfoldCb.checked = false
      return
    }
    opts.onShowMiniUnfold((e.target as HTMLInputElement).checked)
  })

  function toggle(): void {
    if (root.classList.contains('hidden')) {
      root.classList.remove('hidden')
      root.classList.add('flex')
    } else {
      root.classList.add('hidden')
      root.classList.remove('flex')
    }
  }

  function setMode(mode: AppMode): void {
    const isChallenge = mode === 'challenge'
    unfoldCb.disabled = isChallenge
    if (isChallenge) {
      unfoldCb.checked = false
      unfoldLabel.style.opacity = '0.5'
      unfoldLabel.style.cursor = 'not-allowed'
      challengeHint.classList.remove('hidden')
      // 同时立即关掉反向视角 (防止从训练模式开着然后切到挑战)
      opts.onShowMiniUnfold(false)
    } else {
      // 切回非挑战模式: main.ts onModeChanged 会 force-show PiP, 这里跟随回勾, 保持 checkbox 与实际可见性一致
      unfoldCb.checked = true
      unfoldLabel.style.opacity = '1'
      unfoldLabel.style.cursor = ''
      challengeHint.classList.add('hidden')
    }
  }

  void bus
  return { root, toggle, setMode }
}
