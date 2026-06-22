import * as THREE from 'three'
import type { Stage } from '../render/Stage'

/**
 * 反向相机画中画 (PiP) —— 显示 B / L / D 三面
 *
 * 主相机位于 (+X, +Y, +Z) 卦限,看到 U / F / R 三面。
 * 这个反向相机位于 (-X, -Y, -Z) 卦限的对称位置,正好补足看不见的另外三面。
 *
 * 实现方式: 整个玻璃框就是 WebGL viewport, 标签用绝对定位浮在上面。
 * 这样 viewport rect = root.getBoundingClientRect(), 没有内层 flex 算高的问题。
 */

const BACK_CAM_POS = new THREE.Vector3(-5.2, -2.8, -6.2)
const PIP_W = 180
const PIP_H = 140

export interface MiniBackView {
  readonly root: HTMLElement
  setVisible(visible: boolean): void
}

export function createMiniBackView(stage: Stage, parent: HTMLElement): MiniBackView {
  const backCam = new THREE.PerspectiveCamera(35, PIP_W / PIP_H, 0.1, 50)
  backCam.position.copy(BACK_CAM_POS)
  backCam.lookAt(0, 0, 0)

  // 整个 root 就是 PiP 的可视区,WebGL 直接渲染到这片区域
  // 关键: DON'T 用 .glass —— glass 的半透明背景 + backdrop-blur 会盖在 canvas 上,
  // 把后面的 WebGL 渲染模糊化。这里只保留圆角边框,背景全透明,让 WebGL 直接显示。
  const root = document.createElement('div')
  root.className = 'absolute top-3 right-3 overflow-hidden pointer-events-none'
  root.style.width = `${PIP_W}px`
  root.style.height = `${PIP_H}px`
  root.style.borderRadius = '14px'
  root.style.border = '1px solid rgba(255, 255, 255, 0.10)'
  root.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(76, 211, 224, 0.05)'
  root.innerHTML = `
    <div class="absolute top-1 left-2 z-10 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-3)] mix-blend-screen">反向视角</div>
    <div class="absolute top-1 right-2 z-10 text-[9px] text-[color:var(--color-ink-3)] mix-blend-screen">B · L · D</div>
  `
  parent.appendChild(root)

  let visible = true

  // 每帧根据 DOM 位置算出 WebGL viewport rect (CSS pixel, 原点左下)
  stage.addOverlay(backCam, () => {
    if (!visible) return null
    const canvas = stage.renderer.domElement
    const cRect = canvas.getBoundingClientRect()
    const vRect = root.getBoundingClientRect()
    if (vRect.width <= 1 || vRect.height <= 1) return null
    // CSS 是 top-left 原点,WebGL viewport 是 bottom-left 原点
    const x = vRect.left - cRect.left
    const y = cRect.bottom - vRect.bottom
    return { x, y, w: vRect.width, h: vRect.height }
  })

  function setVisible(v: boolean): void {
    visible = v
    root.style.display = v ? '' : 'none'
  }

  return { root, setVisible }
}
