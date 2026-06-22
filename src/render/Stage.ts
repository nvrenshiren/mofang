import * as THREE from 'three'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Overlay {
  readonly camera: THREE.PerspectiveCamera
  readonly getRect: () => Rect | null
}

/**
 * Three.js 舞台 —— 场景/相机/灯光/渲染循环
 *
 * 设计理念: 暗室聚光灯
 *   - 透明 clear,让 CSS 渐变背景透过来
 *   - 主光暖白 (右上 45°),补光冷青 (左下),营造仪器质感
 *   - 透视相机 fov 35° (不夸张),斜俯视让 U/F/R 三面同框
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly cubeRoot: THREE.Group

  private readonly container: HTMLElement
  private readonly resizeObserver: ResizeObserver
  private animationHandle = 0
  private readonly updaters: ((dtSec: number) => void)[] = []
  private readonly overlays: Overlay[] = []
  private lastTime = 0

  constructor(container: HTMLElement) {
    this.container = container

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,           // 让 CSS 背景透过
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.appendChild(this.renderer.domElement)

    // ---- 场景 ----
    this.scene = new THREE.Scene()

    // ---- 相机 ----
    // 斜俯视,U/F/R 三面同框
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
    this.camera.position.set(5.2, 4.0, 6.2)
    this.camera.lookAt(0, 0, 0)

    // ---- 灯光 ----
    this.setupLights()

    // ---- 地面反射(很淡的椭圆 glow,营造"悬浮"感) ----
    this.setupGround()

    // ---- cube root ----
    this.cubeRoot = new THREE.Group()
    this.scene.add(this.cubeRoot)

    // ---- 自适应 ----
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    // ---- 启动渲染循环 ----
    this.start()
  }

  private setupLights(): void {
    // 环境光(基础亮度)
    const ambient = new THREE.AmbientLight(0xb8c4e0, 0.45)
    this.scene.add(ambient)

    // 主光:右上 45°,暖白
    const key = new THREE.DirectionalLight(0xfff0d8, 1.4)
    key.position.set(8, 12, 6)
    this.scene.add(key)

    // 补光:左下,冷青
    const fill = new THREE.DirectionalLight(0x6db5d6, 0.55)
    fill.position.set(-6, -2, -4)
    this.scene.add(fill)

    // 后置缘光(锐化轮廓)
    const rim = new THREE.DirectionalLight(0xa0e8ff, 0.35)
    rim.position.set(-3, 5, -6)
    this.scene.add(rim)
  }

  private setupGround(): void {
    // 渐变椭圆 —— 用 canvas 纹理生成
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(76, 211, 224, 0.18)')
    gradient.addColorStop(0.4, 'rgba(76, 211, 224, 0.06)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    const planeGeo = new THREE.PlaneGeometry(8, 8)
    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
    const ground = new THREE.Mesh(planeGeo, planeMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -2.2
    this.scene.add(ground)
  }

  /**
   * 注册一个覆盖视口 —— 用于画中画 (PiP) 等
   * getRect() 返回视口在 canvas 内的位置 (CSS 像素, 原点左下),返回 null 跳过
   */
  addOverlay(camera: THREE.PerspectiveCamera, getRect: () => Rect | null): () => void {
    const o: Overlay = { camera, getRect }
    this.overlays.push(o)
    return () => {
      const i = this.overlays.indexOf(o)
      if (i >= 0) this.overlays.splice(i, 1)
    }
  }

  /** 注册每帧更新回调,dtSec 是与上一帧的间隔(秒) */
  addUpdater(fn: (dtSec: number) => void): () => void {
    this.updaters.push(fn)
    return () => {
      const i = this.updaters.indexOf(fn)
      if (i >= 0) this.updaters.splice(i, 1)
    }
  }

  private resize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private start(): void {
    const loop = (t: number): void => {
      const dt = this.lastTime === 0 ? 0 : (t - this.lastTime) / 1000
      this.lastTime = t
      for (const u of this.updaters) u(dt)

      // 主视口
      const w = this.container.clientWidth
      const h = this.container.clientHeight
      this.renderer.setScissorTest(false)
      this.renderer.setViewport(0, 0, w, h)
      this.renderer.render(this.scene, this.camera)

      // 覆盖视口 (画中画)
      for (const ov of this.overlays) {
        const r = ov.getRect()
        if (!r || r.w <= 0 || r.h <= 0) continue
        this.renderer.setScissorTest(true)
        this.renderer.setViewport(r.x, r.y, r.w, r.h)
        this.renderer.setScissor(r.x, r.y, r.w, r.h)
        this.renderer.clear()
        // 同步 aspect (overlay rect 通常与主视口比例不同)
        const aspect = r.w / r.h
        if (Math.abs(ov.camera.aspect - aspect) > 0.001) {
          ov.camera.aspect = aspect
          ov.camera.updateProjectionMatrix()
        }
        this.renderer.render(this.scene, ov.camera)
      }
      this.renderer.setScissorTest(false)

      this.animationHandle = requestAnimationFrame(loop)
    }
    this.animationHandle = requestAnimationFrame(loop)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationHandle)
    this.resizeObserver.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
