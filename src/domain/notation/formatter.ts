import type { Move } from '../cube/moves'

/** 把单个 move 格式化为 WCA 标准字符串 (如 R, U', M2, Rw') */
export function formatMove(m: Move): string {
  const suffix = m.amount === 1 ? '' : m.amount === 2 ? '2' : "'"
  return `${m.face}${suffix}`
}

/** 把一串 move 格式化为以空格分隔的公式串 */
export function formatMoves(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ')
}

/**
 * 折叠相邻同 face 的 move:
 *   R R → R2;  R R' → ∅;  R R2 → R'
 * 用于把"原始按键流"压缩成更可读的公式
 */
export function collapse(moves: readonly Move[]): Move[] {
  const out: Move[] = []
  for (const m of moves) {
    const last = out[out.length - 1]
    if (last && last.face === m.face) {
      // 将旋转量相加 (1 -> +1, 3 -> -1, 2 -> 2),mod 4
      const va = last.amount === 1 ? 1 : last.amount === 2 ? 2 : 3
      const vb = m.amount === 1 ? 1 : m.amount === 2 ? 2 : 3
      const sum = (va + vb) % 4
      out.pop()
      if (sum === 0) continue
      if (sum === 1) out.push({ face: m.face, amount: 1 })
      else if (sum === 2) out.push({ face: m.face, amount: 2 })
      else out.push({ face: m.face, amount: 3 })
    } else {
      out.push(m)
    }
  }
  return out
}
