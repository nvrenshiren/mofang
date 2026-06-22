import { describe, it, expect } from 'vitest'
import { parse, safeParse } from './parser'
import { collapse, formatMove, formatMoves } from './formatter'

describe('parser — 基础', () => {
  it('单步', () => {
    expect(parse('R')).toEqual([{ face: 'R', amount: 1 }])
    expect(parse("R'")).toEqual([{ face: 'R', amount: 3 }])
    expect(parse('R2')).toEqual([{ face: 'R', amount: 2 }])
  })

  it('Unicode prime 也接受 ’', () => {
    expect(parse('R’')).toEqual([{ face: 'R', amount: 3 }])
  })

  it('Sexy move', () => {
    expect(parse("R U R' U'")).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
      { face: 'R', amount: 3 },
      { face: 'U', amount: 3 },
    ])
  })

  it('双层 Rw / 小写 r 等价', () => {
    expect(parse('Rw')).toEqual([{ face: 'Rw', amount: 1 }])
    expect(parse('r')).toEqual([{ face: 'Rw', amount: 1 }])
    expect(parse("r'")).toEqual([{ face: 'Rw', amount: 3 }])
  })

  it('整体旋转', () => {
    expect(parse("x y' z2")).toEqual([
      { face: 'x', amount: 1 },
      { face: 'y', amount: 3 },
      { face: 'z', amount: 2 },
    ])
  })

  it('中层', () => {
    expect(parse("M E' S2")).toEqual([
      { face: 'M', amount: 1 },
      { face: 'E', amount: 3 },
      { face: 'S', amount: 2 },
    ])
  })
})

describe('parser — 分组', () => {
  it('单层分组', () => {
    expect(parse("(R U R' U')3")).toEqual([
      ...repeat(
        [
          { face: 'R', amount: 1 },
          { face: 'U', amount: 1 },
          { face: 'R', amount: 3 },
          { face: 'U', amount: 3 },
        ],
        3,
      ),
    ])
  })

  it('嵌套分组', () => {
    expect(parse('((R U)2 F)2')).toEqual(
      repeat(
        [
          ...repeat(
            [
              { face: 'R', amount: 1 },
              { face: 'U', amount: 1 },
            ],
            2,
          ),
          { face: 'F', amount: 1 },
        ],
        2,
      ),
    )
  })

  it('无重复次数的分组默认为 1', () => {
    expect(parse('(R U)')).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
    ])
  })
})

describe('parser — 注释和分隔', () => {
  it('逗号 / 多空白', () => {
    expect(parse('R,\nU,\tR\'')).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
      { face: 'R', amount: 3 },
    ])
  })

  it('行注释', () => {
    expect(parse('R // first\nU // second')).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
    ])
  })

  it('块注释', () => {
    expect(parse('R /* skip */ U')).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
    ])
  })
})

describe('parser — 错误', () => {
  it('未识别字符', () => {
    const r = safeParse('R Q U')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Q')
  })
  it('未匹配的 )', () => {
    expect(safeParse('R U R\') U').ok).toBe(false)
  })
  it('未闭合的 (', () => {
    expect(safeParse('(R U').ok).toBe(false)
  })
})

describe('formatter', () => {
  it('formatMove', () => {
    expect(formatMove({ face: 'R', amount: 1 })).toBe('R')
    expect(formatMove({ face: 'R', amount: 2 })).toBe('R2')
    expect(formatMove({ face: 'R', amount: 3 })).toBe("R'")
    expect(formatMove({ face: 'Rw', amount: 3 })).toBe("Rw'")
  })

  it('formatMoves', () => {
    expect(formatMoves(parse("R U R' U'"))).toBe("R U R' U'")
  })

  it('collapse 折叠同面', () => {
    expect(collapse(parse('R R'))).toEqual([{ face: 'R', amount: 2 }])
    expect(collapse(parse("R R'"))).toEqual([])
    expect(collapse(parse("R R2"))).toEqual([{ face: 'R', amount: 3 }])
    expect(collapse(parse('R U R'))).toEqual([
      { face: 'R', amount: 1 },
      { face: 'U', amount: 1 },
      { face: 'R', amount: 1 },
    ])
  })
})

function repeat<T>(arr: T[], n: number): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(...arr)
  return out
}
