import * as THREE from 'three'
import { applyMove, solved, type CubeState } from '../domain/cube/Cube'
import { FACE_DEFS, type Move } from '../domain/cube/moves'
import { createCubie } from './CubieMesh'
import type { Stage } from './Stage'

/**
 * 把 domain 层的 CubeState 映射到 Three.js 视觉
 * 负责:
 *   - 创建/管理 26 个 cubie mesh
 *   - 按 move 播放层旋转动画 (slerp + ease)
 *   - 队列化连续的 move 请求 (公式批量执行时一个接一个)
 *
 * 关键技巧:层旋转动画用一个临时 rotor Group。
 * 动画过程中: 把目标 9 个 cubie 临时 attach 到 rotor,旋转 rotor。
 * 动画结束: 把 cubie attach 回 cubeRoot,保留世界变换,然后
 * 把 cube state 应用到 domain 层 (确保下一次选层用最新 state)。
 */

interface PendingMove {
  move: Move
  durationMs: number
  resolve: () => void
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic

export class AnimatedCube {
  state: CubeState = solved()
  readonly cubieMeshes: THREE.Group[] = []  // index = cubie.id
  private readonly rotor: THREE.Group
  private readonly stage: Stage

  private queue: PendingMove[] = []
  private active: {
    move: Move
    axis: THREE.Vector3
    angle: number
    elapsed: number
    duration: number
    rotatingIds: number[]
    resolve: () => void
  } | null = null

  /** 监听器: 每次一个 move 真正提交到 domain state 时触发 (用于日志/历史) */
  onMoveApplied?: (move: Move) => void

  constructor(stage: Stage) {
    this.stage = stage
    this.rotor = new THREE.Group()
    stage.cubeRoot.add(this.rotor)

    for (const cubie of this.state.cubies) {
      const mesh = createCubie(cubie.position)
      this.cubieMeshes.push(mesh)
      stage.cubeRoot.add(mesh)
    }

    stage.addUpdater((dt) => this.tick(dt))
  }

  /** 加入一个 move 到队列。返回 Promise 在该 move 动画完成时 resolve */
  enqueue(move: Move, durationMs = 220): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ move, durationMs, resolve })
    })
  }

  /** 取消所有未播放的 move (用于"打乱中点击重置") */
  clearQueue(): void {
    for (const p of this.queue) p.resolve()
    this.queue = []
  }

  get isBusy(): boolean {
    return this.active !== null || this.queue.length > 0
  }

  /** 立即重置:不动画,直接回到 solved */
  resetInstant(): void {
    this.clearQueue()
    if (this.active) {
      // 立刻结束当前动画
      this.finishActive()
    }
    this.state = solved()
    this.syncMeshesToState()
  }

  /** 立即应用一串 move,无动画 (用于"恢复保存状态") */
  applyInstant(moves: readonly Move[]): void {
    for (const m of moves) this.state = applyMove(this.state, m)
    this.syncMeshesToState()
  }

  private tick(dtSec: number): void {
    if (!this.active && this.queue.length > 0) this.startNext()
    if (!this.active) return

    const a = this.active
    a.elapsed += dtSec * 1000
    const t = Math.min(1, a.elapsed / a.duration)
    const eased = EASE(t)
    this.rotor.quaternion.setFromAxisAngle(a.axis, a.angle * eased)

    if (t >= 1) this.finishActive()
  }

  private startNext(): void {
    const next = this.queue.shift()!
    const def = FACE_DEFS[next.move.face]
    const ids: number[] = []
    for (const c of this.state.cubies) if (def.selector(c.position)) ids.push(c.id)

    // 旋转轴对应的 Three.js 向量
    const axisVec =
      def.axis === 'x' ? new THREE.Vector3(1, 0, 0)
      : def.axis === 'y' ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1)

    // 我们的 R/U/F 矩阵定义是"CW from outside" = 数学 -90° 绕对应正轴
    // 但 L/D/B 是 +90° 绕正轴 (因为外侧在负方向)
    // 整体一致地从矩阵反推角度比较繁琐,我们直接按 face 决定符号:
    const angle = signedAngleFor(next.move) * (next.move.amount === 2 ? 2 : 1)

    // 把目标 cubies 临时 attach 到 rotor (保留世界变换)
    this.rotor.quaternion.identity()
    for (const id of ids) this.rotor.attach(this.cubieMeshes[id]!)

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

    // 把 cubie 从 rotor 释放回 cubeRoot (保留世界变换)
    for (const id of a.rotatingIds) this.stage.cubeRoot.attach(this.cubieMeshes[id]!)
    this.rotor.quaternion.identity()

    // 更新 domain state
    this.state = applyMove(this.state, a.move)

    // 强制同步 mesh transform 到 domain 状态 (消除浮点累积漂移)
    for (const id of a.rotatingIds) this.snapMeshToCubie(id)

    this.onMoveApplied?.(a.move)
    a.resolve()
    this.active = null
  }

  /** 把所有 mesh 强制对齐到当前 state */
  syncMeshesToState(): void {
    for (const c of this.state.cubies) this.snapMeshToCubie(c.id)
  }

  private snapMeshToCubie(id: number): void {
    const cubie = this.state.cubies[id]!
    const mesh = this.cubieMeshes[id]!
    mesh.position.set(cubie.position[0], cubie.position[1], cubie.position[2])
    // orientation Mat3 → THREE.Matrix4 → quaternion
    const m = cubie.orientation
    const mat = new THREE.Matrix4().set(
      m[0], m[1], m[2], 0,
      m[3], m[4], m[5], 0,
      m[6], m[7], m[8], 0,
      0,    0,    0,    1,
    )
    mesh.quaternion.setFromRotationMatrix(mat)
  }
}

/**
 * 按 WCA 习惯返回该 face 单位转动 (90° CW from outside) 的"渲染层符号化角度"
 * 注意 Three.js 的 setFromAxisAngle 使用右手法则:
 *   绕 +X 轴 +π/2 = +Y → +Z (右手大拇指指 +X,四指方向就是 Y→Z)
 *
 * R 是绕 +X 轴 CW from outside = -π/2 (因为从 +X 看回原点,正旋转是 -π/2)
 * U 是绕 +Y 轴 CW from outside = -π/2
 * F 是绕 +Z 轴 CW from outside = -π/2
 * L/D/B 反之 = +π/2
 * 中层 M/E/S 跟 L/D/F 同向 (M 跟 L, E 跟 D, S 跟 F)
 * 整体旋转 x/y/z 跟 R/U/F
 */
function signedAngleFor(move: Move): number {
  const _90 = Math.PI / 2
  const dir = move.amount === 3 ? -1 : 1
  switch (move.face) {
    case 'R': case 'x': case 'Rw': return -_90 * dir
    case 'L': case 'M': case 'Lw': return  _90 * dir
    case 'U': case 'y': case 'Uw': return -_90 * dir
    case 'D': case 'E': case 'Dw': return  _90 * dir
    case 'F': case 'z': case 'S': case 'Fw': return -_90 * dir
    case 'B': case 'Bw': return  _90 * dir
  }
}

