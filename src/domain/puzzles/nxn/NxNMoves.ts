/**
 * NxN 立方体的 move 模型 + apply
 *
 * Move 抽象:
 *   face:   六个面 R/L/U/D/F/B 或整体旋转 x/y/z
 *   depth:  从该面外侧算起的层数 (1 = 单层, 2 = wide, k = 多层宽)
 *           depth=N 等价于整体旋转 (但仍区分 face 维度方便 UI)
 *   amount: 1 = CW 90°, 2 = 180°, 3 = CCW 90° (prime)
 *
 * WCA 公式: R = 单层 depth 1, Rw = depth 2, 3Rw = depth 3, 4Rw = depth 4, ...
 *           N 阶魔方上 depth ≤ ⌊N/2⌋ (更深会跟反面重叠, 等价于反面的反向)
 *           整体旋转 x/y/z 实现为 depth=N 的等效 (selector 总是 true)
 */

import { apply, inverse, mul, Rx90, Ry90, Rz90, square, type Mat3 } from '../../math/Mat3'
import { v3key, type Vec3 } from '../../math/Vec3'
import { solvedStickersOfPosition, type Cubie, type FaceColorId, type NxNState } from './NxNState'

export type NxNFaceId =
  | 'R' | 'L' | 'U' | 'D' | 'F' | 'B'
  | 'M' | 'E' | 'S'   // 中层 dead-middle, 仅对奇数 N 有效
  | 'x' | 'y' | 'z'

export type Amount = 1 | 2 | 3

export interface NxNMove {
  readonly face: NxNFaceId
  /** depth ≥ 1; 整体旋转 x/y/z 时 depth 通常填 N (selector 总是 true) */
  readonly depth: number
  readonly amount: Amount
}

/**
 * 单层 90° CW (从该面外侧看) 旋转矩阵
 * 沿用 3x3 同样的几何: R/U/F = 数学正旋转的逆
 */
const ROT_R = inverse(Rx90)
const ROT_L = Rx90
const ROT_U = inverse(Ry90)
const ROT_D = Ry90
const ROT_F = inverse(Rz90)
const ROT_B = Rz90

function rotMatrixFor(face: NxNFaceId): Mat3 {
  switch (face) {
    case 'R': case 'x': return ROT_R
    case 'L':           return ROT_L
    case 'U': case 'y': return ROT_U
    case 'D':           return ROT_D
    case 'F': case 'z': return ROT_F
    case 'B':           return ROT_B
    case 'M':           return ROT_L  // M 跟 L 同方向 (WCA 习惯)
    case 'E':           return ROT_D  // E 跟 D 同方向
    case 'S':           return ROT_F  // S 跟 F 同方向
  }
}

/** 根据 amount 取出实际旋转 */
export function rotationOf(m: NxNMove): Mat3 {
  const base = rotMatrixFor(m.face)
  switch (m.amount) {
    case 1: return base
    case 2: return square(base)
    case 3: return inverse(base)
  }
}

/**
 * 给定 cubie 当前索引 i, 判定它是否落在某 move 的旋转层里
 * - R: face 在 +X (i[0] = N-1, N-2, ..., N-depth)
 * - L: face 在 -X (i[0] = 0, 1, ..., depth-1)
 * - U/D/F/B 同理
 * - x/y/z 整体旋转: 所有 cubie 都受影响 (depth=N)
 */
export function layerSelector(N: number, m: NxNMove): (i: readonly [number, number, number]) => boolean {
  const d = m.depth
  switch (m.face) {
    case 'R': return (i) => i[0] >= N - d
    case 'L': return (i) => i[0] <= d - 1
    case 'U': return (i) => i[1] >= N - d
    case 'D': return (i) => i[1] <= d - 1
    case 'F': return (i) => i[2] >= N - d
    case 'B': return (i) => i[2] <= d - 1
    case 'x': case 'y': case 'z': return () => true
    // M/E/S: 仅对奇数 N 有效 (dead-middle 唯一层), 偶数 N 时不影响任何 cubie (no-op)
    case 'M': return N % 2 === 1 ? (i) => i[0] === (N - 1) / 2 : () => false
    case 'E': return N % 2 === 1 ? (i) => i[1] === (N - 1) / 2 : () => false
    case 'S': return N % 2 === 1 ? (i) => i[2] === (N - 1) / 2 : () => false
  }
}

/** 反向 */
export function inverseNxNMove(m: NxNMove): NxNMove {
  const inv: Amount = m.amount === 1 ? 3 : m.amount === 3 ? 1 : 2
  return { face: m.face, depth: m.depth, amount: inv }
}

/**
 * 把整数索引旋转到新位置 —— 不能直接用浮点 Mat3,因为 NxN 的中心点是 (N-1)/2 半整数
 * 做法: 把 i 转到"以中心点为原点"的 ±value 形式, 用矩阵乘, 再转回索引
 * value = 2i - (N-1) ∈ {-(N-1), -(N-3), ..., N-3, N-1} (整数, 奇偶随 N 而定但永远整数)
 */
