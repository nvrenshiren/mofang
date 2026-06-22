import { apply, IDENTITY, mul, type Mat3 } from '../math/Mat3'
import { v3key, type Vec3 } from '../math/Vec3'
import { type FaceColorId } from './colors'
import { FACE_DEFS, rotationOf, type Move } from './moves'

/**
 * 单个 cubie 的运行时状态
 *  - id: 在 SOLVED_POSITIONS 中的索引,永远不变 (cubie 的身份)
 *  - position: 当前世界坐标 ∈ {-1, 0, 1}^3
 *  - orientation: 当前朝向 (3x3 整数旋转矩阵, 24 种之一)
 *
 * 求 cubie 上某个 world 方向显示什么颜色:
 *   localDir = orientationᵀ · worldDir   (orth 矩阵的逆 = 转置)
 *   color = solvedColorAtLocalDir(id, localDir)
 */
export interface Cubie {
  readonly id: number
  readonly position: Vec3
  readonly orientation: Mat3
}

/** 26 个 cubie 的"求解态"位置 —— 排除 (0,0,0) 这个不存在的几何中心 */
export const SOLVED_POSITIONS: readonly Vec3[] = (() => {
  const out: Vec3[] = []
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        if (!(x === 0 && y === 0 && z === 0)) out.push([x, y, z])
  return out
})()

/** 按 solved position 的轴上的非零分量,返回该 cubie 在 solved 状态下每个外向方向的贴纸颜色 */
function solvedStickersOf(pos: Vec3): Map<string, FaceColorId> {
  const m = new Map<string, FaceColorId>()
  if (pos[0] === +1) m.set(v3key([+1, 0, 0]), 'R')
  if (pos[0] === -1) m.set(v3key([-1, 0, 0]), 'L')
  if (pos[1] === +1) m.set(v3key([0, +1, 0]), 'U')
  if (pos[1] === -1) m.set(v3key([0, -1, 0]), 'D')
  if (pos[2] === +1) m.set(v3key([0, 0, +1]), 'F')
  if (pos[2] === -1) m.set(v3key([0, 0, -1]), 'B')
  return m
}

/** id → 该 cubie 在 solved 态下每个 local 方向的贴纸颜色 (预计算) */
const SOLVED_STICKERS: readonly Map<string, FaceColorId>[] =
  SOLVED_POSITIONS.map(solvedStickersOf)

/** 类型: 整个魔方的状态 (不可变) */
export interface CubeState {
  readonly cubies: readonly Cubie[]
}

/** 求解态魔方 */
export function solved(): CubeState {
  return {
    cubies: SOLVED_POSITIONS.map((pos, id) => ({
      id,
      position: pos,
      orientation: IDENTITY,
    })),
  }
}

/** 应用单个 move,返回新状态 (不可变更新) */
export function applyMove(state: CubeState, move: Move): CubeState {
  const def = FACE_DEFS[move.face]
  const rot = rotationOf(move)
  const next: Cubie[] = state.cubies.map((c) => {
    if (!def.selector(c.position)) return c
    return {
      id: c.id,
      position: apply(rot, c.position),
      orientation: mul(rot, c.orientation),
    }
  })
  return { cubies: next }
}

/** 应用一串 move */
export function applyMoves(state: CubeState, moves: Iterable<Move>): CubeState {
  let s = state
  for (const m of moves) s = applyMove(s, m)
  return s
}

/**
 * 是否已求解 —— 按"视觉"判定:六个面分别看是否纯色
 * 不直接比对 orientation,因为中心块自转(如 T-perm 之后 U 中心多转 90°) 视觉看不出来
 */
export function isSolved(state: CubeState): boolean {
  const faces: Vec3[] = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ]
  for (const face of faces) {
    let expected: FaceColorId | null = null
    for (const c of state.cubies) {
      const onFace =
        (face[0] !== 0 && c.position[0] === face[0]) ||
        (face[1] !== 0 && c.position[1] === face[1]) ||
        (face[2] !== 0 && c.position[2] === face[2])
      if (!onFace) continue
      const color = stickerColor(c, face)
      if (color === null) continue
      if (expected === null) expected = color
      else if (color !== expected) return false
    }
  }
  return true
}

/**
 * 查询某个 cubie 在 world 方向上显示什么颜色 (没有贴纸则返回 null)
 */
export function stickerColor(c: Cubie, worldDir: Vec3): FaceColorId | null {
  // localDir = orientationᵀ · worldDir
  const o = c.orientation
  const [x, y, z] = worldDir
  const localDir: Vec3 = [
    o[0] * x + o[3] * y + o[6] * z,
    o[1] * x + o[4] * y + o[7] * z,
    o[2] * x + o[5] * y + o[8] * z,
  ]
  return SOLVED_STICKERS[c.id]!.get(v3key(localDir)) ?? null
}

/** 状态指纹 —— 测试用,确认两次操作结果完全一致 */
export function fingerprint(state: CubeState): string {
  return state.cubies
    .map((c) => `${c.id}@${v3key(c.position)}|${c.orientation.join(',')}`)
    .join(';')
}

export type { Mat3 }
