import type { Puzzle } from '../domain/puzzles/Puzzle'

export interface ScramblePanel {
  readonly root: HTMLElement
  setMoves(moves: readonly unknown[]): void
  current(): readonly unknown[]
  setPuzzle(puzzle: Puzzle<unknown, unknown>): void
}

export function createScramblePanel(initialPuzzle: Puzzle<unknown, unknown>): ScramblePanel {
  let puzzle = initialPuzzle
  const root = document.createElement('div')
  root.className = 'glass p-3 flex-col gap-2 hidden'
  root.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-[color:var(--color-cube-d)] shadow-[0_0_6px_var(--color-cube-d)]"></span>
        <span class="text-sm font-semibold text-[color:var(--color-ink-2)]">当前打乱</span>
        <span data-role="count" class="text-[10px] text-[color:var(--color-ink-3)]"></span>
      </div>
      <button data-role="copy" class="text-xs px-2 py-0.5 rounded glass hover:text-[color:var(--color-accent)]">复制</button>
    </div>
    <div data-role="formula" class="text-sm font-mono leading-relaxed text-[color:var(--color-ink-1)] bg-[color:var(--color-stage-1)] border border-[color:var(--color-stage-4)] rounded p-2 break-words"></div>
  `

  const formulaEl = root.querySelector<HTMLElement>('[data-role="formula"]')!
  const countEl = root.querySelector<HTMLElement>('[data-role="count"]')!
  let moves: unknown[] = []

  function refresh(): void {
    if (moves.length === 0) {
      root.classList.add('hidden')
      root.classList.remove('flex')
      return
    }
    root.classList.remove('hidden')
    root.classList.add('flex')
    formulaEl.textContent = puzzle.formatMoves(moves)
    countEl.textContent = `${moves.length} 步`
  }

  function setMoves(next: readonly unknown[]): void {
    moves = next.slice()
    refresh()
  }

  root.querySelector<HTMLButtonElement>('[data-role="copy"]')!.addEventListener('click', () => {
    void navigator.clipboard.writeText(puzzle.formatMoves(moves))
  })

  return {
    root, setMoves,
    current: () => moves.slice(),
    setPuzzle(p) { puzzle = p; refresh() },
  }
}
