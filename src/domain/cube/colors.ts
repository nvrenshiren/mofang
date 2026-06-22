/**
 * WCA 标准配色 (官方西配色, 2026 版)
 * 与 app.css 中 --color-cube-* CSS 变量保持一致
 */
export const COLORS = {
  U: '#f5f5f0', // 白 - Up
  D: '#f5c518', // 黄 - Down
  F: '#1a9f3a', // 绿 - Front
  B: '#1464d6', // 蓝 - Back
  L: '#f08000', // 橙 - Left
  R: '#c41e3a', // 红 - Right
} as const

export type FaceColorId = keyof typeof COLORS
