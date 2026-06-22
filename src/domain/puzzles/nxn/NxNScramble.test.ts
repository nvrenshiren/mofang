import { describe, it, expect } from 'vitest'
import { generateNxNScramble } from './NxNScramble'
import type { NxNFaceId } from './NxNMoves'

const AXIS: Record<NxNFaceId, string> = {
  R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z',
  M: 'x', E: 'y', S: 'z',
  x: '_', y: '_', z: '_',
}

describe('NxN 打乱规则 — 共通约束', () => {
  for (const N of [2, 3, 4, 5, 6, 7]) {
    it(`${N}x${N}: 相邻两步不同面 + 不连续 3 步同轴`, () => {
      const scr = generateNxNScramble(N, { seed: 42, length: 100 })
      for (let i = 1; i < scr.length; i++) {
        expect(scr[i]!.face, `${N}x${N} 步 ${i} 与上一步同面`).not.toBe(scr[i - 1]!.face)
      }
      for (let i = 2; i < scr.length; i++) {
        const a = AXIS[scr[i - 2]!.face], b = AXIS[scr[i - 1]!.face], c = AXIS[scr[i]!.face]
        expect(a === b && b === c, `${N}x${N} 步 ${i} 出现 3 步同轴`).toBe(false)
      }
    })
  }

  it('同种子可复现', () => {
    const a = generateNxNScramble(4, { seed: 999 })
    const b = generateNxNScramble(4, { seed: 999 })
    expect(a).toEqual(b)
  })
})

describe('NxN 打乱 — 2x2 只用 R/U/F', () => {
  it('2x2 不应出现 L/D/B', () => {
    const scr = generateNxNScramble(2, { seed: 7, length: 200 })
    for (const m of scr) {
      expect(['R', 'U', 'F'], `2x2 不该用 ${m.face}`).toContain(m.face)
    }
  })
})

describe('NxN 打乱 — 深度分级', () => {
  it('3x3 全部 depth=1', () => {
    const scr = generateNxNScramble(3, { seed: 1, length: 200 })
    for (const m of scr) expect(m.depth).toBe(1)
  })

  it('4x4 仅出现 depth ∈ {1, 2}', () => {
    const scr = generateNxNScramble(4, { seed: 2, length: 500 })
    for (const m of scr) expect([1, 2]).toContain(m.depth)
    // 应至少出现一次 depth=2 (统计意义上)
    expect(scr.some((m) => m.depth === 2)).toBe(true)
  })

  it('5x5 仅出现 depth ∈ {1, 2}', () => {
    const scr = generateNxNScramble(5, { seed: 3, length: 500 })
    for (const m of scr) expect([1, 2]).toContain(m.depth)
  })

  it('6x6 出现 depth ∈ {1, 2, 3}', () => {
    const scr = generateNxNScramble(6, { seed: 4, length: 800 })
    for (const m of scr) expect([1, 2, 3]).toContain(m.depth)
    expect(scr.some((m) => m.depth === 3)).toBe(true)
  })

  it('7x7 出现 depth ∈ {1, 2, 3}', () => {
    const scr = generateNxNScramble(7, { seed: 5, length: 800 })
    for (const m of scr) expect([1, 2, 3]).toContain(m.depth)
    expect(scr.some((m) => m.depth === 3)).toBe(true)
  })
})

describe('NxN 打乱 — 默认步数', () => {
  const expected: Record<number, number> = { 2: 11, 3: 20, 4: 45, 5: 60, 6: 80, 7: 100 }
  for (const N of [2, 3, 4, 5, 6, 7]) {
    it(`${N}x${N} 默认 ${expected[N]} 步`, () => {
      expect(generateNxNScramble(N).length).toBe(expected[N])
    })
  }
})
