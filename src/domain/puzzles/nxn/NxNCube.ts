/**
 * NxN 立方体 —— 实现 Puzzle 接口
 *
 * 同一份代码覆盖 2x2 ~ 7x7. 3x3 也可走这里, 但出于不破现有测试的考虑,
 * 3x3 还保留在 src/domain/cube/ 下, 仅通过 puzzles/cube3/ 包装.
 */

import type {
  ButtonGroup, ButtonSpec, KeyBinding, Puzzle, PuzzleId, PuzzleMeta, SafeParseResult,
} from '../Puzzle'
import { applyMove, applyMoves, inverseNxNMove, isSolved, type NxNFaceId, type NxNMove } from './NxNMoves'
import { solvedState, type NxNState } from './NxNState'
import { formatNxNMove, formatNxNMoves, parseNxN, safeParseNxN } from './NxNParser'
import { generateNxNScramble } from './NxNScramble'

const FACE_COLOR: Record<string, string> = {
  R: '#c41e3a', L: '#f08000', U: '#f5f5f0', D: '#f5c518', F: '#1a9f3a', B: '#1464d6',
}

/**
 * 按 N 分级键位 (基于 WCA 规则 + 各解法实际需求)
 *
 *   2x2 (Ortega/CLL/EG):       r u f + 旋转 — 三面足够, 固定 BLD 角
 *   3x3 (CFOP/Roux/ZZ):        r u f l d b + m e s + 旋转 — Roux 必需 M slice
 *   4x4 6x6 (偶数 Reduction):   r u f l d b + 旋转 — 偶数 N 无 dead-middle, 不绑 M/E/S
 *   5x5 7x7 (奇数 Reduction):   r u f l d b + m e s + 旋转 — 有 dead-middle slice
 *
 * 宽层 Rw / 3Rw 通过 WCA 按钮面板或公式输入触发 (Shift/Alt 与 prime/180° 冲突)
 * 修饰键统一: Shift = prime, Alt = 180°
 */
function keymapForN(N: number): Record<string, NxNFaceId> {
  const rotations: Record<string, NxNFaceId> = { ';': 'y', '[': 'x', '-': 'z' }
  if (N === 2) {
    return { r: 'R', u: 'U', f: 'F', ...rotations }
  }
  const sixFaces: Record<string, NxNFaceId> = {
    r: 'R', u: 'U', f: 'F', l: 'L', d: 'D', b: 'B',
  }
  // 中层 M/E/S 仅奇数 N 有意义 (有唯一的 dead-middle layer)
  const middleSlices: Record<string, NxNFaceId> = N % 2 === 1
    ? { m: 'M', e: 'E', s: 'S' }
    : {}
  return { ...sixFaces, ...middleSlices, ...rotations }
}

const ID_BY_N: Record<number, PuzzleId> = {
  2: '2x2', 3: '3x3', 4: '4x4', 5: '5x5', 6: '6x6', 7: '7x7',
}

const SCRAMBLE_LEN: Record<number, number> = {
  2: 11, 3: 20, 4: 45, 5: 60, 6: 80, 7: 100,
}

