import { describe, it, expect } from 'vitest'
import { createNxNCube } from './NxNCube'

describe('NxN keymap 按 N 分级', () => {
  it('2x2 只有 r/u/f 三键 + 整体旋转 ;/[/-', () => {
    const km = createNxNCube(2).keymap()
    const keys = km.map((k) => k.key).sort()
    expect(keys).toEqual(['-', ';', '[', 'f', 'r', 'u'].sort())
  })

  for (const N of [4, 6]) {
    it(`${N}x${N} (偶数) 有完整 6 面 + 整体旋转, 无 M/E/S (共 9 键)`, () => {
      const km = createNxNCube(N).keymap()
      const keys = km.map((k) => k.key).sort()
      expect(keys).toEqual(['-', ';', '[', 'b', 'd', 'f', 'l', 'r', 'u'].sort())
    })
  }

  for (const N of [3, 5, 7]) {
    it(`${N}x${N} (奇数) 有 6 面 + m/e/s 中层 + 整体旋转 (共 12 键)`, () => {
      const km = createNxNCube(N).keymap()
      const keys = km.map((k) => k.key).sort()
      expect(keys).toEqual(['-', ';', '[', 'b', 'd', 'e', 'f', 'l', 'm', 'r', 's', 'u'].sort())
    })
  }

  it('2x2 keymap 不包含 L/D/B', () => {
    const km = createNxNCube(2).keymap()
    const faces = km.map((k) => k.move.face)
    expect(faces).not.toContain('L')
    expect(faces).not.toContain('D')
    expect(faces).not.toContain('B')
  })

  it('整体旋转的 depth 自动是 N', () => {
    expect(createNxNCube(2).keymap().find((k) => k.key === ';')!.move.depth).toBe(2)
    expect(createNxNCube(5).keymap().find((k) => k.key === ';')!.move.depth).toBe(5)
  })
})

describe('NxN 按钮面板 键位提示按 N 分级', () => {
  it('2x2 的 L/D/B 按钮没有键位提示', () => {
    const groups = createNxNCube(2).buttonGroups()
    const lGroup = groups.find((g) => g.label.includes('L'))!
    // L 按钮不应有 key (因为 2x2 没绑 l)
    expect(lGroup.buttons.every((b) => !b.key)).toBe(true)
  })

  it('3x3 的 L 按钮有 l 键位提示', () => {
    const groups = createNxNCube(3).buttonGroups()
    const lGroup = groups.find((g) => g.label.includes('L'))!
    const lCw = lGroup.buttons.find((b) => b.amount === 1)!
    expect(lCw.key).toBe('l')
  })
})
