/**
 * NxN 立方体的内部状态
 *
 * 坐标策略: 整数索引 i ∈ [0, N-1] (而非现有 3x3 用的 [-1, 0, 1]),便于偶数 N 的处理
 * 世界坐标 = (i - (N-1)/2) * unit, 由渲染层处理 unit 缩放
 *
 * Cubie 表面贴纸只在"外露"的方向有 (即该方向上 i = 0 或 N-1):
 *   +X → R(红), -X → L(橙), +Y → U(白), -Y → D(黄), +Z → F(绿), -Z → B(蓝)
 *
 * 朝向: 3x3 整数旋转矩阵 (24 种), 复用 Mat3
 */

import { IDENTITY, type Mat3 } from '../../math/Mat3'

export type FaceColorId = 'U' | 'D' | 'F' | 'B' | 'L' | 'R'

export interface Cubie {
  /** 在 solved 态下的初始索引 (在 cubies 列表中) */
  readonly id: number
  /** 当前位置: 整数索引 ∈ [0, N-1]³ */
  readonly i: readonly [number, number, number]
  readonly orientation: Mat3
}

export interface NxNState {
  readonly N: number
  readonly cubies: readonly Cubie[]
}

/** 生成 N×N×N 立方体的 solved cubie 列表 (去掉完全在内部、不露贴纸的) */
export function solvedCubies(N: number): Cubie[] {
  const out: Cubie[] = []
  let id = 0
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        // 至少在一个面外露 (该轴 index 是 0 或 N-1) 才是可见 cubie
        const onAnyFace =
          x === 0 || x === N - 1 ||
          y === 0 || y === N - 1 ||
          z === 0 || z === N - 1
        if (!onAnyFace) continue
        out.push({ id: id++, i: [x, y, z], orientation: IDENTITY })
      }
    }
  }
  return out
}

export function solvedState(N: number): NxNState {
  return { N, cubies: solvedCubies(N) }
}

/** 获取该 cubie 在 solved 态下,各 local 方向上的贴纸颜色 */
export function solvedStickersOfPosition(
  N: number,
  i: readonly [number, number, number],
): Map<string, FaceColorId> {
  const m = new Map<string, FaceColorId>()
  if (i[0] === N - 1) m.set('1,0,0', 'R')
  if (i[0] === 0)     m.set('-1,0,0', 'L')
  if (i[1] === N - 1) m.set('0,1,0', 'U')
  if (i[1] === 0)     m.set('0,-1,0', 'D')
  if (i[2] === N - 1) m.set('0,0,1', 'F')
  if (i[2] === 0)     m.set('0,0,-1', 'B')
  return m
}
