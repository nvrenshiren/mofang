import type { AppMode } from '../types'

/**
 * 应用级偏好持久化 (模式 / 当前 puzzle / 音效)
 * 挑战成绩另有 TimesStore 自己的持久化, 互不干扰
 */

import type { PuzzleId } from '../domain/puzzles/Puzzle'

const KEY = 'cubelab.v1'

export interface Persisted {
  mode: AppMode
  puzzleId: PuzzleId
  soundMuted: boolean
}

const DEFAULT: Persisted = {
  mode: 'training',
  puzzleId: '3x3',
  soundMuted: false,
}

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return { ...DEFAULT, ...parsed }
  } catch {
    return DEFAULT
  }
}

export function save(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // 静默 (隐私模式 / 配额满)
  }
}

export function update(patch: Partial<Persisted>): Persisted {
  const cur = load()
  const next = { ...cur, ...patch }
  save(next)
  return next
}
