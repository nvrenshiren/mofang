import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { COLORS, type FaceColorId } from '../domain/cube/colors'
import type { Vec3 } from '../domain/math/Vec3'

/**
 * 单 cubie 的 mesh —— 倒角主体 + 凸起贴纸
 * 主体共享 RoundedBoxGeometry, 贴纸共享 6 种 WCA 颜色 material, GPU 状态切换最少
 */

const CUBIE_SIZE = 0.96
const CUBIE_RADIUS = 0.06
const STICKER_SIZE = 0.82
const STICKER_THICKNESS = 0.012
const STICKER_RADIUS = 0.10
const STICKER_INSET = CUBIE_SIZE / 2 + STICKER_THICKNESS / 2 - 0.001

// 共享几何 (所有 cubie 复用,显著降低 GPU 状态切换)
const bodyGeo = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 3, CUBIE_RADIUS)
const stickerGeo = new RoundedBoxGeometry(
  STICKER_SIZE, STICKER_SIZE, STICKER_THICKNESS, 2, STICKER_RADIUS,
)

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0x141822,
  roughness: 0.55,
  metalness: 0.05,
})

// 按 WCA 颜色预制 6 种贴纸材质
const stickerMats: Record<FaceColorId, THREE.MeshStandardMaterial> = (() => {
  const out = {} as Record<FaceColorId, THREE.MeshStandardMaterial>
  ;(Object.keys(COLORS) as FaceColorId[]).forEach((k) => {
    out[k] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS[k]),
      roughness: 0.32,
      metalness: 0.0,
      emissive: new THREE.Color(COLORS[k]).multiplyScalar(0.08),
    })
  })
  return out
})()

/**
 * 创建一个 cubie 的 Group
 * solvedPos: cubie 在 solved 态的位置,用于决定哪几面有贴纸 + 是什么颜色
 */
export function createCubie(solvedPos: Vec3): THREE.Group {
  const group = new THREE.Group()

  const body = new THREE.Mesh(bodyGeo, bodyMat)
  group.add(body)

  // 按 solved 位置,决定哪些方向有贴纸
  // +X→R(红) -X→L(橙) +Y→U(白) -Y→D(黄) +Z→F(绿) -Z→B(蓝)
  const stickerMap: { dir: Vec3; color: FaceColorId }[] = []
  if (solvedPos[0] === +1) stickerMap.push({ dir: [+1, 0, 0], color: 'R' })
  if (solvedPos[0] === -1) stickerMap.push({ dir: [-1, 0, 0], color: 'L' })
  if (solvedPos[1] === +1) stickerMap.push({ dir: [0, +1, 0], color: 'U' })
  if (solvedPos[1] === -1) stickerMap.push({ dir: [0, -1, 0], color: 'D' })
  if (solvedPos[2] === +1) stickerMap.push({ dir: [0, 0, +1], color: 'F' })
  if (solvedPos[2] === -1) stickerMap.push({ dir: [0, 0, -1], color: 'B' })

  for (const { dir, color } of stickerMap) {
    const sticker = new THREE.Mesh(stickerGeo, stickerMats[color])
    sticker.position.set(
      dir[0] * STICKER_INSET,
      dir[1] * STICKER_INSET,
      dir[2] * STICKER_INSET,
    )
    // 让贴纸的 "厚度" 朝外,需要让 Z 轴对齐 dir
    sticker.lookAt(dir[0] * 10, dir[1] * 10, dir[2] * 10)
    group.add(sticker)
  }

  group.position.set(solvedPos[0], solvedPos[1], solvedPos[2])
  return group
}
