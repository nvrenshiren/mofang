import type { FaceId, Move } from '../cube/moves'

/**
 * WCA 3x3 打乱生成器 (官方等价规则的简化实现)
 *
 * 规则:
 *   - 仅使用外层六面 R L U D F B,不使用 wide / 中层 / 整体旋转
 *   - 相邻两步不能同面 (R 后不能再 R/R'/R2)
 *   - 相邻两步若同轴 (R-L / U-D / F-B),不允许超过两次连续同轴
 *     (官方更严格: 不允许 R L R 这种"夹心",我们简化为不能"连续 3 步同轴")
 *   - 长度默认 20 (WCA 官方比赛打乱约 18-25)
 */

const AXES: Record<FaceId, 'x' | 'y' | 'z' | null> = {
  R: 'x', L: 'x', M: 'x',
  U: 'y', D: 'y', E: 'y',
  F: 'z', B: 'z', S: 'z',
  Rw: 'x', Lw: 'x', Uw: 'y', Dw: 'y', Fw: 'z', Bw: 'z',
  x: null, y: null, z: null,
}

const SCRAMBLE_FACES: readonly FaceId[] = ['R', 'L', 'U', 'D', 'F', 'B']

/** 简单 PRNG: Mulberry32,种子可复现 */
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

export interface ScrambleOptions {
  /** 步数,默认 20 */
  length?: number
  /** 种子,不传则使用 Math.random */
  seed?: number
}

export function generateScramble(opts: ScrambleOptions = {}): Move[] {
  const length = opts.length ?? 20
  const rand = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random

  const out: Move[] = []
  let lastFace: FaceId | null = null
  let lastLastFace: FaceId | null = null

  while (out.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(rand() * SCRAMBLE_FACES.length)]!
    // 与上一步同面 → 跳过
    if (face === lastFace) continue
    // 与上两步同面 (e.g. R L R) → 跳过,避免 "夹心"
    if (
      lastFace !== null &&
      lastLastFace !== null &&
      AXES[face] === AXES[lastFace] &&
      AXES[face] === AXES[lastLastFace]
    ) {
      continue
    }
    // 振幅
    const amount = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3
    out.push({ face, amount })
    lastLastFace = lastFace
    lastFace = face
  }
  return out
}
