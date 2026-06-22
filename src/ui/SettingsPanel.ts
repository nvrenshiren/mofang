import type { ActionBus } from '../input/ActionBus'
import { load, update } from '../store/persistence'
import { sfx } from '../audio/Sfx'

/**
 * 设置面板 (浮层) —— 音效开关、展开十字开关、键位提示
 *
 * 触发方式: 右上齿轮按钮 (由 TopBar 触发 dispatch 'open-settings' —— 简化起见
 * 这里直接挂一个独立的浮层按钮)
 */

export interface SettingsPanel {
  readonly root: HTMLElement
  toggle(): void
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
    <label class="flex items-center justify-between gap-2 py-1">
      <span>👁 反向视角 PiP</span>
      <input data-role="unfold" type="checkbox" checked />
    </label>
    <div class="text-[10px] text-[color:var(--color-ink-3)] mt-2 leading-relaxed border-t border-[color:var(--color-stage-4)] pt-2">
      挑战模式下数据持久化:<br/>
      • 最近 100 局成绩自动保留<br/>
      • Best / Ao5 / Ao12 实时计算
    </div>
  `

  root.querySelector<HTMLButtonElement>('[data-role="close"]')!.addEventListener('click', () => toggle())

  root.querySelector<HTMLInputElement>('[data-role="sound"]')!.addEventListener('change', (e) => {
    const muted = !(e.target as HTMLInputElement).checked
    sfx.setMuted(muted)
    update({ soundMuted: muted })
  })

  root.querySelector<HTMLInputElement>('[data-role="unfold"]')!.addEventListener('change', (e) => {
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

  void bus // 暂未用,留作扩展
  return { root, toggle }
}
