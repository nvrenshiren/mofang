import type { Amount, FaceId, Move } from '../cube/moves'

/**
 * WCA 公式解析器
 *
 * 支持语法:
 *   - 单步: R U' R2 M' x'
 *   - 双层: Rw Lw'  或小写 r l'
 *   - 分组+重复: (R U R' U')3
 *   - 嵌套分组: ((R U R' U')2 F)2
 *   - 空白与逗号都视作分隔符
 *   - 注释: // 行注释, /* 块注释 *​/
 *
 * 解析失败时抛出 ParseError,带有 message 和 index (字符偏移)
 */

export class ParseError extends Error {
  constructor(message: string, public readonly index: number) {
    super(`公式解析失败 @${index}: ${message}`)
    this.name = 'ParseError'
  }
}

// 单字符 → 标准 FaceId
const FACE_LOWERCASE_TO_WIDE: Record<string, FaceId> = {
  r: 'Rw', l: 'Lw', u: 'Uw', d: 'Dw', f: 'Fw', b: 'Bw',
}
const ROTATION_FACES = new Set(['x', 'y', 'z'])

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
      // 行注释
      while (c.i < c.src.length && c.src[c.i] !== '\n') c.i++
    } else if (ch === '/' && c.src[c.i + 1] === '*') {
      // 块注释
      c.i += 2
      while (c.i < c.src.length && !(c.src[c.i] === '*' && c.src[c.i + 1] === '/')) c.i++
      if (c.i < c.src.length) c.i += 2
    } else {
      break
    }
  }
}

/** 解析一个 face token (不含修饰符) */
function readFace(c: Cursor): FaceId | null {
  const start = c.i
  const ch = c.src[c.i]
  if (!ch) return null

  // 整体旋转 x/y/z
  if (ROTATION_FACES.has(ch)) {
    c.i++
    return ch as FaceId
  }

  // 大写六面 + 中层
  if ('RLUDFBMES'.includes(ch)) {
    c.i++
    // 检查 Rw/Lw/...
    if ((ch === 'R' || ch === 'L' || ch === 'U' || ch === 'D' || ch === 'F' || ch === 'B') &&
        c.src[c.i] === 'w') {
      c.i++
      return `${ch}w` as FaceId
    }
    return ch as FaceId
  }

  // 小写 r/l/u/d/f/b → 等价于 Rw 等
  const wide = FACE_LOWERCASE_TO_WIDE[ch]
  if (wide) {
    c.i++
    return wide
  }

  c.i = start
  return null
}

/** 读取修饰符:可能是 '、2、2' 之一 */
function readSuffix(c: Cursor): Amount {
  const ch1 = c.src[c.i]
  if (ch1 === "'" || ch1 === '’') {
    c.i++
    return 3
  }
  if (ch1 === '2') {
    c.i++
    // 允许 2' (= 等同于 2,但 WCA 习惯写 R2,我们容忍 R2')
    if (c.src[c.i] === "'" || c.src[c.i] === '’') c.i++
    return 2
  }
  return 1
}

/** 读取一个十进制正整数 (用于分组重复次数) */
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

/** 解析序列直到遇到 ')' 或字符串结束 */
function parseSeq(c: Cursor, stopOnParen: boolean): Move[] {
  const out: Move[] = []
  while (true) {
    eatWhitespaceAndComments(c)
    if (c.i >= c.src.length) break
    const ch = c.src[c.i]!

    // 闭合分组
    if (ch === ')') {
      if (!stopOnParen) throw new ParseError('多余的 )', c.i)
      break
    }

    // 分组
    if (ch === '(') {
      c.i++
      const inner = parseSeq(c, true)
      eatWhitespaceAndComments(c)
      if (c.src[c.i] !== ')') throw new ParseError('缺少匹配的 )', c.i)
      c.i++
      // 检查重复次数
      const reps = readInteger(c) ?? 1
      if (reps < 1 || reps > 999) throw new ParseError(`分组重复次数非法: ${reps}`, c.i)
      for (let r = 0; r < reps; r++) out.push(...inner)
      continue
    }

    // face
    const face = readFace(c)
    if (face === null) {
      throw new ParseError(`无法识别的字符 "${ch}"`, c.i)
    }
    const amount = readSuffix(c)
    out.push({ face, amount })
  }
  return out
}

export function parse(src: string): Move[] {
  const c: Cursor = { src, i: 0 }
  const out = parseSeq(c, false)
  return out
}

/**
 * 安全解析:返回 { ok, moves } 或 { ok: false, error, index }
 * UI 可以用这个做实时校验,不抛异常
 */
export type ParseResult =
  | { readonly ok: true; readonly moves: Move[] }
  | { readonly ok: false; readonly error: string; readonly index: number }

export function safeParse(src: string): ParseResult {
  try {
    return { ok: true, moves: parse(src) }
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: e.message, index: e.index }
    }
    throw e
  }
}
