/**
 * Puzzle 与 Renderer 工厂注册表
 * main.ts / AppStore 通过 PuzzleId 拿到对应的 puzzle + renderer
 */

import type { Puzzle, PuzzleId, PuzzleRenderer } from './Puzzle'
import { createNxNCube } from './nxn/NxNCube'
import { NxNCubeRenderer } from '../../render/puzzles/NxNCubeRenderer'
import type { NxNMove } from './nxn/NxNMoves'
import type { NxNState } from './nxn/NxNState'

export interface PuzzleEntry {
  readonly id: PuzzleId
  readonly displayName: string
  readonly icon: string
  createPuzzle(): Puzzle<unknown, unknown>
  createRenderer(): PuzzleRenderer<unknown, unknown>
}

function nxnEntry(N: number, icon: string): PuzzleEntry {
  const puzzle = createNxNCube(N)
  return {
    id: puzzle.meta.id,
    displayName: puzzle.meta.displayName,
    icon,
    createPuzzle: () => createNxNCube(N) as Puzzle<unknown, unknown>,
    createRenderer: () =>
      new NxNCubeRenderer(N) as unknown as PuzzleRenderer<unknown, unknown>,
  }
}

export const PUZZLES: readonly PuzzleEntry[] = [
  nxnEntry(2, '▣'),
  nxnEntry(3, '▦'),
  nxnEntry(4, '▩'),
  nxnEntry(5, '▩'),
  nxnEntry(6, '▩'),
  nxnEntry(7, '▩'),
]

export function findPuzzle(id: PuzzleId): PuzzleEntry | undefined {
  return PUZZLES.find((p) => p.id === id)
}

export type { NxNState, NxNMove }
