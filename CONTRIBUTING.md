# 贡献指南

感谢有兴趣为 Cubelab 做贡献!本文档说明如何提 issue、提 PR、本地开发与测试约定。

[English version below](#contributing-english)

---

## 🔧 开发环境

| 工具 | 版本 |
|---|---|
| Node.js | ≥ 20.19 |
| 包管理 | npm (项目使用 package-lock.json 锁版本) |
| 编辑器 | 任何支持 TypeScript 的 (推荐 VS Code + ESLint) |

```bash
git clone https://github.com/nvrenshiren/mofang.git
cd mofang
npm install
npm run dev        # 启动开发服务器
```

## 📦 提交流程

1. **Fork 仓库** 到你的账号
2. **创建特性分支**:`git checkout -b feat/your-feature` 或 `fix/bug-name`
3. **写代码 + 测试**:任何新功能需要对应的单元测试在 `src/**/*.test.ts`
4. **跑全套验证**:
   ```bash
   npm run typecheck     # 严格类型检查必须通过
   npm test              # 280+ 单元测试全过
   npm run test:e2e      # 12 个端到端测试全过 (改了 UI 必跑)
   npm run build         # 生产构建必须成功
   ```
5. **commit message** 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 风格,常用前缀:
   - `feat(scope):` 新功能
   - `fix(scope):` Bug 修复
   - `docs:` 文档
   - `test:` 测试
   - `refactor:` 重构 (不改行为)
   - `chore:` 杂项
   - `ci:` CI 配置
6. **推送并发起 PR**,描述清楚改了什么、为什么、怎么测的

## 🧪 测试约定

- **domain 层**:任何逻辑变更必须有单元测试。新谜题需通过 `puzzle.contract.test.ts` 的 11 项合同测试
- **render 层**:涉及动画轴/角度的改动需补 `NxNCubeRenderer.test.ts` 风格的回归测试
- **UI 层**:大型 UI 变更建议补 e2e

## 🧩 新增谜题清单

1. 在 `src/domain/puzzles/<name>/` 下实现 `Puzzle<S, M>` 接口
2. 在 `src/render/puzzles/` 实现对应 `PuzzleRenderer<S, M>`
3. `src/domain/puzzles/registry.ts` 注册 entry
4. `src/domain/puzzles/Puzzle.ts` 的 `PuzzleId` 加入新 id
5. 单元测试通过 Puzzle 合同测试自动覆盖(11 项)
6. `e2e/puzzles.spec.ts` 把新 puzzle id 加进 PUZZLES 列表

## 🐛 报 Bug

请用 [Issue 模板](.github/ISSUE_TEMPLATE/bug_report.yml) 提交,附上:
- 复现步骤
- 期望/实际行为
- 浏览器 + OS
- 控制台错误(如有)
- 截图或录屏(强烈建议,可视化 bug 必备)

## ✨ 提建议 / 新功能

用 [Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.yml),说明:
- 使用场景
- 现有替代方案的不足
- (可选) 实现思路

## 📐 代码风格

- TypeScript strict 模式,**禁止** `any`
- 函数式优先(domain 层全部 pure functions / immutable state)
- 中文注释 OK,但**类型/标识符必须英文**
- 不要无意义重构;改动尽量小步、聚焦单一目的
- 不必要的注释别加(代码本身要可读)

## 📜 行为准则

请保持友善与专业。批评观点不要批评人。详见 [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)。

---

# Contributing (English)

Thanks for considering contributing to Cubelab! Quick reference:

## Dev Setup

```bash
git clone https://github.com/nvrenshiren/mofang.git
cd mofang
npm install            # Node ≥ 20.19 required
npm run dev
```

## PR Flow

1. Fork → branch (`feat/...` or `fix/...`)
2. Code + matching tests in `src/**/*.test.ts`
3. Run all checks:
   ```bash
   npm run typecheck && npm test && npm run test:e2e && npm run build
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`)
5. Push and open PR with a clear description

## Adding a New Puzzle

See the checklist in `README.en.md` § Adding a New Puzzle. In short:
1. Implement `Puzzle<S, M>` under `src/domain/puzzles/<name>/`
2. Implement `PuzzleRenderer<S, M>` under `src/render/puzzles/`
3. Register in `registry.ts`, add id to `PuzzleId`
4. Contract tests cover the rest automatically

## Code Style

- TypeScript strict, **no `any`**
- Functional / immutable in `domain/` layer
- Chinese comments OK, but **types & identifiers must be English**
- Small focused commits; don't refactor unrelated code

By contributing you agree to license your work under MIT.
