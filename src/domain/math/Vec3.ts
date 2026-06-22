/**
 * 整数三维向量 —— 用于 cubie 位置 ({-1,0,1}^3) 和方向轴
 * 三元组形式,值语义,不可变
 */
export type Vec3 = readonly [number, number, number]

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z]
export const v3eq = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
export const v3key = (a: Vec3): string => `${a[0]},${a[1]},${a[2]}`
