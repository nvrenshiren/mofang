import type { ActionBus, AppMode } from '../input/ActionBus'
import { PUZZLES } from '../domain/puzzles/registry'
import type { Puzzle, PuzzleId } from '../domain/puzzles/Puzzle'

/**
 * 顶部栏 —— Logo + 模式切换 + 撤销/重做 + 重置/打乱
 *
 * 三个模式:
 *   - training (训练): 默认。WCA 标准姿态锁定,按钮面板常驻
 *   - free (自由): 允许 OrbitControls 自由转视角 (后续实现)
 *   - challenge (挑战): 隐藏按钮面板键位提示,模拟实战
 */

export interface TopBarHandle {
  readonly root: HTMLElement
  setMode(mode: AppMode): void
  setUndoEnabled(can: boolean): void
  setRedoEnabled(can: boolean): void
  setWcaButtonVisible(visible: boolean): void
  /** 切换右侧按钮组: false=练习布局 (撤销/重做/重置/打乱), true=挑战布局 (仅开始) */
  setChallengeLayout(challenge: boolean): void
  setStartButtonLabel(label: string): void
  setCurrentPuzzle(id: PuzzleId): void
  /** 锁定/解锁 puzzle 下拉 (挑战进行中应锁) */
  setPuzzleSelectorEnabled(enabled: boolean): void
  /** 切换 puzzle 时刷新快捷键 tooltip 内容 (从 puzzle.keymap() 生成) */
  setPuzzleForKeyHints(puzzle: Puzzle<unknown, unknown>): void
  onWcaToggle(fn: () => void): void
  /** 挑战模式 "开始/重新开始" 按钮点击; 默认 dispatch request-start */
  onStartClick(fn: () => void): void
  onSettingsToggle(fn: () => void): void
}

const KEY_TOOLTIP_PRACTICE = `
  <div class="text-xs font-mono leading-relaxed">
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <span class="text-[color:var(--color-accent)]">R U F L D B</span><span>外层 6 面 顺时针 90°</span>
      <span class="text-[color:var(--color-accent)]">M E S</span><span>中层</span>
      <span class="text-[color:var(--color-accent)]">; [ -</span><span>整体 y x z</span>
      <span class="text-[color:var(--color-accent)]">Shift+键</span><span>反向 (prime)</span>
      <span class="text-[color:var(--color-accent)]">Alt+键</span><span>180°</span>
    </div>
    <div class="h-px my-2 bg-[color:var(--color-stage-4)]"></div>
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <span class="text-[color:var(--color-accent)]">Ctrl+Z</span><span>撤销</span>
      <span class="text-[color:var(--color-accent)]">Ctrl+⇧+Z</span><span>重做</span>
      <span class="text-[color:var(--color-accent)]">Esc</span><span>重置魔方</span>
      <span class="text-[color:var(--color-accent)]">Space</span><span>打乱</span>
    </div>
  </div>
`

const KEY_TOOLTIP_CHALLENGE = `
  <div class="text-xs font-mono leading-relaxed">
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <span class="text-[color:var(--color-accent)]">R U F L D B</span><span>外层 6 面 顺时针 90°</span>
      <span class="text-[color:var(--color-accent)]">M E S</span><span>中层</span>
      <span class="text-[color:var(--color-accent)]">; [ -</span><span>整体 y x z</span>
      <span class="text-[color:var(--color-accent)]">Shift+键</span><span>反向 (prime)</span>
      <span class="text-[color:var(--color-accent)]">Alt+键</span><span>180°</span>
    </div>
    <div class="h-px my-2 bg-[color:var(--color-stage-4)]"></div>
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <span class="text-[color:var(--color-accent)]">Space</span><span>开始 / 重新开始</span>
    </div>
    <div class="text-[10px] text-[color:var(--color-ink-3)] mt-2 italic">实战模式: 无撤销 / 重做 / 重置</div>
  </div>
`

