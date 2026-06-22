import { inverse, Rx90, Ry90, Rz90, square, type Mat3 } from '../math/Mat3'
import type { Vec3 } from '../math/Vec3'

/**
 * WCA 转动符号:
 *   外层: R L U D F B
 *   中层: M (跟 L 同向) E (跟 D 同向) S (跟 F 同向)
 *   双层: Rw Lw Uw Dw Fw Bw
 *   整体: x y z (大写以与字段名一致,展示时按 WCA 习惯小写)
 */
export type FaceId =
  | 'R' | 'L' | 'U' | 'D' | 'F' | 'B'
  | 'M' | 'E' | 'S'
  | 'Rw' | 'Lw' | 'Uw' | 'Dw' | 'Fw' | 'Bw'
  | 'x' | 'y' | 'z'

/** 转动方向:1 = 90° CW, 2 = 180°, 3 = 90° CCW (即 prime) */
export type Amount = 1 | 2 | 3

export interface Move {
  readonly face: FaceId
  readonly amount: Amount
}

/**
 * 六个基础面的 90° 顺时针 (CW) 旋转矩阵
 * 约定: "CW from outside" —— 以站在该面外面朝向魔方原点的视角看
 * R/U/F = 数学正旋转的逆 (因为右手系下从 +X/+Y/+Z 看的"顺时针"对应数学 -90°)
 */
const ROT_R = inverse(Rx90) // +Y→-Z, +Z→+Y
const ROT_L = Rx90 // +Y→+Z, +Z→-Y
const ROT_U = inverse(Ry90) // +Z→-X, +X→+Z
const ROT_D = Ry90 // +Z→+X, +X→-Z
const ROT_F = inverse(Rz90) // +X→-Y, +Y→+X
const ROT_B = Rz90 // +X→+Y, +Y→-X

interface FaceDef {
  /** 该 face 在哪个轴上转 — 用于动画分组 */
  readonly axis: 'x' | 'y' | 'z'
  /** 90° CW 的旋转矩阵 */
  readonly rot: Mat3
  /** 该 face 选中哪些 cubie (按位置筛选) */
  readonly selector: (p: Vec3) => boolean
}

export const FACE_DEFS: Readonly<Record<FaceId, FaceDef>> = {
  // ---- 外层 6 面 ----
  R: { axis: 'x', rot: ROT_R, selector: (p) => p[0] === 1 },
  L: { axis: 'x', rot: ROT_L, selector: (p) => p[0] === -1 },
  U: { axis: 'y', rot: ROT_U, selector: (p) => p[1] === 1 },
  D: { axis: 'y', rot: ROT_D, selector: (p) => p[1] === -1 },
  F: { axis: 'z', rot: ROT_F, selector: (p) => p[2] === 1 },
  B: { axis: 'z', rot: ROT_B, selector: (p) => p[2] === -1 },
  // ---- 中层 3 片 ----
  M: { axis: 'x', rot: ROT_L, selector: (p) => p[0] === 0 },
  E: { axis: 'y', rot: ROT_D, selector: (p) => p[1] === 0 },
  S: { axis: 'z', rot: ROT_F, selector: (p) => p[2] === 0 },
  // ---- 双层 (含外层 + 相邻中层) ----
  Rw: { axis: 'x', rot: ROT_R, selector: (p) => p[0] >= 0 },
  Lw: { axis: 'x', rot: ROT_L, selector: (p) => p[0] <= 0 },
  Uw: { axis: 'y', rot: ROT_U, selector: (p) => p[1] >= 0 },
  Dw: { axis: 'y', rot: ROT_D, selector: (p) => p[1] <= 0 },
  Fw: { axis: 'z', rot: ROT_F, selector: (p) => p[2] >= 0 },
  Bw: { axis: 'z', rot: ROT_B, selector: (p) => p[2] <= 0 },
  // ---- 整体旋转 (全部 cubie) ----
  x: { axis: 'x', rot: ROT_R, selector: () => true },
  y: { axis: 'y', rot: ROT_U, selector: () => true },
  z: { axis: 'z', rot: ROT_F, selector: () => true },
}

/** 根据 amount 取出实际旋转矩阵 (1=CW, 2=180°, 3=CCW) */
export function rotationOf(move: Move): Mat3 {
  const base = FACE_DEFS[move.face].rot
  switch (move.amount) {
    case 1: return base
    case 2: return square(base)
    case 3: return inverse(base)
  }
}

/** 反向: 把 (face, amount) 取反向,用于撤销 */
export function inverseMove(m: Move): Move {
  const inv: Amount = m.amount === 1 ? 3 : m.amount === 3 ? 1 : 2
  return { face: m.face, amount: inv }
}
