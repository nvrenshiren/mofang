import * as THREE from 'three'
import type { Stage } from './Stage'

/**
 * 自由模式下的相机拖拽 —— 用最少的代码实现 OrbitControls 的核心功能
 * (不引入 jsm/controls/OrbitControls 减少 bundle)
 *
 * 鼠标左键拖拽: 围绕 origin 旋转相机
 * 滚轮: 缩放
 *
 * 训练 / 挑战模式下不启用
 */

const ORIG_POS = new THREE.Vector3(5.2, 4.0, 6.2)

export class FreeOrbit {
  private enabled = false
  private spherical = new THREE.Spherical()
  private origin = new THREE.Vector3(0, 0, 0)
  private dragging = false
  private last = { x: 0, y: 0 }
  private readonly stage: Stage
  private readonly target: HTMLElement

  constructor(stage: Stage) {
    this.stage = stage
    this.target = stage.renderer.domElement

    this.spherical.setFromVector3(stage.camera.position.clone().sub(this.origin))

    this.target.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointermove', this.onMove)
    this.target.addEventListener('wheel', this.onWheel, { passive: false })
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.snapToStandard()
  }

  snapToStandard(): void {
    // 平滑回归标准姿态 (简单 lerp 一帧到位即可,因为旋转量不会太大)
    this.stage.camera.position.copy(ORIG_POS)
    this.stage.camera.lookAt(this.origin)
    this.spherical.setFromVector3(ORIG_POS.clone().sub(this.origin))
  }

  private onDown = (ev: PointerEvent): void => {
    if (!this.enabled) return
    if (ev.button !== 0) return
    this.dragging = true
    this.last.x = ev.clientX
    this.last.y = ev.clientY
    this.target.setPointerCapture(ev.pointerId)
  }

  private onUp = (): void => {
    this.dragging = false
  }

  private onMove = (ev: PointerEvent): void => {
    if (!this.dragging || !this.enabled) return
    const dx = ev.clientX - this.last.x
    const dy = ev.clientY - this.last.y
    this.last.x = ev.clientX
    this.last.y = ev.clientY
    this.spherical.theta -= dx * 0.008
    this.spherical.phi -= dy * 0.008
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi))
    this.updateCamera()
  }

  private onWheel = (ev: WheelEvent): void => {
    if (!this.enabled) return
    ev.preventDefault()
    this.spherical.radius *= 1 + ev.deltaY * 0.0008
    this.spherical.radius = Math.max(4, Math.min(12, this.spherical.radius))
    this.updateCamera()
  }

  private updateCamera(): void {
    const p = new THREE.Vector3().setFromSpherical(this.spherical).add(this.origin)
    this.stage.camera.position.copy(p)
    this.stage.camera.lookAt(this.origin)
  }
}
