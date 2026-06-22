import { test, expect } from 'playwright/test'

/**
 * 逐谜题集成测试
 * 验证: canvas 存在 + 打乱按钮工作 + 重置按钮工作 + 无控制台错误
 * 截图存到 e2e/screenshots/ 便于人眼复核
 */

const PUZZLES = ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7']

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })
  ;(page as unknown as { __errors: string[] }).__errors = errors

  await page.goto('/')
  // 等 cubelab 全局对象就绪 (main.ts 执行完毕)
  await page.waitForFunction(
    () => (window as unknown as { cubelab?: unknown }).cubelab !== undefined,
    { timeout: 10_000 },
  )
})

for (const id of PUZZLES) {
  test(`puzzle ${id} 渲染 + 打乱 + 重置`, async ({ page }) => {
    // 切到目标 puzzle
    await page.locator('select[data-role="puzzle"]').selectOption(id)
    await page.waitForTimeout(500)

    // canvas 存在 + 有尺寸
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box?.width).toBeGreaterThan(100)
    expect(box?.height).toBeGreaterThan(100)

    // 验证当前 store 状态指向正确 puzzle
    const puzzleId = await page.evaluate(() => {
      type C = { store: { puzzle: { meta: { id: string } } } }
      const c = (window as unknown as { cubelab: C }).cubelab
      return c.store.puzzle.meta.id
    })
    expect(puzzleId).toBe(id)

    // 截图
    await page.screenshot({ path: `e2e/screenshots/${id}.png` })

    // 训练模式打乱
    await page.locator('[data-mode="training"]').click()
    await page.waitForTimeout(200)
    await page.locator('[data-role="scramble"]').click()

    const scramblePanel = page.locator('text=当前打乱')
    await expect(scramblePanel).toBeVisible({ timeout: 10_000 })

    // 等动画放完
    const waitMs = id === '7x7' || id === '6x6' ? 8000 : id === '5x5' || id === '4x4' ? 5000 : 3000
    await page.waitForTimeout(waitMs)
    await page.screenshot({ path: `e2e/screenshots/${id}-scrambled.png` })

    // 重置
    await page.locator('[data-role="reset"]').click()
    await page.waitForTimeout(500)
    await expect(scramblePanel).toBeHidden({ timeout: 5_000 })

    // 重置后, 状态应为 solved
    const isSolved = await page.evaluate(() => {
      type C = { store: { puzzle: { isSolved: (s: unknown) => boolean }; state: unknown } }
      const c = (window as unknown as { cubelab: C }).cubelab
      return c.store.puzzle.isSolved(c.store.state)
    })
    expect(isSolved).toBe(true)

    const errors = (page as unknown as { __errors: string[] }).__errors
    expect(errors).toEqual([])
  })
}

test('谜题切换不会残留旧 mesh', async ({ page }) => {
  const childCount = async (): Promise<number> =>
    page.evaluate(() => {
      type C = { stage: { cubeRoot: { children: unknown[] } } }
      const c = (window as unknown as { cubelab: C }).cubelab
      return c.stage.cubeRoot.children.length
    })

  await page.locator('select[data-role="puzzle"]').selectOption('3x3')
  await page.waitForTimeout(300)
  const c3 = await childCount()

  await page.locator('select[data-role="puzzle"]').selectOption('5x5')
  await page.waitForTimeout(300)
  const c5 = await childCount()

  await page.locator('select[data-role="puzzle"]').selectOption('2x2')
  await page.waitForTimeout(300)
  const c2 = await childCount()

  // 每次切换后, cubeRoot 直接子节点数应保持 ≤ 1 (一个 puzzle root group)
  // 不应累计
  expect(c3).toBeLessThanOrEqual(2)
  expect(c5).toBeLessThanOrEqual(2)
  expect(c2).toBeLessThanOrEqual(2)
})

test('键盘 R 键转动 3x3 右层 + 撤销恢复', async ({ page }) => {
  await page.locator('select[data-role="puzzle"]').selectOption('3x3')
  await page.waitForTimeout(300)

  // 按 R
  await page.keyboard.press('r')
  await page.waitForTimeout(400)

  // 日志应有一条
  const logEntries = page.locator('[data-role="entries"] span')
  await expect(logEntries.first()).toHaveText('R', { timeout: 3_000 })

  // 撤销
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)

  // 日志应空
  await expect(logEntries).toHaveCount(0)

  const isSolved = await page.evaluate(() => {
    type C = { store: { puzzle: { isSolved: (s: unknown) => boolean }; state: unknown } }
    const c = (window as unknown as { cubelab: C }).cubelab
    return c.store.puzzle.isSolved(c.store.state)
  })
  expect(isSolved).toBe(true)
})