function applyIdx(N: number, rot: Mat3, i: readonly [number, number, number]): readonly [number, number, number] {
  const v: Vec3 = [2 * i[0] - (N - 1), 2 * i[1] - (N - 1), 2 * i[2] - (N - 1)]
  const rv = apply(rot, v)
  return [
    Math.round((rv[0] + (N - 1)) / 2),
    Math.round((rv[1] + (N - 1)) / 2),
    Math.round((rv[2] + (N - 1)) / 2),
  ]
}

export function applyMove(state: NxNState, m: NxNMove): NxNState {
  const sel = layerSelector(state.N, m)
  const rot = rotationOf(m)
  const next: Cubie[] = state.cubies.map((c) => {
    if (!sel(c.i)) return c
    return {
      id: c.id,
      i: applyIdx(state.N, rot, c.i),
      orientation: mul(rot, c.orientation),
    }
  })
  return { N: state.N, cubies: next }
}

export function applyMoves(state: NxNState, moves: Iterable<NxNMove>): NxNState {
  let s = state
  for (const m of moves) s = applyMove(s, m)
  return s
}

/**
 * 是否求解 —— 按"视觉"判定: 每个外露面是否纯色
 * 跟 3x3 的实现一致, 复用 stickerColor 思路
 */
export function isSolved(state: NxNState): boolean {
  const N = state.N
  const faceNormals: { name: FaceColorId; n: Vec3; selector: (i: readonly [number, number, number]) => boolean }[] = [
    { name: 'R', n: [1, 0, 0],  selector: (i) => i[0] === N - 1 },
    { name: 'L', n: [-1, 0, 0], selector: (i) => i[0] === 0 },
    { name: 'U', n: [0, 1, 0],  selector: (i) => i[1] === N - 1 },
    { name: 'D', n: [0, -1, 0], selector: (i) => i[1] === 0 },
    { name: 'F', n: [0, 0, 1],  selector: (i) => i[2] === N - 1 },
    { name: 'B', n: [0, 0, -1], selector: (i) => i[2] === 0 },
  ]
  for (const f of faceNormals) {
    let expected: FaceColorId | null = null
    for (const c of state.cubies) {
      if (!f.selector(c.i)) continue
      // local 方向 = orientationᵀ · world face normal
      const o = c.orientation
      const lx = o[0] * f.n[0] + o[3] * f.n[1] + o[6] * f.n[2]
      const ly = o[1] * f.n[0] + o[4] * f.n[1] + o[7] * f.n[2]
      const lz = o[2] * f.n[0] + o[5] * f.n[1] + o[8] * f.n[2]
      // 这个 cubie 在 solved 态下位置: SOLVED_POSITIONS[c.id]?
      // 这里我们存的是 id, solved-position 可由 cubie.id 重建 -- 用 state.cubies[c.id]?
      // 不行: state.cubies 是当前状态的列表, id 是稳定索引
      // 我们需要预存每个 id 对应的 solved 时的 sticker map
      const stickers = solvedStickersById(N, c.id)
      const color = stickers.get(v3key([lx, ly, lz]))
      if (!color) continue
      if (expected === null) expected = color
      else if (color !== expected) return false
    }
  }
  return true
}

/** 缓存: id → solved sticker map */
const stickerCache = new Map<string, Map<string, FaceColorId>>()
function solvedStickersById(N: number, id: number): Map<string, FaceColorId> {
  const key = `${N}:${id}`
  const cached = stickerCache.get(key)
  if (cached) return cached
  // 重建 id → solved position
  // solvedCubies 的遍历顺序: x:0..N-1, y:0..N-1, z:0..N-1, 跳过内部
  let curId = 0
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        const onAnyFace = x === 0 || x === N - 1 || y === 0 || y === N - 1 || z === 0 || z === N - 1
        if (!onAnyFace) continue
        if (curId === id) {
          const m = solvedStickersOfPosition(N, [x, y, z])
          stickerCache.set(key, m)
          return m
        }
        curId++
      }
    }
  }
  const empty = new Map<string, FaceColorId>()
  stickerCache.set(key, empty)
  return empty
}

/** 查询某 cubie 在 world 方向上显示什么颜色 */
export function stickerColor(c: Cubie, N: number, worldDir: Vec3): FaceColorId | null {
  const o = c.orientation
  const localDir: Vec3 = [
    o[0] * worldDir[0] + o[3] * worldDir[1] + o[6] * worldDir[2],
    o[1] * worldDir[0] + o[4] * worldDir[1] + o[7] * worldDir[2],
    o[2] * worldDir[0] + o[5] * worldDir[1] + o[8] * worldDir[2],
  ]
  return solvedStickersById(N, c.id).get(v3key(localDir)) ?? null
}
