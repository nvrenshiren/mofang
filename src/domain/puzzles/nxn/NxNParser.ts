/**
 * NxN 公式解析
 *
 * 支持:
 *   - 单层: R U' R2 M' x'
 *   - 双层 (3x3 习惯): Rw / r 等同 depth=2
 *   - N 阶宽层: 3Rw, 4Rw (数字前缀 = depth)
 *   - 分组: (R U R' U')3
 *   - 注释 // 与 /* *\/
 *
 * 解析输出: NxNMove[]; 解析时不知道 N (调用方负责裁剪 depth ≤ ⌊N/2⌋)
 */

import type { Amount, NxNFaceId, NxNMove } from './NxNMoves'

export class ParseError extends Error {
  constructor(message: string, public readonly index: number) {
    super(`公式解析失败 @${index}: ${message}`)
    this.name = 'ParseError'
  }
}

const FACE_LOWERCASE_TO_WIDE: Record<string, NxNFaceId> = {
  r: 'R', l: 'L', u: 'U', d: 'D', f: 'F', b: 'B',
}

interface Cursor {
  src: string
  i: number
}

function eatWhitespaceAndComments(c: Cursor): void {
  while (c.i < c.src.length) {
    const ch = c.src[c.i]!
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') {
      c.i++
    } else if (ch === '/' && c.src[c.i + 1] === '/') {
      while (c.i < c.src.length && c.src[c.i] !== '\n') c.i++
    } else if (ch === '/' && c.src[c.i + 1] === '*') {
      c.i += 2
      while (c.i < c.src.length && !(c.src[c.i] === '*' && c.src[c.i + 1] === '/')) c.i++
      if (c.i < c.src.length) c.i += 2
    } else {
      break
    }
  }
}

function readDepthPrefix(c: Cursor): number | null {
  // 数字前缀 (仅当后跟 face 字符时才消费)
  let n = 0
  let read = 0
  while (c.i + read < c.src.length) {
    const ch = c.src[c.i + read]!
    const d = ch.charCodeAt(0) - 48
    if (d < 0 || d > 9) break
    n = n * 10 + d
    read++
  }
  if (read === 0) return null
  // 检查后面是不是 face (R L U D F B 或小写 r l u d f b, 后跟 'w' 才算 wide)
  const next = c.src[c.i + read]
  if (!next) return null
  if ('RLUDFB'.includes(next) || 'rludfb'.includes(next)) {
    // 数字 + 大写 face 必须紧跟 w 才是 wide (如 "3Rw"), 否则不消费数字
    if ('RLUDFB'.includes(next)) {
      if (c.src[c.i + read + 1] === 'w') {
        c.i += read
        return n
      }
      return null
    }
    // 数字 + 小写 face (如 "3r") -- 直接当 wide
    c.i += read
    return n
  }
  return null
}

function readFaceAndDepth(c: Cursor): { face: NxNFaceId; depth: number } | null {
  const start = c.i
  // 尝试读数字前缀作为 wide depth
  const depthPrefix = readDepthPrefix(c)
  const ch = c.src[c.i]
  if (!ch) { c.i = start; return null }

  // 整体旋转 x/y/z (depth 用 0 占位; 调用方设 depth=N)
  if (ch === 'x' || ch === 'y' || ch === 'z') {
    c.i++
    return { face: ch as NxNFaceId, depth: 0 }
  }

  // 大写六面 + 可选 w
  if ('RLUDFB'.includes(ch)) {
    c.i++
    if (c.src[c.i] === 'w') {
      c.i++
      return { face: ch as NxNFaceId, depth: depthPrefix ?? 2 }
    }
    if (depthPrefix !== null) {
      // 数字+大写但没 w —— readDepthPrefix 已守护过, 不会走到这
      c.i = start
      return null
    }
    return { face: ch as NxNFaceId, depth: 1 }
  }

  // 中层 M E S (单层, 没有 wide 形式)
  if ('MES'.includes(ch)) {
    if (depthPrefix !== null) { c.i = start; return null }
    c.i++
    return { face: ch as NxNFaceId, depth: 1 }
  }

  // 小写 r/l/... = wide
  const wide = FACE_LOWERCASE_TO_WIDE[ch]
  if (wide) {
    c.i++
    return { face: wide, depth: depthPrefix ?? 2 }
  }

  c.i = start
  return null
}

function readSuffix(c: Cursor): Amount {
  const ch1 = c.src[c.i]
  if (ch1 === "'" || ch1 === '’') {
    c.i++
    return 3
  }
  if (ch1 === '2') {
    c.i++
    if (c.src[c.i] === "'" || c.src[c.i] === '’') c.i++
    return 2
  }
  return 1
}

function readInteger(c: Cursor): number | null {
  let n = 0
  let read = 0
  while (c.i < c.src.length) {
    const ch = c.src[c.i]!
    const d = ch.charCodeAt(0) - 48
    if (d < 0 || d > 9) break
    n = n * 10 + d
    c.i++
    read++
  }
  return read > 0 ? n : null
}

function parseSeq(c: Cursor, stopOnParen: boolean): NxNMove[] {
  const out: NxNMove[] = []
  while (true) {
    eatWhitespaceAndComments(c)
    if (c.i >= c.src.length) break
    const ch = c.src[c.i]!

    if (ch === ')') {
      if (!stopOnParen) throw new ParseError('多余的 )', c.i)
      break
    }

    if (ch === '(') {
      c.i++
      const inner = parseSeq(c, true)
      eatWhitespaceAndComments(c)
      if (c.src[c.i] !== ')') throw new ParseError('缺少匹配的 )', c.i)
      c.i++
      const reps = readInteger(c) ?? 1
      if (reps < 1 || reps > 999) throw new ParseError(`分组重复次数非法: ${reps}`, c.i)
      for (let r = 0; r < reps; r++) out.push(...inner)
      continue
    }

    const fd = readFaceAndDepth(c)
    if (fd === null) throw new ParseError(`无法识别的字符 "${ch}"`, c.i)
    const amount = readSuffix(c)
    out.push({ face: fd.face, depth: fd.depth, amount })
  }
  return out
}

export function parseNxN(src: string): NxNMove[] {
  const c: Cursor = { src, i: 0 }
  return parseSeq(c, false)
}

export type ParseResult =
  | { ok: true; moves: NxNMove[] }
  | { ok: false; error: string; index: number }

export function safeParseNxN(src: string): ParseResult {
  try {
    return { ok: true, moves: parseNxN(src) }
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: e.message, index: e.index }
    }
    throw e
  }
}

/** 格式化 */
export function formatNxNMove(m: NxNMove): string {
  const suffix = m.amount === 1 ? '' : m.amount === 2 ? '2' : "'"
  if (m.face === 'x' || m.face === 'y' || m.face === 'z') {
    return `${m.face}${suffix}`
  }
  if (m.depth === 1) return `${m.face}${suffix}`
  if (m.depth === 2) return `${m.face}w${suffix}`
  return `${m.depth}${m.face}w${suffix}`
}

export function formatNxNMoves(moves: readonly NxNMove[]): string {
  return moves.map(formatNxNMove).join(' ')
}
