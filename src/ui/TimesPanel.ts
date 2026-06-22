import { effectiveMs, formatMs, type TimesStore } from '../challenge/Times'

/**
 * 挑战成绩面板
 *   - 三大数据: Best / Ao5 / Ao12
 *   - 最近 N 局列表 (可点击设 +2 / DNF / 删除)
 *   - 持久化 + 跨会话保留
 *   - 仅在挑战模式显示
 */

export interface TimesPanel {
  readonly root: HTMLElement
  refresh(): void
  setVisible(v: boolean): void
}

export function createTimesPanel(store: TimesStore): TimesPanel {
  const root = document.createElement('div')
  root.className = 'glass p-3 flex-col gap-2 min-h-0 hidden'
  root.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-[color:var(--color-cube-f)] shadow-[0_0_6px_var(--color-cube-f)]"></span>
        <span class="text-sm font-semibold text-[color:var(--color-ink-2)]">挑战成绩</span>
      </div>
      <button data-role="clear" class="text-xs px-2 py-0.5 rounded glass hover:text-[color:var(--color-cube-r)]">清空</button>
    </div>

    <div class="grid grid-cols-3 gap-2 bg-[color:var(--color-stage-1)] border border-[color:var(--color-stage-4)] rounded p-2">
      <div class="text-center">
        <div class="text-[9px] uppercase tracking-wider text-[color:var(--color-ink-3)]">Best</div>
        <div data-role="best" class="text-lg font-mono font-bold text-[color:var(--color-cube-f)]">—</div>
      </div>
      <div class="text-center">
        <div class="text-[9px] uppercase tracking-wider text-[color:var(--color-ink-3)]">Ao5</div>
        <div data-role="ao5" class="text-lg font-mono font-bold text-[color:var(--color-ink-1)]">—</div>
      </div>
      <div class="text-center">
        <div class="text-[9px] uppercase tracking-wider text-[color:var(--color-ink-3)]">Ao12</div>
        <div data-role="ao12" class="text-lg font-mono font-bold text-[color:var(--color-ink-1)]">—</div>
      </div>
    </div>

    <div class="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-3)] mt-1 flex justify-between">
      <span>最近</span>
      <span data-role="count">0 局</span>
    </div>
    <div data-role="recent" class="flex-1 min-h-0 overflow-auto flex flex-col gap-0.5 pr-1"></div>
  `

  const bestEl = root.querySelector<HTMLElement>('[data-role="best"]')!
  const ao5El = root.querySelector<HTMLElement>('[data-role="ao5"]')!
  const ao12El = root.querySelector<HTMLElement>('[data-role="ao12"]')!
  const countEl = root.querySelector<HTMLElement>('[data-role="count"]')!
  const recentEl = root.querySelector<HTMLElement>('[data-role="recent"]')!

  root.querySelector<HTMLButtonElement>('[data-role="clear"]')!.addEventListener('click', () => {
    if (store.records.length === 0) return
    if (!confirm('确定清空所有挑战成绩?这个操作无法撤销。')) return
    store.clear()
  })

  function refresh(): void {
    const best = store.best()
    bestEl.textContent = best ? formatMs(effectiveMs(best.record)) : '—'
    const a5 = store.ao5()
    const a12 = store.ao12()
    ao5El.textContent = a5 === null ? '—' : formatMs(a5)
    ao12El.textContent = a12 === null ? '—' : formatMs(a12)
    countEl.textContent = `${store.records.length} 局`

    // 最近 N 局: 最新在上
    recentEl.innerHTML = ''
    const list = [...store.records].reverse().slice(0, 20)
    const bestIndex = best?.index ?? -1
    list.forEach((r, i) => {
      const originalIdx = store.records.length - 1 - i
      const isBest = originalIdx === bestIndex
      const row = document.createElement('div')
      row.className = 'flex items-center justify-between gap-1 text-xs font-mono px-1.5 py-0.5 rounded hover:bg-[color:var(--color-stage-3)] group'
      const timeColor =
        r.penalty === 'dnf' ? 'var(--color-ink-3)' :
        isBest ? 'var(--color-cube-f)' :
        'var(--color-ink-1)'
      const penTag =
        r.penalty === 'plus2' ? '<span class="text-[9px] text-[color:var(--color-cube-d)]">+2</span>' :
        r.penalty === 'dnf' ? '<span class="text-[9px] text-[color:var(--color-cube-r)]">DNF</span>' : ''
      row.innerHTML = `
        <span class="text-[color:var(--color-ink-3)] w-6 text-right">${store.records.length - i}.</span>
        <span style="color: ${timeColor}" class="flex-1">${formatMs(effectiveMs(r))}</span>
        ${penTag}
        <div class="opacity-0 group-hover:opacity-100 flex gap-0.5 transition">
          <button data-act="plus2" class="text-[9px] px-1 py-0.5 rounded hover:bg-[color:var(--color-cube-d)] hover:text-black" title="+2 罚时">+2</button>
          <button data-act="dnf" class="text-[9px] px-1 py-0.5 rounded hover:bg-[color:var(--color-cube-r)] hover:text-white" title="标记 DNF">DNF</button>
          <button data-act="ok" class="text-[9px] px-1 py-0.5 rounded hover:bg-[color:var(--color-cube-f)] hover:text-black" title="清除惩罚">OK</button>
          <button data-act="del" class="text-[9px] px-1 py-0.5 rounded hover:bg-[color:var(--color-stage-4)]" title="删除">×</button>
        </div>
      `
      row.addEventListener('click', (ev) => {
        const t = ev.target instanceof HTMLElement ? ev.target.closest('[data-act]') : null
        if (!(t instanceof HTMLButtonElement)) return
        const act = t.dataset['act']
        if (act === 'plus2') store.setPenalty(originalIdx, 'plus2')
        else if (act === 'dnf') store.setPenalty(originalIdx, 'dnf')
        else if (act === 'ok') store.setPenalty(originalIdx, 'ok')
        else if (act === 'del') store.remove(originalIdx)
      })
      recentEl.appendChild(row)
    })
  }

  function setVisible(v: boolean): void {
    if (v) {
      root.classList.remove('hidden')
      root.classList.add('flex')
    } else {
      root.classList.add('hidden')
      root.classList.remove('flex')
    }
  }

  store.subscribe(refresh)
  refresh()

  return { root, refresh, setVisible }
}
