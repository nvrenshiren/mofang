import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { applyMove, layerSelector, rotationOf, type NxNFaceId, type NxNMove } from '../../domain/puzzles/nxn/NxNMoves'
import { solvedState, solvedStickersOfPosition, type NxNState } from '../../domain/puzzles/nxn/NxNState'
import type { PuzzleRenderer } from '../../domain/puzzles/Puzzle'
import type { Stage } from '../Stage'

/**
 * NxN 立方体渲染器 (覆盖 2x2 ~ 7x7)
 *
 * 设计要点:
 *   - 整个魔方占世界空间 ~3 单位边长 (跟现有 3x3 视觉一致)
 *   - 单 cubie 大小 = 3 / N * 0.95, 留 5% 缝隙
 *   - 共享 mesh geometry / material 减少 GPU 切换
 *   - 层旋转: rotor Group 临时 attach 受影响 cubie, slerp 动画, 完成后释放
 *   - 大魔方 (N>=5): 相机距离自适应, 避免出框
 */

const FACE_HEX = {
  R: '#c41e3a', L: '#f08000', U: '#f5f5f0', D: '#f5c518', F: '#1a9f3a', B: '#1464d6',
} as const
type FaceCol = keyof typeof FACE_HEX

const EASE = (t: number) => 1 - Math.pow(1 - t, 3)

interface CubieMeshMeta {
  /** 在 NxNState.cubies 中的 id */
  id: number
  /** 几何中心点的世界坐标 (基于 solved 初始位置) */
  initialIdx: readonly [number, number, number]
  group: THREE.Group
}

interface PendingMove {
  move: NxNMove
  durationMs: number
  resolve: () => void
}

interface ActiveAnim {
  move: NxNMove
  axis: THREE.Vector3
  angle: number
  elapsed: number
  duration: number
  rotatingIds: number[]
  resolve: () => void
}

export class NxNCubeRenderer implements PuzzleRenderer<NxNState, NxNMove> {
  readonly N: number
  private stage: Stage | null = null
  private root: THREE.Group | null = null
  private rotor: THREE.Group | null = null
  private state: NxNState
  /** mesh 索引: cubie.id → mesh */
  private cubieMeshes: THREE.Group[] = []
  private cubieMetas: CubieMeshMeta[] = []

  private queue: PendingMove[] = []
  private active: ActiveAnim | null = null
  private unsubTick: (() => void) | null = null

  onMoveApplied?: (m: NxNMove) => void

  // 这些资源跟随 renderer 生命周期, unmount 时统一释放
  private disposeBag: { dispose(): void }[] = []

  constructor(N: number) {
    this.N = N
    this.state = solvedState(N)
  }

  mount(stage: Stage, initialState: NxNState): void {
    this.stage = stage
    this.state = initialState

    this.root = new THREE.Group()
    stage.cubeRoot.add(this.root)
    this.rotor = new THREE.Group()
    this.root.add(this.rotor)

    this.buildMeshes()
    this.fitCameraForSize()
    this.unsubTick = stage.addUpdater((dt) => this.tick(dt))
  }

  unmount(): void {
    if (this.unsubTick) {
      this.unsubTick()
      this.unsubTick = null
    }
    if (this.root && this.stage) {
      this.stage.cubeRoot.remove(this.root)
    }
    for (const d of this.disposeBag) d.dispose()
    this.disposeBag = []
    this.cubieMeshes = []
    this.cubieMetas = []
    this.queue = []
    this.active = null
    this.root = null
    this.rotor = null
    this.stage = null
  }

  // ---- 构建 ----

