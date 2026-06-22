import type { ActionBus } from '../input/ActionBus'
import type { Puzzle } from '../domain/puzzles/Puzzle'

/**
 * 公式输入面板 —— 跟当前 puzzle 绑定, 切换 puzzle 时自动更新
 */

const EXAMPLES_BY_PUZZLE: Record<string, { label: string; formula: string }[]> = {
  '3x3': [
    { label: 'Sexy', formula: "R U R' U'" },
    { label: 'Sledgehammer', formula: "R' F R F'" },
    { label: 'T-Perm', formula: "R U R' U' R' F R2 U' R' U' R U R' F'" },
    { label: '6-cycle', formula: "(R U R' U')6" },
  ],
  '2x2': [
    { label: 'Sune', formula: "R U R' U R U2 R'" },
    { label: 'Sexy x2', formula: "(R U R' U')2" },
  ],
  '4x4': [
    { label: 'Sexy', formula: "R U R' U'" },
    { label: 'Wide R', formula: 'Rw' },
    { label: '3R demo', formula: '3Rw U' },
  ],
}

function examplesFor(id: string): { label: string; formula: string }[] {
  return EXAMPLES_BY_PUZZLE[id] ?? [{ label: 'Sexy', formula: "R U R' U'" }]
}

export interface FormulaInput {
  readonly root: HTMLElement
  setPuzzle(puzzle: Puzzle<unknown, unknown>): void
}

export function createFormulaInput(bus: ActionBus, initialPuzzle: Puzzle<unknown, unknown>): FormulaInput {
  let puzzle = initialPuzzle
  const root = document.createElement('div')
  root.className = 'glass p-3 flex flex-col gap-2'
  root.innerHTML = `
    <div class="text-sm font-semibold text-[color:var(--color-ink-2)]">公式输入</div>
    <textarea
      data-role="input"
      class="bg-[color:var(--color-stage-1)] border border-[color:var(--color-stage-4)] rounded p-2 text-sm font-mono resize-none focus:outline-none focus:border-[color:var(--color-accent)]"
      rows="3"
      placeholder="例: R U R' U'"
      spellcheck="false"
      autocomplete="off"
    ></textarea>
    <div data-role="status" class="text-xs text-[color:var(--color-ink-3)] h-4"></div>
    <div class="flex gap-2">
      <button data-role="run" class="flex-1 px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-stage-0)] text-sm font-semibold hover:brightness-110 transition">执行 ▶</button>
      <button data-role="clear" class="px-3 py-1.5 rounded glass text-sm">清空</button>
    </div>
    <div class="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-3)] mt-1">示例</div>
    <div data-role="examples" class="flex flex-wrap gap-1.5"></div>
  `

  const input = root.querySelector<HTMLTextAreaElement>('[data-role="input"]')!
  const status = root.querySelector<HTMLElement>('[data-role="status"]')!
  const runBtn = root.querySelector<HTMLButtonElement>('[data-role="run"]')!
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-role="clear"]')!
  const examplesBox = root.querySelector<HTMLElement>('[data-role="examples"]')!

  let cached: unknown[] = []

  function renderExamples(): void {
    examplesBox.innerHTML = ''
    for (const ex of examplesFor(puzzle.meta.id)) {
      const b = document.createElement('button')
      b.className = 'px-2 py-1 rounded glass text-xs hover:text-[color:var(--color-accent)] transition'
      b.textContent = ex.label
      b.title = ex.formula
      b.addEventListener('click', () => {
        input.value = ex.formula
        input.dispatchEvent(new Event('input'))
        input.focus()
      })
      examplesBox.appendChild(b)
    }
  }

  function validate(): void {
    if (input.value.trim() === '') {
      status.textContent = ''
      runBtn.disabled = true
      runBtn.style.opacity = '0.5'
      cached = []
      return
    }
    const r = puzzle.safeParse(input.value)
    if (r.ok) {
      cached = r.moves
      status.textContent = `✓ 解析 ${r.moves.length} 步`
      status.style.color = 'var(--color-cube-f)'
      runBtn.disabled = false
      runBtn.style.opacity = '1'
    } else {
      cached = []
      status.textContent = `✗ ${r.error}`
      status.style.color = 'var(--color-cube-r)'
      runBtn.disabled = true
      runBtn.style.opacity = '0.5'
    }
  }
  input.addEventListener('input', validate)
  validate()
  renderExamples()

  runBtn.addEventListener('click', () => {
    for (const m of cached) bus.dispatch({ type: 'move', move: m, source: 'formula' })
  })
  clearBtn.addEventListener('click', () => {
    input.value = ''
    validate()
    input.focus()
  })

  return {
    root,
    setPuzzle(p) {
      puzzle = p
      input.value = ''
      validate()
      renderExamples()
    },
  }
}
