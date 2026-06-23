import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',          // 装配入口, 全是 wiring, 集成测试覆盖
        'src/types.ts',         // 纯类型导出
        'src/**/types.ts',
      ],
      // 阈值跟当前实际水平匹配, 防回退. domain/ 高 (90%+), UI/render/ 多为 0%
      // 提升整体覆盖率需要给 ui/* / render/* 加单元测试 (见 code-review #10)
      thresholds: {
        lines: 50,
        functions: 70,
        branches: 65,
        statements: 50,
      },
    },
  },
})