  private buildMeshes(): void {
    const N = this.N
    const totalSize = 3 // 世界单位:整个 cube 边长约 3
    const cubieSize = totalSize / N * 0.95
    const cubieRadius = Math.min(0.06, cubieSize * 0.08)
    const stickerSize = cubieSize * 0.85
    const stickerThickness = 0.012
    const stickerRadius = Math.min(0.10, cubieSize * 0.10)
    const stickerInset = cubieSize / 2 + stickerThickness / 2 - 0.001
    const spacing = totalSize / N

    const bodyGeo = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieRadius)
    const stickerGeo = new RoundedBoxGeometry(stickerSize, stickerSize, stickerThickness, 1, stickerRadius)
    this.disposeBag.push(bodyGeo, stickerGeo)

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141822, roughness: 0.55, metalness: 0.05 })
    this.disposeBag.push(bodyMat)
    const stickerMats: Record<FaceCol, THREE.MeshStandardMaterial> = {} as Record<FaceCol, THREE.MeshStandardMaterial>
    for (const k of Object.keys(FACE_HEX) as FaceCol[]) {
      const c = new THREE.Color(FACE_HEX[k])
      stickerMats[k] = new THREE.MeshStandardMaterial({
        color: c, roughness: 0.32, metalness: 0,
        emissive: c.clone().multiplyScalar(0.08),
      })
      this.disposeBag.push(stickerMats[k])
    }

    for (const cubie of this.state.cubies) {
      const stickers = solvedStickersOfPosition(N, cubie.i)
      const group = new THREE.Group()
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      group.add(body)

      // 每个外露方向放贴纸
      for (const [dirKey, color] of stickers) {
        const [dx, dy, dz] = dirKey.split(',').map(Number) as [number, number, number]
        const sticker = new THREE.Mesh(stickerGeo, stickerMats[color])
        sticker.position.set(dx * stickerInset, dy * stickerInset, dz * stickerInset)
        sticker.lookAt(dx * 10, dy * 10, dz * 10)
        group.add(sticker)
      }

      // 初始位置 (索引 → 世界坐标)
      const wx = (cubie.i[0] - (N - 1) / 2) * spacing
      const wy = (cubie.i[1] - (N - 1) / 2) * spacing
      const wz = (cubie.i[2] - (N - 1) / 2) * spacing
      group.position.set(wx, wy, wz)

      this.root!.add(group)
      this.cubieMeshes[cubie.id] = group
      this.cubieMetas[cubie.id] = {
        id: cubie.id,
        initialIdx: cubie.i,
        group,
      }
    }
  }

  private fitCameraForSize(): void {
    // 大魔方 (N>=5) 相机拉远一点
    if (!this.stage) return
    const N = this.N
    const baseDist = Math.sqrt(5.2 ** 2 + 4.0 ** 2 + 6.2 ** 2) // = 默认距离 ~ 8.7
    const factor = Math.max(1, 1 + (N - 3) * 0.12)
    const targetDist = baseDist * factor
    const dir = this.stage.camera.position.clone().normalize()
    this.stage.camera.position.copy(dir.multiplyScalar(targetDist))
    this.stage.camera.lookAt(0, 0, 0)
  }

  // ---- 状态同步 ----

  syncToState(state: NxNState): void {
    this.state = state
    const N = this.N
    const spacing = 3 / N
    for (const c of state.cubies) {
      const mesh = this.cubieMeshes[c.id]
      if (!mesh) continue
      const wx = (c.i[0] - (N - 1) / 2) * spacing
      const wy = (c.i[1] - (N - 1) / 2) * spacing
      const wz = (c.i[2] - (N - 1) / 2) * spacing
      mesh.position.set(wx, wy, wz)
      const m = c.orientation
      const mat = new THREE.Matrix4().set(
        m[0], m[1], m[2], 0,
        m[3], m[4], m[5], 0,
        m[6], m[7], m[8], 0,
        0, 0, 0, 1,
      )
      mesh.quaternion.setFromRotationMatrix(mat)
    }
  }

  // ---- 动画 ----

  enqueueMove(move: NxNMove, durationMs = 220): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ move, durationMs, resolve })
    })
  }

  clearQueue(): void {
    for (const p of this.queue) p.resolve()
    this.queue = []
    if (this.active) {
      this.finishActive()
    }
  }

  isBusy(): boolean {
    return this.active !== null || this.queue.length > 0
  }

  private tick(dtSec: number): void {
    if (!this.active && this.queue.length > 0) this.startNext()
    if (!this.active) return
    const a = this.active
    a.elapsed += dtSec * 1000
    const t = Math.min(1, a.elapsed / a.duration)
    const eased = EASE(t)
    this.rotor!.quaternion.setFromAxisAngle(a.axis, a.angle * eased)
    if (t >= 1) this.finishActive()
  }

  private startNext(): void {
    const N = this.N
    const next = this.queue.shift()!
    const sel = layerSelector(N, next.move)
    const ids: number[] = []
    for (const c of this.state.cubies) if (sel(c.i)) ids.push(c.id)

    const axisVec = axisVectorFor(next.move.face)
    const angle = signedAngleFor(next.move)

    this.rotor!.quaternion.identity()
    for (const id of ids) this.rotor!.attach(this.cubieMeshes[id]!)

    this.active = {
      move: next.move,
      axis: axisVec,
      angle,
      elapsed: 0,
      duration: next.durationMs,
      rotatingIds: ids,
      resolve: next.resolve,
    }
  }

  private finishActive(): void {
    if (!this.active) return
    const a = this.active
    for (const id of a.rotatingIds) this.root!.attach(this.cubieMeshes[id]!)
    this.rotor!.quaternion.identity()

    this.state = applyMove(this.state, a.move)
    // 强制同步以消除浮点漂移
    this.syncToState(this.state)

    this.onMoveApplied?.(a.move)
    a.resolve()
    this.active = null
  }
}

function axisVectorFor(face: NxNFaceId): THREE.Vector3 {
  // M 跟 L 同 X 轴, E 跟 D 同 Y 轴, S 跟 F 同 Z 轴
  if (face === 'R' || face === 'L' || face === 'M' || face === 'x') return new THREE.Vector3(1, 0, 0)
  if (face === 'U' || face === 'D' || face === 'E' || face === 'y') return new THREE.Vector3(0, 1, 0)
  return new THREE.Vector3(0, 0, 1) // F, B, S, z
}

/**
 * 跟 3x3 相同的约定: R/U/F = CW from outside = 数学 -90° 绕正轴
 *                 L/D/B = +90° 绕正轴
 * x/y/z = 跟 R/U/F 同
 */
function signedAngleFor(move: NxNMove): number {
  const _90 = Math.PI / 2
  const dir = move.amount === 3 ? -1 : 1
  const sign = (() => {
    switch (move.face) {
      case 'R': case 'x': return -1
      case 'L':           return +1
      case 'U': case 'y': return -1
      case 'D':           return +1
      case 'F': case 'z': return -1
      case 'B':           return +1
      case 'M':           return +1  // M 跟 L 同向
      case 'E':           return +1  // E 跟 D 同向
      case 'S':           return -1  // S 跟 F 同向
    }
  })()
  const base = sign * _90 * dir
  return move.amount === 2 ? base * 2 : base
}

/** Helper: rotationOf 仅引用以消除 import (实际未直接使用) */
void rotationOf
