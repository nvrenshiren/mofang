import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Vite 7 配置 —— 默认 target 是 baseline-widely-available,符合"现代浏览器"定位
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
})