export function createNxNCube(N: number): Puzzle<NxNState, NxNMove> {
  const id = ID_BY_N[N]
  if (!id) throw new Error(`不支持的 N: ${N}`)
  const meta: PuzzleMeta = {
    id,
    displayName: `${N}×${N}×${N}`,
    category: 'nxn',
    scrambleLength: SCRAMBLE_LEN[N]!,
  }

  function buttonGroupsImpl(): readonly ButtonGroup[] {
    const groups: ButtonGroup[] = []
    const maxDepth = Math.floor(N / 2)
    // 外层 6 面 (depth=1)
    for (const f of ['U', 'D', 'R', 'L', 'F', 'B'] as NxNFaceId[]) {
      const buttons: ButtonSpec[] = []
      for (const amount of [1, 3, 2] as const) {
        const label = formatNxNMove({ face: f, depth: 1, amount })
        const key = amount === 1 ? findKey(f, N) : undefined
        buttons.push(key ? { face: f, amount, label, key } : { face: f, amount, label })
      }
      groups.push({ label: `${faceName(f)} ${f}`, color: FACE_COLOR[f]!, buttons })
    }
    // 中层 M/E/S — 仅奇数 N
    if (N % 2 === 1) {
      for (const f of ['M', 'E', 'S'] as NxNFaceId[]) {
        const buttons: ButtonSpec[] = []
        for (const amount of [1, 3, 2] as const) {
          const label = formatNxNMove({ face: f, depth: 1, amount })
          const key = amount === 1 ? findKey(f, N) : undefined
          buttons.push(key ? { face: f, amount, label, key } : { face: f, amount, label })
        }
        groups.push({ label: `中层 ${f}`, buttons })
      }
    }
    // wide 层 (depth 2..maxDepth) — 仅 N>=4
    if (maxDepth >= 2) {
      for (let d = 2; d <= maxDepth; d++) {
        for (const f of ['R', 'L', 'U', 'D', 'F', 'B'] as NxNFaceId[]) {
          const buttons: ButtonSpec[] = []
          for (const amount of [1, 3, 2] as const) {
            const label = formatNxNMove({ face: f, depth: d, amount })
            buttons.push({ face: f, amount, label })
          }
          groups.push({ label: `宽层 ${d}${f}w`, buttons })
        }
      }
    }
    // 整体旋转
    for (const f of ['y', 'x', 'z'] as NxNFaceId[]) {
      const buttons: ButtonSpec[] = []
      for (const amount of [1, 3, 2] as const) {
        const label = formatNxNMove({ face: f, depth: N, amount })
        const key = amount === 1 ? findKey(f, N) : undefined
        buttons.push(key ? { face: f, amount, label, key } : { face: f, amount, label })
      }
      groups.push({ label: `整转 ${f}`, buttons })
    }
    return groups
  }

  function keymapImpl(): readonly KeyBinding<NxNMove>[] {
    const out: KeyBinding<NxNMove>[] = []
    const km = keymapForN(N)
    for (const [key, face] of Object.entries(km)) {
      const depth = (face === 'x' || face === 'y' || face === 'z') ? N : 1
      out.push({
        key,
        faceLabel: formatNxNMove({ face, depth, amount: 1 }),
        move: { face, depth, amount: 1 },
      })
    }
    return out
  }

  return {
    meta,
    solved: () => solvedState(N),
    apply: (s, m) => applyMove(s, normalizeDepth(N, m)),
    isSolved: (s) => isSolved(s),
    inverseMove: (m) => inverseNxNMove(m),
    parse: (src) => parseNxN(src).map((m) => normalizeDepth(N, m)),
    safeParse: (src): SafeParseResult<NxNMove> => {
      const r = safeParseNxN(src)
      if (!r.ok) return { ok: false, error: r.error, index: r.index }
      return { ok: true, moves: r.moves.map((m) => normalizeDepth(N, m)) }
    },
    format: formatNxNMove,
    formatMoves: formatNxNMoves,
    generateScramble: (opts = {}) => generateNxNScramble(N, opts),
    buttonGroups: buttonGroupsImpl,
    keymap: keymapImpl,
  }

  function applyImpl(s: NxNState, ms: readonly NxNMove[]): NxNState {
    return applyMoves(s, ms.map((m) => normalizeDepth(N, m)))
  }
  void applyImpl
}

/** 把整体旋转 x/y/z 的 depth 标准化为 N (覆盖全部 cubie) */
function normalizeDepth(N: number, m: NxNMove): NxNMove {
  if (m.face === 'x' || m.face === 'y' || m.face === 'z') {
    return { ...m, depth: N }
  }
  return m
}

function findKey(face: NxNFaceId, N: number): string | undefined {
  // 按 N 找按钮键位提示 -- 没绑定的就不显示, 避免误导用户
  const km = keymapForN(N)
  for (const [k, v] of Object.entries(km)) {
    if (v === face) return k
  }
  return undefined
}

function faceName(f: NxNFaceId): string {
  return {
    R: '右', L: '左', U: '顶', D: '底', F: '前', B: '后',
    M: 'M中', E: 'E中', S: 'S中',
    x: 'x', y: 'y', z: 'z',
  }[f]
}
