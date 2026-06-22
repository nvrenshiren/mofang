/**
 * 所有谜题都实现这两个接口
 *
 * Puzzle<State, Move>     纯逻辑: 状态/操作/求解/解析/打乱
 * PuzzleRenderer<S, M>    Three.js 渲染: 把状态映射到视觉, 队列化动画
 *
 * 二者分开是为了:
 *   - domain 层零 DOM/Three 依赖, 可在 Node 跑测试
 *   - 一个 puzzle 可以有多个渲染器 (3D / 展开图 / 等)
 */

import type { Stage } from '../../render/Stage'

export type PuzzleId = '2x2' | '3x3' | '4x4' | '5x5' | '6x6' | '7x7'

export interface PuzzleMeta {
  readonly id: PuzzleId
  readonly displayName: string
  readonly category: 'nxn'
  /** 默认打乱步数 (WCA 规则) */
  readonly scrambleLength: number
}

export interface SafeParseOk<M> { ok: true; moves: M[] }
export interface SafeParseErr { ok: false; error: string; index: number }
export type SafeParseResult<M> = SafeParseOk<M> | SafeParseErr

export interface ButtonSpec {
  readonly face: string
  readonly amount: 1 | 2 | 3
  /** 按钮上显示的文本 (e.g. "R", "R'", "R2", "Rw") */
  readonly label: string
  /** 键位提示 (可空) */
  readonly key?: string
}

export interface ButtonGroup {
  readonly label: string
  /** 该组的视觉锚色 (跟谜题面色对齐) */
  readonly color?: string
  readonly buttons: readonly ButtonSpec[]
}

export interface KeyBinding<M> {
  readonly key: string
  /** 触发后 UI 高亮提示 (跟 ButtonSpec.label 对齐) */
  readonly faceLabel: string
  readonly move: M
}

export interface Puzzle<State, Move> {
  readonly meta: PuzzleMeta

  solved(): State
  apply(s: State, m: Move): State
  isSolved(s: State): boolean
  inverseMove(m: Move): Move

  parse(src: string): Move[]
  safeParse(src: string): SafeParseResult<Move>
  format(m: Move): string
  formatMoves(moves: readonly Move[]): string

  generateScramble(opts?: { length?: number; seed?: number }): Move[]

  /** UI: WCA 按钮面板的内容 (按组分类) */
  buttonGroups(): readonly ButtonGroup[]
  /** UI: 键盘绑定 */
  keymap(): readonly KeyBinding<Move>[]
}

export interface PuzzleRenderer<State, Move> {
  /** 创建 mesh 并挂入 stage; 同时设置初始状态 */
  mount(stage: Stage, initialState: State): void
  /** 移除 mesh, 释放资源 */
  unmount(): void
  /** 强制对齐: 把 mesh 一次同步到指定状态 (不动画) */
  syncToState(state: State): void
  /** 入队一个 move 的动画 */
  enqueueMove(move: Move, durationMs: number): Promise<void>
  /** 清空动画队列 */
  clearQueue(): void
  /** 是否还有动画在播 */
  isBusy(): boolean
  /** 每个 move 完成时触发 (sfx / 求解检测) */
  onMoveApplied?: (move: Move) => void
}
