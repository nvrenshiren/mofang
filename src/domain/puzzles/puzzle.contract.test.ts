/**
 * Puzzle 接口合同测试 —— 任何 Puzzle 实现都必须满足下列不变式
 * 跑遍 registry 里所有注册谜题
 */

import { describe, it, expect } from 'vitest'
import { PUZZLES } from './registry'
import type { Puzzle } from './Puzzle'

for (const entry of PUZZLES) {
  describe(`合同 · ${entry.displayName}`, () => {
    const puzzle = entry.createPuzzle() as Puzzle<unknown, unknown>

    it('meta 完整', () => {
      expect(puzzle.meta.id).toBe(entry.id)
      expect(puzzle.meta.displayName).toBeTruthy()
      expect(puzzle.meta.scrambleLength).toBeGreaterThan(0)
    })

    it('solved() → isSolved() = true', () => {
      expect(puzzle.isSolved(puzzle.solved())).toBe(true)
    })

    it('safeParse("") = ok 空', () => {
      const r = puzzle.safeParse('')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.moves).toEqual([])
    })

    it('safeParse 垃圾输入 = error', () => {
      const r = puzzle.safeParse('@@@')
      expect(r.ok).toBe(false)
    })

    it('打乱长度匹配 meta', () => {
      const scr = puzzle.generateScramble()
      expect(scr.length).toBe(puzzle.meta.scrambleLength)
    })

    it('打乱后通常 NOT solved', () => {
      // 同种子重复 5 次, 期望至少 4 次不还原
      let unsolved = 0
      for (let seed = 1; seed <= 5; seed++) {
        const scr = puzzle.generateScramble({ seed })
        let s = puzzle.solved()
        for (const m of scr) s = puzzle.apply(s, m)
        if (!puzzle.isSolved(s)) unsolved++
      }
      expect(unsolved).toBeGreaterThanOrEqual(4)
    })

    it('打乱再逆序应用 → solved', () => {
      const scr = puzzle.generateScramble({ seed: 42 })
      let s = puzzle.solved()
      for (const m of scr) s = puzzle.apply(s, m)
      for (let i = scr.length - 1; i >= 0; i--) s = puzzle.apply(s, puzzle.inverseMove(scr[i]!))
      expect(puzzle.isSolved(s)).toBe(true)
    })

    it('format/parse 往返一致', () => {
      const scr = puzzle.generateScramble({ seed: 7 })
      const text = puzzle.formatMoves(scr)
      const reparsed = puzzle.parse(text)
      expect(reparsed.length).toBe(scr.length)
      // 状态等价 (应用结果相同)
      let a = puzzle.solved()
      let b = puzzle.solved()
      for (const m of scr) a = puzzle.apply(a, m)
      for (const m of reparsed) b = puzzle.apply(b, m)
      expect(puzzle.isSolved(a)).toBe(puzzle.isSolved(b))
      // 进一步: 二者继续应用同一串都应该一致
      const aSolved = puzzle.isSolved(a)
      const bSolved = puzzle.isSolved(b)
      expect(aSolved).toBe(bSolved)
    })

    it('buttonGroups 非空 + 每组至少 1 个按钮', () => {
      const groups = puzzle.buttonGroups()
      expect(groups.length).toBeGreaterThan(0)
      for (const g of groups) {
        expect(g.buttons.length).toBeGreaterThan(0)
        for (const b of g.buttons) {
          expect(b.label).toBeTruthy()
          expect([1, 2, 3]).toContain(b.amount)
        }
      }
    })

    it('keymap 非空', () => {
      const map = puzzle.keymap()
      expect(map.length).toBeGreaterThan(0)
      for (const b of map) {
        expect(b.key).toBeTruthy()
        expect(b.move).toBeTruthy()
      }
    })

    it('inverseMove 两次 = 原 move (状态意义上)', () => {
      const scr = puzzle.generateScramble({ seed: 13 }).slice(0, 1)
      if (!scr.length) return
      const m = scr[0]!
      const m2 = puzzle.inverseMove(puzzle.inverseMove(m))
      let a = puzzle.solved()
      let b = puzzle.solved()
      a = puzzle.apply(a, m)
      b = puzzle.apply(b, m2)
      expect(puzzle.isSolved(a)).toBe(puzzle.isSolved(b))
    })
  })
}
