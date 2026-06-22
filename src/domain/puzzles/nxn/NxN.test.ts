import { describe, it, expect } from 'vitest'
import { createNxNCube } from './NxNCube'
import type { NxNMove } from './NxNMoves'

const m = (face: NxNMove['face'], depth = 1, amount: NxNMove['amount'] = 1): NxNMove => ({ face, depth, amount })

describe('NxN — solved 态 cubie 数量', () => {
  it('2x2: 8 块', () => expect(createNxNCube(2).solved().cubies.length).toBe(8))
  it('3x3: 26 块', () => expect(createNxNCube(3).solved().cubies.length).toBe(26))
  it('4x4: 56 块', () => expect(createNxNCube(4).solved().cubies.length).toBe(56))
  it('5x5: 98 块', () => expect(createNxNCube(5).solved().cubies.length).toBe(98))
  it('6x6: 152 块', () => expect(createNxNCube(6).solved().cubies.length).toBe(152))
  it('7x7: 218 块', () => expect(createNxNCube(7).solved().cubies.length).toBe(218))
})

describe('NxN — 中层 M/E/S (仅奇数 N 有效)', () => {
  for (const N of [3, 5, 7]) {
    for (const f of ['M', 'E', 'S'] as const) {
      it(`${N}x${N} ${f} 转 4 次回到 solved`, () => {
        const p = createNxNCube(N)
        let s = p.solved()
        for (let i = 0; i < 4; i++) s = p.apply(s, m(f))
        expect(p.isSolved(s)).toBe(true)
      })
    }
    it(`${N}x${N} M 改变了状态 (不是 no-op)`, () => {
      const p = createNxNCube(N)
      const s = p.apply(p.solved(), m('M'))
      expect(p.isSolved(s)).toBe(false)
    })
  }

  for (const N of [2, 4, 6]) {
    it(`${N}x${N} (偶数) M 是 no-op (无 dead-middle)`, () => {
      const p = createNxNCube(N)
      const s = p.apply(p.solved(), m('M'))
      expect(p.isSolved(s)).toBe(true)
    })
  }
})

describe('NxN — 基础转动周期', () => {
  for (const N of [2, 3, 4, 5, 6, 7]) {
    for (const f of ['R', 'L', 'U', 'D', 'F', 'B'] as const) {
      it(`${N}x${N} ${f} 转 4 次回到 solved`, () => {
        const p = createNxNCube(N)
        let s = p.solved()
        for (let i = 0; i < 4; i++) s = p.apply(s, m(f))
        expect(p.isSolved(s)).toBe(true)
      })
    }
  }
})

describe('NxN — wide 层 + 大魔方专用层', () => {
  it('4x4 Rw 转 4 次回到 solved', () => {
    const p = createNxNCube(4)
    let s = p.solved()
    for (let i = 0; i < 4; i++) s = p.apply(s, m('R', 2))
    expect(p.isSolved(s)).toBe(true)
  })

  it('5x5 3Rw 转 4 次回到 solved', () => {
    const p = createNxNCube(5)
    let s = p.solved()
    for (let i = 0; i < 4; i++) s = p.apply(s, m('R', 3))
    expect(p.isSolved(s)).toBe(true)
  })
})

describe('NxN — 整体旋转', () => {
  for (const N of [2, 3, 4, 5]) {
    for (const f of ['x', 'y', 'z'] as const) {
      it(`${N}x${N} ${f} 转 4 次回到 solved`, () => {
        const p = createNxNCube(N)
        let s = p.solved()
        for (let i = 0; i < 4; i++) s = p.apply(s, p.parse(f)[0]!)
        expect(p.isSolved(s)).toBe(true)
      })
    }
  }
})

describe('NxN — move 与逆对消', () => {
  for (const N of [2, 3, 4, 5]) {
    it(`${N}x${N} R R' = solved`, () => {
      const p = createNxNCube(N)
      let s = p.solved()
      s = p.apply(s, m('R'))
      s = p.apply(s, m('R', 1, 3))
      expect(p.isSolved(s)).toBe(true)
    })
  }
})

describe('NxN — Sexy move 周期', () => {
  for (const N of [3, 4, 5]) {
    it(`${N}x${N} (R U R' U')^6 = solved`, () => {
      const p = createNxNCube(N)
      let s = p.solved()
      const sexy = [m('R'), m('U'), m('R', 1, 3), m('U', 1, 3)]
      for (let i = 0; i < 6; i++) for (const mv of sexy) s = p.apply(s, mv)
      expect(p.isSolved(s)).toBe(true)
    })
  }
})

describe('NxN — 打乱再逆向应用回到 solved', () => {
  for (const N of [2, 3, 4, 5, 6, 7]) {
    it(`${N}x${N} scramble + inverse = solved`, () => {
      const p = createNxNCube(N)
      const scr = p.generateScramble({ seed: 42 })
      let s = p.solved()
      for (const mv of scr) s = p.apply(s, mv)
      // 大多数情况下打乱后不是 solved
      expect(p.isSolved(s)).toBe(false)
      // 反向序列应用回 solved
      for (let i = scr.length - 1; i >= 0; i--) s = p.apply(s, p.inverseMove(scr[i]!))
      expect(p.isSolved(s)).toBe(true)
    })
  }
})

describe('NxN parser', () => {
  it('数字前缀 wide: 3Rw', () => {
    const p = createNxNCube(5)
    expect(p.parse('3Rw')).toEqual([m('R', 3)])
  })

  it('小写 r = Rw (depth 2)', () => {
    const p = createNxNCube(4)
    expect(p.parse('r')).toEqual([m('R', 2)])
  })

  it('整体旋转 x 的 depth 被规整化为 N', () => {
    const p = createNxNCube(4)
    expect(p.parse('x')).toEqual([{ face: 'x', depth: 4, amount: 1 }])
  })
})
