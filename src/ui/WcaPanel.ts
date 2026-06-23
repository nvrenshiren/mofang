import type { ActionBus } from '../input/ActionBus'
import type { Puzzle } from '../domain/puzzles/Puzzle'

/**
 * 通用 WCA 按钮面板 —— 内容完全由 puzzle.buttonGroups() 决定
 * 用户每次按钮点击都构造 puzzle 的 move 重新生成
 *
 * 浮窗模式: 顶栏按钮触发 toggle, 默认隐藏
 */

export interface WcaPanelHandle {
  readonly root: HTMLElement
  toggle(): void
  setVisible(v: boolean): void
  isVisible(): boolean
  setPuzzle(puzzle: Puzzle<unknown, unknown>): void
}

export function createWcaPanel(bus: ActionBus, initialPuzzle: Puzzle<unknown, unknown>): WcaPanelHandle {
  let puzzle = initialPuzzle

  const root = document.createElement('div')
  // 外层只负责定位 + 最大高度 + 隐藏溢出 (不滚动);
  // 内部 header 不滚, body 才滚
  root.className = 'fixed top-16 right-3 z-30 glass flex-col max-h-[calc(100vh-80px)] overflow-hidden shadow-2xl hidden'
  root.style.width = '320px'
  root.innerHTML = `
    <div class="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[color:var(--color-stage-4)] shrink-0">
      <div class="text-sm font-semibold text-[color:var(--color-ink-2)]" data-role="title"></div>
      <button data-role="close" class="text-[color:var(--color-ink-3)] hover:text-[color:var(--color-accent)] w-6 h-6 rounded grid place-items-center text-lg leading-none">×</button>
    </div>
    <div data-role="groups" class="flex flex-col gap-2 p-3 overflow-auto min-h-0 flex-1"></div>
  `

  const titleEl = root.querySelector<HTMLElement>('[data-role="title"]')!
  const groupsEl = root.querySelector<HTMLElement>('[data-role="groups"]')!

  function rebuild(): void {
    titleEl.textContent = `${puzzle.meta.displayName} 按钮面板`
    groupsEl.innerHTML = ''
    for (const g of puzzle.buttonGroups()) {
      const groupEl = document.createElement('div')
      groupEl.className = 'flex items-center gap-2'

      // 色块
      const dot = document.createElement('span')
      dot.className = g.color
        ? 'w-3 h-3 rounded-sm shrink-0'
        : 'w-3 h-3 rounded-sm shrink-0 bg-[color:var(--color-stage-4)]'
      if (g.color) dot.style.background = g.color
      groupEl.appendChild(dot)

      // 组标签
      const label = document.createElement('span')
      label.className = 'text-[11px] text-[color:var(--color-ink-3)] w-16 shrink-0 truncate'
      label.title = g.label
      label.textContent = g.label
      groupEl.appendChild(label)

      // 按钮网格
      const grid = document.createElement('div')
      grid.className = 'grid grid-cols-3 gap-1.5 flex-1'
      for (const b of g.buttons) {
        const btn = document.createElement('button')
        btn.className = 'wca-btn group relative px-2 py-1.5 rounded-md bg-[color:var(--color-stage-1)] hover:bg-[color:var(--color-stage-3)] border border-transparent hover:border-[color:var(--color-accent-soft)] text-xs font-mono font-semibold transition'
        btn.dataset['face'] = b.face
        btn.dataset['amount'] = String(b.amount)
        btn.dataset['label'] = b.label
        btn.title = b.label

        const lbl = document.createElement('span')
        lbl.textContent = b.label
        btn.appendChild(lbl)

        if (b.key) {
          const key = document.createElement('span')
          key.className = 'absolute right-1 bottom-0.5 text-[9px] text-[color:var(--color-ink-3)] group-hover:text-[color:var(--color-accent)] font-sans'
          key.textContent = b.key
          btn.appendChild(key)
        }
        grid.appendChild(btn)
      }
      groupEl.appendChild(grid)
      groupsEl.appendChild(groupEl)
    }
  }
  rebuild()

  root.querySelector<HTMLButtonElement>('[data-role="close"]')!.addEventListener('click', () => setVisible(false))

  // 点击按钮 → 构造 move 并 dispatch
  root.addEventListener('click', (ev) => {
    const t = ev.target instanceof HTMLElement ? ev.target.closest('button.wca-btn') : null
    if (!(t instanceof HTMLButtonElement)) return
    const label = t.dataset['label']
    if (!label) return
    // 用 puzzle.safeParse 把 label 反推为 move (跨 puzzle 通用)
    const r = puzzle.safeParse(label)
    if (!r.ok || r.moves.length === 0) return
    bus.dispatch({ type: 'move', move: r.moves[0], source: 'button' })
    flashButton(t)
  })

  bus.subscribe((a) => {
    if (a.type !== 'flash-button') return
    // 遍历按钮匹配 dataset.label, 避免 CSS 选择器注入 + 不依赖任何转义
    const buttons = root.querySelectorAll<HTMLButtonElement>('button.wca-btn')
    for (const btn of buttons) {
      if (btn.dataset['label'] === a.faceLabel) {
        flashButton(btn)
        break
      }
    }
  })

  function setVisible(v: boolean): void {
    if (v) {
      root.classList.remove('hidden')
      root.classList.add('flex')
    } else {
      root.classList.add('hidden')
      root.classList.remove('flex')
    }
  }
  function toggle(): void { setVisible(root.classList.contains('hidden')) }
  function isVisible(): boolean { return !root.classList.contains('hidden') }

  return {
    root, toggle, setVisible, isVisible,
    setPuzzle(p) { puzzle = p; rebuild() },
  }
}

function flashButton(btn: HTMLButtonElement): void {
  btn.classList.remove('flash')
  void btn.offsetWidth
  btn.classList.add('flash')
}
