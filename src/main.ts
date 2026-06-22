import './app.css'
import { Stage } from './render/Stage'
import { FreeOrbit } from './render/FreeOrbit'
import { ActionBus } from './input/ActionBus'
import { installKeyboard } from './input/Keyboard'
import { AppStore } from './store/AppStore'
import { load, update } from './store/persistence'
import { sfx } from './audio/Sfx'
import { createTopBar } from './ui/TopBar'
import { createWcaPanel } from './ui/WcaPanel'
import { createFormulaInput } from './ui/FormulaInput'
import { createLogPanel } from './ui/LogPanel'
import { createScramblePanel } from './ui/ScramblePanel'
import { createMiniBackView } from './ui/MiniBackView'
import { appliedMoves } from './domain/history/HistoryStack'
import { createChallengeController } from './challenge/ChallengeController'
import { TimesStore } from './challenge/Times'
import { createTimesPanel } from './ui/TimesPanel'
import { createSettingsPanel } from './ui/SettingsPanel'
import { PUZZLES } from './domain/puzzles/registry'
import type { Puzzle, PuzzleId } from './domain/puzzles/Puzzle'

/**
 * 装配顺序约定:
 *   1. 计算 initialPuzzleId, 拿到一个独立 puzzle 实例 (仅用于 UI 初始化, 不挂渲染)
 *   2. 创建所有 UI 元素 (TopBar / Formula / Log / Scramble / Wca / Times / Settings)
 *   3. 创建 Stage + Challenge overlay
 *   4. 创建 AppStore (拥有真正的 puzzle + renderer, mount 到 stage)
 *   5. 接 store 回调 (此时 UI 都已存在, 无 TDZ 风险)
 *   6. 挂键盘, 恢复 mode, 注册 sfx 激活
 */

const persisted = load()
const initialPuzzleId: PuzzleId = persisted.puzzleId ?? '3x3'
const initialPuzzleEntry = PUZZLES.find((p) => p.id === initialPuzzleId) ?? PUZZLES[1]!
const initialPuzzleForUI = initialPuzzleEntry.createPuzzle()

const app = document.getElementById('app')!
app.innerHTML = ''
app.style.display = 'grid'
app.style.gridTemplateRows = '56px 1fr'
app.style.height = '100vh'

const bus = new ActionBus()

// 顶栏
const topBar = createTopBar(bus)
app.appendChild(topBar.root)

// 主区
const main = document.createElement('main')
main.className = 'grid gap-3 p-3 min-h-0'
main.style.gridTemplateColumns = '300px 1fr 300px'
app.appendChild(main)

// 左:公式
const leftCol = document.createElement('div')
leftCol.className = 'flex flex-col gap-3 min-h-0 overflow-auto'
main.appendChild(leftCol)
const formula = createFormulaInput(bus, initialPuzzleForUI)
leftCol.appendChild(formula.root)

// 中:舞台
const stageWrap = document.createElement('section')
stageWrap.className = 'relative min-h-0'
main.appendChild(stageWrap)
const stageEl = document.createElement('div')
stageEl.className = 'absolute inset-0 rounded-[14px] overflow-hidden'
stageWrap.appendChild(stageEl)
const stage = new Stage(stageEl)
const freeOrbit = new FreeOrbit(stage)

const stageHint = document.createElement('div')
stageHint.className = 'absolute bottom-3 left-3 text-xs text-[color:var(--color-ink-3)] glass px-2 py-1 pointer-events-none'
stageHint.textContent = '白顶 / 绿前 · WCA 标准姿态'
stageWrap.appendChild(stageHint)

const miniBack = createMiniBackView(stage, stageWrap)

const solveRipple = document.createElement('div')
solveRipple.className = 'absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-700'
solveRipple.style.background = 'radial-gradient(circle at center, var(--color-accent-glow) 0%, transparent 60%)'
stageWrap.appendChild(solveRipple)

// 右:成绩 / 打乱 / 日志
const rightCol = document.createElement('div')
rightCol.className = 'flex flex-col gap-3 min-h-0'
main.appendChild(rightCol)

let timesStore = new TimesStore(initialPuzzleId)
let timesPanel = createTimesPanel(timesStore)
rightCol.appendChild(timesPanel.root)

const scramblePanel = createScramblePanel(initialPuzzleForUI)
rightCol.appendChild(scramblePanel.root)

const logPanel = createLogPanel(bus, initialPuzzleForUI)
rightCol.appendChild(logPanel.root)

// WCA 浮窗 (默认隐藏, 顶栏按钮触发)
const wcaPanel = createWcaPanel(bus, initialPuzzleForUI)
app.appendChild(wcaPanel.root)
topBar.onWcaToggle(() => wcaPanel.toggle())

// 设置浮窗
const settings = createSettingsPanel(bus, {
  onShowMiniUnfold: (show) => miniBack.setVisible(show),
})
app.appendChild(settings.root)
topBar.onSettingsToggle(() => settings.toggle())

