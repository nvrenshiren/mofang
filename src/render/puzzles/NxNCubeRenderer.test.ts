import { describe, it, expect } from 'vitest'
import { axisVectorFor, signedAngleFor } from './NxNCubeRenderer'
import type { NxNFaceId, NxNMove } from '../../domain/puzzles/nxn/NxNMoves'

const m = (face: NxNFaceId, amount: 1 | 2 | 3 = 1, depth = 1): NxNMove =>
  ({ face, depth, amount })

describe('NxNCubeRenderer · 动画轴方向', () => {
  it('R/L/M/x 绕 X 轴', () => {
    for (const f of ['R', 'L', 'M', 'x'] as NxNFaceId[]) {
      const v = axisVectorFor(f)
      expect([v.x, v.y, v.z], `${f} 应绕 X 轴`).toEqual([1, 0, 0])
    }
  })

  it('U/D/E/y 绕 Y 轴', () => {
    for (const f of ['U', 'D', 'E', 'y'] as NxNFaceId[]) {
      const v = axisVectorFor(f)
      expect([v.x, v.y, v.z], `${f} 应绕 Y 轴`).toEqual([0, 1, 0])
    }
  })

  it('F/B/S/z 绕 Z 轴', () => {
    for (const f of ['F', 'B', 'S', 'z'] as NxNFaceId[]) {
      const v = axisVectorFor(f)
      expect([v.x, v.y, v.z], `${f} 应绕 Z 轴`).toEqual([0, 0, 1])
    }
  })
})

describe('NxNCubeRenderer · 动画角度方向', () => {
  const _90 = Math.PI / 2

  it('CW from outside (R/U/F/x/y/z) → 负向 (右手系)', () => {
    for (const f of ['R', 'U', 'F', 'x', 'y', 'z'] as NxNFaceId[]) {
      expect(signedAngleFor(m(f, 1)), `${f} amount=1`).toBeCloseTo(-_90)
    }
  })

  it('CW from outside 反向 (L/D/B) → 正向', () => {
    for (const f of ['L', 'D', 'B'] as NxNFaceId[]) {
      expect(signedAngleFor(m(f, 1)), `${f} amount=1`).toBeCloseTo(+_90)
    }
  })

  it('中层 M 跟 L 同向 (+正), E 跟 D 同向 (+正), S 跟 F 同向 (-负)', () => {
    expect(signedAngleFor(m('M', 1))).toBeCloseTo(+_90)
    expect(signedAngleFor(m('E', 1))).toBeCloseTo(+_90)
    expect(signedAngleFor(m('S', 1))).toBeCloseTo(-_90)
  })

  it("prime (amount=3) 反向", () => {
    expect(signedAngleFor(m('R', 3))).toBeCloseTo(+_90)  // R' 是 R 的反向
    expect(signedAngleFor(m('M', 3))).toBeCloseTo(-_90)  // M' 是 M 的反向
  })

  it('180° (amount=2) 是 amount=1 的两倍角度', () => {
    expect(signedAngleFor(m('R', 2))).toBeCloseTo(-Math.PI)
    expect(signedAngleFor(m('M', 2))).toBeCloseTo(+Math.PI)
  })
})

describe('NxNCubeRenderer · 轴+角联动正确性', () => {
  // 关键不变式: 同 axis family 的 face 旋转方向应当一致 (M 跟 L 在同 X 轴 + 同号)
  it('M 与 L 同轴同向', () => {
    const lAxis = axisVectorFor('L')
    const mAxis = axisVectorFor('M')
    expect([mAxis.x, mAxis.y, mAxis.z]).toEqual([lAxis.x, lAxis.y, lAxis.z])
    expect(Math.sign(signedAngleFor(m('M', 1)))).toBe(Math.sign(signedAngleFor(m('L', 1))))
  })

  it('E 与 D 同轴同向', () => {
    const dAxis = axisVectorFor('D')
    const eAxis = axisVectorFor('E')
    expect([eAxis.x, eAxis.y, eAxis.z]).toEqual([dAxis.x, dAxis.y, dAxis.z])
    expect(Math.sign(signedAngleFor(m('E', 1)))).toBe(Math.sign(signedAngleFor(m('D', 1))))
  })

  it('S 与 F 同轴同向', () => {
    const fAxis = axisVectorFor('F')
    const sAxis = axisVectorFor('S')
    expect([sAxis.x, sAxis.y, sAxis.z]).toEqual([fAxis.x, fAxis.y, fAxis.z])
    expect(Math.sign(signedAngleFor(m('S', 1)))).toBe(Math.sign(signedAngleFor(m('F', 1))))
  })
})
