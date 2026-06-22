/**
 * NxN 打乱 —— 按 WCA 官方规则分级
 *
 * 规则差异化:
 *   - 2x2: 只用 R/U/F 三面 (按 WCA 规约 4j1, 2x2 可固定一个角块, 三面足够唯一打乱)
 *   - 3x3: R/L/U/D/F/B 六面, 仅单层 (depth=1)
 *   - 4x4 / 5x5: 六面 × {单层, 宽 2 (Rw)} 均匀混合
 *   - 6x6 / 7x7: 六面 × {单层, 宽 2 (Rw), 宽 3 (3Rw)} 均匀混合
 *   (WCA 规约 4j2: 大魔方打乱使用 outer face + 宽层 inner slice)
 *
 * 共同约束 (所有 N):
 *   - 相邻两步不能同面 (即使 depth 不同, 比如 R 后不能 Rw, 因为同面冗余)
 *   - 不能连续 3 步同轴 (避免 R L R 这类"夹心"操作)
 *
 * 默认步数 (WCA 官方比赛打乱):
 *   2x2=11, 3x3=20, 4x4=45, 5x5=60, 6x6=80, 7x7=100
 */

import type { NxNFaceId, NxNMove } from './NxNMoves'

const ALL_FACES: readonly NxNFaceId[] = ['R', 'L', 'U', 'D', 'F', 'B']
const FACES_2X2: readonly NxNFaceId[] = ['R', 'U', 'F']

const AXIS: Record<NxNFaceId, 'x' | 'y' | 'z' | null> = {
  R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z',
  M: 'x', E: 'y', S: 'z',
  x: null, y: null, z: null,
}

const DEFAULT_LEN: Record<number, number> = {
  2: 11, 3: 20, 4: 45, 5: 60, 6: 80, 7: 100,
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface NxNScrambleOptions {
  length?: number
  seed?: number
}

/** 该 N 阶魔方允许的转动深度集合 */
function depthsFor(N: number): readonly number[] {
  if (N <= 3) return [1]
  if (N <= 5) return [1, 2]      // 4x4, 5x5: 单层 + 宽 2
  return [1, 2, 3]                // 6x6, 7x7: 单层 + 宽 2 + 宽 3
}

/** 该 N 阶魔方允许的转动面 */
function facesFor(N: number): readonly NxNFaceId[] {
  return N === 2 ? FACES_2X2 : ALL_FACES
}

export function generateNxNScramble(N: number, opts: NxNScrambleOptions = {}): NxNMove[] {
  const length = opts.length ?? DEFAULT_LEN[N] ?? 20
  const rand = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random

  const faces = facesFor(N)
  const depths = depthsFor(N)

  const out: NxNMove[] = []
  let lastFace: NxNFaceId | null = null
  let lastLastFace: NxNFaceId | null = null

  while (out.length < length) {
    const face = faces[Math.floor(rand() * faces.length)]!
    // 同面跳过 (无论 depth)
    if (face === lastFace) continue
    // 同轴连续 3 步跳过
    if (
      lastFace !== null && lastLastFace !== null &&
      AXIS[face] === AXIS[lastFace] && AXIS[face] === AXIS[lastLastFace]
    ) continue

    const depth = depths[Math.floor(rand() * depths.length)]!
    const amount = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3
    out.push({ face, depth, amount })
    lastLastFace = lastFace
    lastFace = face
  }
  return out
}