// ---- Store (此时所有 UI 已存在) ----
let wasSolved = true
const store = new AppStore(stage, bus, initialPuzzleId, {
  onAnyMoveApplied: () => {
    sfx.clack()
    const nowSolved = store.puzzle.isSolved(store.state)
    if (nowSolved && !wasSolved && store.mode !== 'challenge') {
      sfx.chime()
      solveRipple.style.opacity = '1'
      setTimeout(() => { solveRipple.style.opacity = '0' }, 700)
    }
    wasSolved = nowSolved
    challenge.notifyMoveApplied()
  },
  onHistoryChanged: (h) => {
    logPanel.setMoves(appliedMoves(h))
    topBar.setUndoEnabled(store.canUndo())
    topBar.setRedoEnabled(store.canRedo())
  },
  onScrambleChanged: (scr) => {
    scramblePanel.setMoves(scr)
  },
  onModeChanged: (mode) => {
    topBar.setMode(mode)
    update({ mode })
    freeOrbit.setEnabled(mode === 'free')
    miniBack.setVisible(mode !== 'challenge' && store.puzzle.meta.category === 'nxn')
    if (mode === 'challenge') wcaPanel.setVisible(false)
    topBar.setWcaButtonVisible(mode !== 'challenge')
    topBar.setChallengeLayout(mode === 'challenge')
    formula.root.style.display = mode === 'challenge' ? 'none' : ''
    timesPanel.setVisible(mode === 'challenge')
    if (mode !== 'challenge') scramblePanel.root.style.display = ''
    challenge.setActive(mode === 'challenge')
    // 切回非挑战模式: 谜题下拉应解锁 (挑战已被 setActive(false) 重置为 idle)
    if (mode !== 'challenge') topBar.setPuzzleSelectorEnabled(true)
  },
  onPuzzleChanged: (p: Puzzle<unknown, unknown>) => {
    update({ puzzleId: p.meta.id })
    topBar.setCurrentPuzzle(p.meta.id)
    formula.setPuzzle(p)
    logPanel.setPuzzle(p)
    scramblePanel.setPuzzle(p)
    wcaPanel.setPuzzle(p)
    topBar.setPuzzleForKeyHints(p)
    // Per-puzzle TimesStore: 用新 store 替换旧 panel
    const oldPanel = timesPanel.root
    timesStore = new TimesStore(p.meta.id)
    timesPanel = createTimesPanel(timesStore)
    rightCol.replaceChild(timesPanel.root, oldPanel)
    timesPanel.setVisible(store.mode === 'challenge')
    miniBack.setVisible(store.mode !== 'challenge' && p.meta.category === 'nxn')
    wasSolved = true
  },
})

// 挑战
const challenge = createChallengeController(bus, {
  getPuzzle: () => store.puzzle,
  getRenderer: () => store.renderer,
  getState: () => store.state,
})
stageWrap.appendChild(challenge.overlay)

topBar.onStartClick(() => challenge.start())
challenge.onStateChange((s) => {
  topBar.setStartButtonLabel(s === 'idle' ? '▶ 开始' : '↻ 重新开始')
  if (store.mode === 'challenge') {
    const showScramble = s === 'idle' || s === 'finished'
    scramblePanel.root.style.display = showScramble && store.currentScramble.length > 0 ? '' : 'none'
    // 挑战进行中 (非 idle) 锁住谜题下拉, 避免切换谜题污染计时器状态
    topBar.setPuzzleSelectorEnabled(s === 'idle')
  }
})
challenge.onFinish((f) => {
  timesStore.add({
    ms: f.ms,
    scramble: store.currentScramble.slice(),
    solveMoves: logPanel.current(),
    at: f.at,
    penalty: 'ok',
  })
})

// 键盘 (puzzle-aware)
installKeyboard(bus, {
  enabled: () => !challenge.isInputLocked(),
  isChallengeMode: () => store.mode === 'challenge',
  getPuzzle: () => store.puzzle,
})

// 同步初始 puzzle 到下拉 + 键位提示
topBar.setCurrentPuzzle(store.puzzle.meta.id)
topBar.setPuzzleForKeyHints(store.puzzle)

// 恢复 mode
if (persisted.mode !== 'training') {
  bus.dispatch({ type: 'mode-change', mode: persisted.mode })
}

// 音效首次激活
const enableSfx = (): void => {
  sfx.enable()
  sfx.setMuted(persisted.soundMuted)
  window.removeEventListener('pointerdown', enableSfx)
  window.removeEventListener('keydown', enableSfx)
}
window.addEventListener('pointerdown', enableSfx)
window.addEventListener('keydown', enableSfx)

;(window as unknown as { cubelab: unknown }).cubelab = { stage, store, bus, challenge, freeOrbit }
