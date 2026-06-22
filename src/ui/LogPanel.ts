import type { ActionBus } from '../input/ActionBus'
import type { Puzzle } from '../domain/puzzles/Puzzle'

export interface LogPanel {
  readonly root: HTMLElement
  setMoves(moves: readonly unknown[]): void
  current(): unknown[]
  setPuzzle(puzzle: Puzzle<unknown, unknown>): void
}

export function createLogPanel(bus: ActionBus, initialPuzzle: Puzzle<unknown, unknown>): LogPanel {
  let puzzle = initialPuzzle
  const root = document.createElement('div')
  root.className = 'glass p-3 flex flex-col gap-2 min-h-0'
  root.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm font-semibold text-[color:var(--color-ink-2)]">操作日志</div>
      <div class="flex items-center gap-1">
        <button data-role="copy" class="text-xs px-2 py-0.5 rounded glass hover:text-[color:var(--color-accent)]">复制</button>
        <button data-role="clear" class="text-xs px-2 py-0.5 rounded glass hover:text-[color:var(--color-accent)]">清空</button>
      </div>
    </div>
    <div data-role="count" class="text-[10px] text-[color:var(--color-ink-3)]">0 步</div>
    <div
      data-role="entries"
      class="flex-1 min-h-0 overflow-auto bg-[color:var(--color-stage-1)] border border-[color:var(--color-stage-4)] rounded p-2 text-sm font-mono leading-7 flex flex-wrap items-start content-start gap-1"
    ></div>
  `

  const entries = root.querySelector<HTMLElement>('[data-role="entries"]')!
  const count = root.querySelector<HTMLElement>('[data-role="count"]')!
  let moves: unknown[] = []

  function setMoves(next: readonly unknown[]): void {
    moves = next.slice()
    entries.innerHTML = ''
    for (const m of moves) {
      const span = document.createElement('span')
      span.className = 'inline-block px-1.5 py-0.5 rounded bg-[color:var(--color-stage-3)] text-[color:var(--color-ink-1)] hover:bg-[color:var(--color-stage-4)] transition cursor-default'
      span.textContent = puzzle.format(m)
      entries.appendChild(span)
    }
    entries.scrollTop = entries.scrollHeight
    count.textContent = `${moves.length} 步`
  }

  root.querySelector<HTMLButtonElement>('[data-role="copy"]')!.addEventListener('click', () => {
    void navigator.clipboard.writeText(puzzle.formatMoves(moves))
  })
  root.querySelector<HTMLButtonElement>('[data-role="clear"]')!.addEventListener('click', () => {
    bus.dispatch({ type: 'clear-log' })
    setMoves([])
  })
  bus.subscribe((a) => {
    if (a.type === 'clear-log') setMoves([])
  })

  return {
    root, setMoves, current: () => moves.slice(),
    setPuzzle(p) { puzzle = p; setMoves(moves) },
  }
}
