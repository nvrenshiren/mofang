import type { PuzzleId } from '../domain/puzzles/Puzzle'

/**
 * 挑战成绩 —— 持久化 + ao5/ao12 计算
 *
 * 设计要点:
 *   - 单局成绩 SolveRecord 包含: 时间 + 题目打乱 + 用户解步骤 + 时间戳 + 惩罚标记
 *   - ao5/ao12 按 WCA 规则: 最近 N 局,去掉最快最慢,中间 (N-2) 的平均
 *   - DNF 处理: 1 个 DNF 当最慢去掉; 2+ 个 DNF 整组 ao 视为 DNF (返回 null)
 *   - +2 惩罚: 加 2000ms 后参与排序/平均
 */

export type Penalty = 'ok' | 'plus2' | 'dnf'

export interface SolveRecord {
  ms: number
  /** 题目打乱步骤 (Move 序列, 任意 puzzle 的 Move) */
  scramble: unknown[]
  /** 用户解步骤 */
  solveMoves: unknown[]
  at: number
  penalty: Penalty
}

interface Persisted {
  records: SolveRecord[]
}

const MAX_RECORDS = 100

export class TimesStore {
  records: SolveRecord[] = []
  private listeners: (() => void)[] = []
  private readonly key: string

  constructor(puzzleId: PuzzleId) {
    this.key = `cubelab.times.${puzzleId}.v1`
    this.load()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.push(fn)
    return () => {
      const i = this.listeners.indexOf(fn)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  add(r: SolveRecord): void {
    this.records.push(r)
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS)
    }
    this.save()
    this.emit()
  }

  setPenalty(index: number, p: Penalty): void {
    const r = this.records[index]
    if (!r) return
    r.penalty = p
    this.save()
    this.emit()
  }

  remove(index: number): void {
    if (index < 0 || index >= this.records.length) return
    this.records.splice(index, 1)
    this.save()
    this.emit()
  }

  clear(): void {
    this.records = []
    this.save()
    this.emit()
  }

  best(): { record: SolveRecord; index: number } | null {
    let bestIdx = -1
    let bestMs = Infinity
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i]!
      if (r.penalty === 'dnf') continue
      const eff = effectiveMs(r)
      if (eff < bestMs) {
        bestMs = eff
        bestIdx = i
      }
    }
    if (bestIdx < 0) return null
    return { record: this.records[bestIdx]!, index: bestIdx }
  }

  ao5(): number | null { return this.averageOf(5) }
  ao12(): number | null { return this.averageOf(12) }

  private averageOf(n: number): number | null {
    if (this.records.length < n) return null
    const last = this.records.slice(-n)
    const dnfCount = last.filter((r) => r.penalty === 'dnf').length
    if (dnfCount >= 2) return null
    // DNF 视为 Infinity → 自然落到最慢去掉
    const times = last.map((r) => effectiveMs(r))
    const sorted = [...times].sort((a, b) => a - b)
    const trimmed = sorted.slice(1, sorted.length - 1)
    const sum = trimmed.reduce((a, b) => a + b, 0)
    return sum / trimmed.length
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return
      const parsed = JSON.parse(raw) as Persisted
      this.records = Array.isArray(parsed.records) ? parsed.records : []
    } catch {
      this.records = []
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ records: this.records }))
    } catch {
      // ignore
    }
  }
}

export function effectiveMs(r: SolveRecord): number {
  if (r.penalty === 'dnf') return Infinity
  return r.ms + (r.penalty === 'plus2' ? 2000 : 0)
}

export function formatMs(ms: number): string {
  if (!isFinite(ms)) return 'DNF'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec - min * 60
  const cs = Math.floor((ms - totalSec * 1000) / 10)
  const secStr = String(sec).padStart(2, '0')
  const csStr = String(cs).padStart(2, '0')
  return min > 0 ? `${min}:${secStr}.${csStr}` : `${sec}.${csStr}`
}
