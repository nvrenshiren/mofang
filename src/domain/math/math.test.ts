import { describe, it, expect } from 'vitest'
import { apply, eq, IDENTITY, inverse, mul, Rx90, Ry90, Rz90, square } from './Mat3'
import { v3 } from './Vec3'

describe('Mat3', () => {
  it('identity is identity', () => {
    expect(eq(mul(IDENTITY, Rx90), Rx90)).toBe(true)
    expect(eq(mul(Rx90, IDENTITY), Rx90)).toBe(true)
  })

  it('Rx90 旋转 4 次回到 identity', () => {
    let m = IDENTITY
    for (let i = 0; i < 4; i++) m = mul(m, Rx90)
    expect(eq(m, IDENTITY)).toBe(true)
  })

  it('Rx90 把 +Y 转到 +Z', () => {
    expect(apply(Rx90, v3(0, 1, 0))).toEqual([0, 0, 1])
    expect(apply(Rx90, v3(0, 0, 1))).toEqual([0, -1, 0])
  })

  it('Ry90 把 +Z 转到 +X', () => {
    expect(apply(Ry90, v3(0, 0, 1))).toEqual([1, 0, 0])
    expect(apply(Ry90, v3(1, 0, 0))).toEqual([0, 0, -1])
  })

  it('Rz90 把 +X 转到 +Y', () => {
    expect(apply(Rz90, v3(1, 0, 0))).toEqual([0, 1, 0])
    expect(apply(Rz90, v3(0, 1, 0))).toEqual([-1, 0, 0])
  })

  it('inverse 是转置且满足 m · m⁻¹ = I', () => {
    expect(eq(mul(Rx90, inverse(Rx90)), IDENTITY)).toBe(true)
    expect(eq(mul(Ry90, inverse(Ry90)), IDENTITY)).toBe(true)
    expect(eq(mul(Rz90, inverse(Rz90)), IDENTITY)).toBe(true)
  })

  it('square 等于 180°', () => {
    const r2 = square(Rx90)
    expect(apply(r2, v3(0, 1, 0))).toEqual([0, -1, 0])
  })
})
