import { describe, it, expect } from 'vitest'
import {
  applyMove,
  applyMoves,
  fingerprint,
  isSolved,
  solved,
  SOLVED_POSITIONS,
  stickerColor,
} from './Cube'
import type { Move } from './moves'

const m = (face: Move['face'], amount: Move['amount'] = 1): Move => ({ face, amount })

describe('Cube — 求解态', () => {
  it('solved() 是求解态', () => {
    expect(isSolved(solved())).toBe(true)
  })

  it('26 个 cubie,排除 (0,0,0)', () => {
    expect(SOLVED_POSITIONS).toHaveLength(26)
    expect(SOLVED_POSITIONS.find((p) => p[0] === 0 && p[1] === 0 && p[2] === 0)).toBeUndefined()
  })
})

describe('Cube — 基础转动的周期', () => {
  const faces: Move['face'][] = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S']
  for (const f of faces) {
    it(`${f} 转 4 次回到求解态`, () => {
      let s = solved()
      for (let i = 0; i < 4; i++) s = applyMove(s, m(f))
      expect(isSolved(s)).toBe(true)
    })
  }

  for (const f of ['Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'] as const) {
    it(`${f} 转 4 次回到求解态`, () => {
      let s = solved()
      for (let i = 0; i < 4; i++) s = applyMove(s, m(f))
      expect(isSolved(s)).toBe(true)
    })
  }

  for (const f of ['x', 'y', 'z'] as const) {
    it(`${f} 转 4 次回到求解态`, () => {
      let s = solved()
      for (let i = 0; i < 4; i++) s = applyMove(s, m(f))
      expect(isSolved(s)).toBe(true)
    })
  }
})

describe('Cube — 转动与逆的对消', () => {
  const cases: Move['face'][] = ['R', 'U', 'F', 'L', 'D', 'B', 'M', 'E', 'S', 'Rw', 'x', 'y']
  for (const f of cases) {
    it(`${f} ${f}' 互为逆`, () => {
      const s = applyMoves(solved(), [m(f, 1), m(f, 3)])
      expect(isSolved(s)).toBe(true)
    })
    it(`${f}2 ${f}2 互为逆`, () => {
      const s = applyMoves(solved(), [m(f, 2), m(f, 2)])
      expect(isSolved(s)).toBe(true)
    })
  }
})

describe('Cube — Sexy move 周期', () => {
  it('(R U R\' U\') 重复 6 次回到求解态', () => {
    const sexy: Move[] = [m('R', 1), m('U', 1), m('R', 3), m('U', 3)]
    let s = solved()
    for (let i = 0; i < 6; i++) s = applyMoves(s, sexy)
    expect(isSolved(s)).toBe(true)
  })

  it('(R U R\' U\') 重复 3 次时未求解', () => {
    const sexy: Move[] = [m('R', 1), m('U', 1), m('R', 3), m('U', 3)]
    let s = solved()
    for (let i = 0; i < 3; i++) s = applyMoves(s, sexy)
    expect(isSolved(s)).toBe(false)
  })
})

describe('Cube — T-perm 自逆', () => {
  // R U R' U' R' F R2 U' R' U' R U R' F' — 经典 T-perm,自身是逆
  it('T-perm 应用两次回到求解态', () => {
    const tperm: Move[] = [
      m('R'), m('U'), m('R', 3), m('U', 3),
      m('R', 3), m('F'), m('R', 2), m('U', 3),
      m('R', 3), m('U', 3), m('R'), m('U'),
      m('R', 3), m('F', 3),
    ]
    let s = solved()
    s = applyMoves(s, tperm)
    expect(isSolved(s)).toBe(false)
    s = applyMoves(s, tperm)
    expect(isSolved(s)).toBe(true)
  })
})

describe('Cube — 颜色查询', () => {
  it('求解态下 +X 方向上的右侧中心是红色', () => {
    const s = solved()
    // 右面中心 = 位置 (1,0,0)
    const center = s.cubies.find((c) => c.position[0] === 1 && c.position[1] === 0 && c.position[2] === 0)!
    expect(stickerColor(center, [1, 0, 0])).toBe('R')
  })

  it('求解态下 +Y 方向上的顶面中心是白色 (U)', () => {
    const s = solved()
    const top = s.cubies.find((c) => c.position[0] === 0 && c.position[1] === 1 && c.position[2] === 0)!
    expect(stickerColor(top, [0, 1, 0])).toBe('U')
  })

  it('R 转一次后,原 +X 中心 (1,0,0) 仍在原位且仍显示红色', () => {
    // 中心 cubie 在 R 转动下:位置不变 (在轴上),朝向自转 90°,但因为只有 +X 方向有贴纸,
    // 它绕自身轴自转看不出来,显示的颜色不变
    let s = solved()
    s = applyMove(s, m('R'))
    const center = s.cubies.find((c) => c.position[0] === 1 && c.position[1] === 0 && c.position[2] === 0)!
    expect(stickerColor(center, [1, 0, 0])).toBe('R')
  })

  it('R 转一次后,原顶前角 (1,1,1) 移动到底前位置 (1,-1,1)? 验证 +Y→-Z 的 R 旋转', () => {
    let s = solved()
    s = applyMove(s, m('R'))
    // R 把位置 (1,1,1) 通过 R 旋转 (+Y→-Z) 变成 (1,?,?): apply([1,0,0,0,0,1,0,-1,0], [1,1,1])
    // 第一行: 1*1+0+0=1; 第二行: 0+0*1+1*1=1; 第三行: 0+(-1)*1+0=-1 → (1,1,-1)
    const moved = s.cubies.find((c) => c.id === 24)! // (1,1,1) 对应的 solvedId
    // (1,1,1) 在 SOLVED_POSITIONS 里是最后一个:索引 = ?
    // SOLVED_POSITIONS 顺序: 三重循环 x:-1..1, y:-1..1, z:-1..1 跳过 (0,0,0)
    // (1,1,1) 是最后一个,索引 25
    const last = s.cubies.find((c) => c.id === 25)!
    expect(last.position).toEqual([1, 1, -1])
    void moved // 仅引用
  })
})

describe('Cube — fingerprint 唯一性', () => {
  it('不同状态指纹不同', () => {
    const a = solved()
    const b = applyMove(a, m('R'))
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })
  it('相同操作产生相同指纹', () => {
    const a = applyMove(solved(), m('R'))
    const b = applyMove(solved(), m('R'))
    expect(fingerprint(a)).toBe(fingerprint(b))
  })
})
