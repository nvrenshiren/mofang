import { describe, it, expect } from 'vitest'
import { generateScramble } from './generator'
import { applyMoves, isSolved, solved } from '../cube/Cube'

describe('scramble generator', () => {
  it('生成指定长度', () => {
    expect(generateScramble({ length: 20, seed: 42 })).toHaveLength(20)
    expect(generateScramble({ length: 15, seed: 1 })).toHaveLength(15)
  })

  it('同种子可复现', () => {
    const a = generateScramble({ length: 20, seed: 12345 })
    const b = generateScramble({ length: 20, seed: 12345 })
    expect(a).toEqual(b)
  })

  it('相邻两步不同面', () => {
    const s = generateScramble({ length: 50, seed: 7 })
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.face).not.toBe(s[i - 1]!.face)
    }
  })

  it('不连续 3 步同轴', () => {
    const s = generateScramble({ length: 200, seed: 99 })
    const AXES: Record<string, string> = {
      R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z',
    }
    for (let i = 2; i < s.length; i++) {
      const a = AXES[s[i - 2]!.face]
      const b = AXES[s[i - 1]!.face]
      const c = AXES[s[i]!.face]
      expect(a === b && b === c).toBe(false)
    }
  })

  it('应用后基本不会求解 (statistically)', () => {
    let unsolvedCount = 0
    for (let seed = 0; seed < 10; seed++) {
      const s = applyMoves(solved(), generateScramble({ length: 20, seed }))
      if (!isSolved(s)) unsolvedCount++
    }
    expect(unsolvedCount).toBe(10)
  })
})