export function createTopBar(bus: ActionBus): TopBarHandle {
  const root = document.createElement('header')
  root.className = 'flex items-center justify-between px-5 border-b border-[color:var(--color-stage-4)]'
  root.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 rounded grid grid-cols-2 grid-rows-2 gap-px overflow-hidden shadow-inner">
        <div style="background: var(--color-cube-u)"></div>
        <div style="background: var(--color-cube-r)"></div>
        <div style="background: var(--color-cube-f)"></div>
        <div style="background: var(--color-cube-b)"></div>
      </div>
      <div>
        <div class="font-semibold tracking-wide leading-tight">Cubelab</div>
        <div class="text-[color:var(--color-ink-3)] text-xs leading-tight">魔方实验室 · WCA 练习场</div>
      </div>
      <select data-role="puzzle" class="ml-3 bg-[color:var(--color-stage-1)] border border-[color:var(--color-stage-4)] rounded px-2 py-1 text-xs hover:border-[color:var(--color-accent)] focus:outline-none focus:border-[color:var(--color-accent)]" title="切换谜题">
        ${PUZZLES.map((p) => `<option value="${p.id}">${p.icon} ${p.displayName}</option>`).join('')}
      </select>
    </div>

    <div data-role="mode-switch" class="flex glass p-0.5 text-sm">
      ${(['training', 'free', 'challenge'] as AppMode[])
        .map(
          (m) => `<button data-mode="${m}" class="px-3 py-1 rounded transition">${
            m === 'training' ? '训练' : m === 'free' ? '自由' : '挑战'
          }</button>`,
        )
        .join('')}
    </div>

    <div class="flex items-center gap-1.5 text-sm">
      <button data-role="wca" class="px-3 py-1 rounded glass hover:text-[color:var(--color-accent)] transition" title="WCA 按钮面板">⊞ WCA 面板</button>

      <div data-role="kbd-wrap" class="relative">
        <button data-role="kbd" class="px-3 py-1 rounded glass hover:text-[color:var(--color-accent)] transition">⌨ 快捷键</button>
        <div data-role="kbd-tip" class="absolute top-full right-0 mt-2 glass px-3 py-2 w-72 z-40 pointer-events-none opacity-0 transition-opacity duration-150">
          ${KEY_TOOLTIP_PRACTICE}
        </div>
      </div>

      <button data-role="settings" class="w-8 h-8 rounded glass hover:text-[color:var(--color-accent)] transition" title="设置">⚙</button>

      <div data-role="divider" class="w-px h-5 bg-[color:var(--color-stage-4)] mx-1"></div>

      <!-- 练习布局: 撤销/重做/重置/打乱 -->
      <div data-role="practice-group" class="flex items-center gap-1.5">
        <button data-role="undo" class="px-2.5 py-1 rounded glass hover:text-[color:var(--color-accent)] transition" title="撤销 (Ctrl+Z)">↶</button>
        <button data-role="redo" class="px-2.5 py-1 rounded glass hover:text-[color:var(--color-accent)] transition" title="重做 (Ctrl+Shift+Z)">↷</button>
        <button data-role="reset" class="px-3 py-1 rounded glass hover:text-[color:var(--color-accent)] transition" title="重置 (Esc)">重置</button>
        <button data-role="scramble" class="px-3 py-1 rounded glass hover:text-[color:var(--color-accent)] transition" title="打乱 (Space)">打乱</button>
      </div>

      <!-- 挑战布局: 只有开始 -->
      <button data-role="start" class="hidden px-4 py-1 rounded bg-[color:var(--color-accent)] text-[color:var(--color-stage-0)] font-semibold hover:brightness-110 transition" title="开始挑战 (随机打乱)">▶ 开始</button>
    </div>
  `

  const undoBtn = root.querySelector<HTMLButtonElement>('[data-role="undo"]')!
  const redoBtn = root.querySelector<HTMLButtonElement>('[data-role="redo"]')!
  undoBtn.addEventListener('click', () => bus.dispatch({ type: 'undo' }))
  redoBtn.addEventListener('click', () => bus.dispatch({ type: 'redo' }))
  root.querySelector<HTMLButtonElement>('[data-role="reset"]')!.addEventListener('click', () => bus.dispatch({ type: 'reset' }))
  root.querySelector<HTMLButtonElement>('[data-role="scramble"]')!.addEventListener('click', () => bus.dispatch({ type: 'scramble' }))
  let startHandler: () => void = () => bus.dispatch({ type: 'request-start' })
  root.querySelector<HTMLButtonElement>('[data-role="start"]')!.addEventListener('click', () => startHandler())

  // 模式切换
  const modeBox = root.querySelector<HTMLElement>('[data-role="mode-switch"]')!
  modeBox.addEventListener('click', (ev) => {
    const t = ev.target instanceof HTMLElement ? ev.target.closest('[data-mode]') : null
    if (!(t instanceof HTMLButtonElement)) return
    const mode = t.dataset['mode'] as AppMode
    bus.dispatch({ type: 'mode-change', mode })
  })

  const kbdTipEl = root.querySelector<HTMLElement>('[data-role="kbd-tip"]')!
  let currentMode: AppMode = 'training'
  let currentPuzzleForHints: Puzzle<unknown, unknown> | null = null

  function renderKeyHints(): void {
    if (currentPuzzleForHints) {
      kbdTipEl.innerHTML = buildPuzzleKeyTooltip(currentPuzzleForHints, currentMode === 'challenge')
    } else {
      kbdTipEl.innerHTML = currentMode === 'challenge' ? KEY_TOOLTIP_CHALLENGE : KEY_TOOLTIP_PRACTICE
    }
  }

  function setMode(mode: AppMode): void {
    currentMode = mode
    modeBox.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
      const active = b.dataset['mode'] === mode
      b.classList.toggle('bg-[color:var(--color-accent-soft)]', active)
      b.classList.toggle('text-[color:var(--color-accent)]', active)
      b.classList.toggle('text-[color:var(--color-ink-2)]', !active)
    })
    renderKeyHints()
  }
  function setPuzzleForKeyHints(p: Puzzle<unknown, unknown>): void {
    currentPuzzleForHints = p
    renderKeyHints()
  }
  setMode('training')

  function setUndoEnabled(can: boolean): void {
    undoBtn.disabled = !can
    undoBtn.style.opacity = can ? '1' : '0.4'
  }
  function setRedoEnabled(can: boolean): void {
    redoBtn.disabled = !can
    redoBtn.style.opacity = can ? '1' : '0.4'
  }
  setUndoEnabled(false)
  setRedoEnabled(false)

  // ---- WCA 面板按钮 ----
  let wcaToggleHandler: () => void = () => {}
  root.querySelector<HTMLButtonElement>('[data-role="wca"]')!.addEventListener('click', () => wcaToggleHandler())

  // ---- 快捷键 tooltip 悬停 ----
  const kbdWrap = root.querySelector<HTMLElement>('[data-role="kbd-wrap"]')!
  const kbdTip = root.querySelector<HTMLElement>('[data-role="kbd-tip"]')!
  kbdWrap.addEventListener('mouseenter', () => {
    kbdTip.style.opacity = '1'
  })
  kbdWrap.addEventListener('mouseleave', () => {
    kbdTip.style.opacity = '0'
  })

  function onWcaToggle(fn: () => void): void { wcaToggleHandler = fn }

  const wcaBtn = root.querySelector<HTMLButtonElement>('[data-role="wca"]')!
  function setWcaButtonVisible(visible: boolean): void {
    wcaBtn.style.display = visible ? '' : 'none'
  }

  const practiceGroup = root.querySelector<HTMLElement>('[data-role="practice-group"]')!
  const startBtn = root.querySelector<HTMLButtonElement>('[data-role="start"]')!
  function setStartButtonLabel(label: string): void { startBtn.textContent = label }
  function onStartClick(fn: () => void): void { startHandler = fn }

  let settingsHandler: () => void = () => {}
  root.querySelector<HTMLButtonElement>('[data-role="settings"]')!.addEventListener('click', () => settingsHandler())
  function onSettingsToggle(fn: () => void): void { settingsHandler = fn }
  function setChallengeLayout(challenge: boolean): void {
    if (challenge) {
      practiceGroup.classList.add('hidden')
      practiceGroup.classList.remove('flex')
      startBtn.classList.remove('hidden')
    } else {
      practiceGroup.classList.remove('hidden')
      practiceGroup.classList.add('flex')
      startBtn.classList.add('hidden')
    }
  }

  // 谜题下拉
  const puzzleSel = root.querySelector<HTMLSelectElement>('[data-role="puzzle"]')!
  puzzleSel.addEventListener('change', () => {
    bus.dispatch({ type: 'puzzle-change', puzzleId: puzzleSel.value as PuzzleId })
  })
  function setCurrentPuzzle(id: PuzzleId): void { puzzleSel.value = id }
  function setPuzzleSelectorEnabled(enabled: boolean): void {
    puzzleSel.disabled = !enabled
    puzzleSel.style.opacity = enabled ? '1' : '0.45'
    puzzleSel.style.cursor = enabled ? '' : 'not-allowed'
    puzzleSel.title = enabled ? '切换谜题' : '挑战进行中,请先点 "重新开始" 中止后再切换'
  }

  return {
    root, setMode, setUndoEnabled, setRedoEnabled,
    setWcaButtonVisible, setChallengeLayout, setStartButtonLabel,
    setCurrentPuzzle, setPuzzleSelectorEnabled, setPuzzleForKeyHints,
    onWcaToggle, onStartClick, onSettingsToggle,
  }
}

/**
 * 从 puzzle.keymap() 动态生成快捷键 tooltip
 * 把同样 key 字符按行排列, 每行: [key] = [faceLabel]
 * 挑战模式下隐去系统快捷键
 */
function buildPuzzleKeyTooltip(puzzle: Puzzle<unknown, unknown>, isChallenge: boolean): string {
  const km = puzzle.keymap()
  const rows = km.map((b) => `
    <span class="text-[color:var(--color-accent)]">${escapeHtml(b.key)}</span>
    <span>${escapeHtml(b.faceLabel)}</span>
  `).join('')
  const sysRows = isChallenge
    ? `<span class="text-[color:var(--color-accent)]">Space</span><span>开始 / 重新开始</span>`
    : `
      <span class="text-[color:var(--color-accent)]">Shift+键</span><span>反向 (prime)</span>
      <span class="text-[color:var(--color-accent)]">Alt+键</span><span>180°</span>
      <span class="text-[color:var(--color-accent)]">Ctrl+Z</span><span>撤销</span>
      <span class="text-[color:var(--color-accent)]">Ctrl+⇧+Z</span><span>重做</span>
      <span class="text-[color:var(--color-accent)]">Esc</span><span>重置魔方</span>
      <span class="text-[color:var(--color-accent)]">Space</span><span>打乱</span>
    `
  const footer = isChallenge
    ? `<div class="text-[10px] text-[color:var(--color-ink-3)] mt-2 italic">实战模式: 无撤销 / 重做 / 重置</div>`
    : ''
  return `
    <div class="text-xs font-mono leading-relaxed">
      <div class="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-3)] mb-1">${escapeHtml(puzzle.meta.displayName)}</div>
      <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">${rows}</div>
      <div class="h-px my-2 bg-[color:var(--color-stage-4)]"></div>
      <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">${sysRows}</div>
      ${footer}
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
