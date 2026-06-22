# 魔方练习 Web 页 设计规范

**日期**: 2026-06-14
**状态**: 待审阅
**目标平台**: 现代浏览器 (Chrome / Edge / Firefox / Safari)
**技术栈**: Three.js (最新版 r170+) + TypeScript + Vite

---

## 1. 目标与范围

### 1.1 目标
开发一个基于浏览器的魔方练习工具,支持:
- 3D 渲染一个标准 3×3 魔方
- 通过鼠标拖拽旋转魔方的任意层,操作被记录为公式日志
- 通过输入公式字符串 (含分组与重复) 操作魔方
- 学习 WCA 标准记谱法 (R/U/F/L/D/B + 12 动 + 双层 + 中间层)

### 1.2 范围
**包含**:
- 3D 魔方渲染 (3×3×3 共 27 个 cubie,中心隐藏)
- 鼠标拖拽手势识别 (基于 Raycaster 拾取)
- 公式解析器 (逗号分隔 + 小括号分组 + 重复)
- 公式执行 (含动画、可取消)
- 操作日志 (实时公式串、复制、清空、撤销/重做)
- 工具栏 (重置、打乱、视角重置)
- 键盘快捷键 (R/U/F/L/D/B + 反 + Ctrl+Z)
- 撤销 / 重做

**不包含 (后续可扩展)**:
- 计步计时器
- 求解教学 (CFOP 步骤演示)
- 打乱公式的种子化复现
- 用户账号 / 进度保存
- 移动端深度优化 (基础触屏支持已包含)

---

## 2. 架构

### 2.1 技术选型
- **构建工具**: Vite 5+ (TypeScript 模板)
- **渲染库**: Three.js 最新版 (r170+)
- **语言**: TypeScript 5+ (strict 模式)
- **辅助控件**: `three/examples/jsm/controls/OrbitControls`
- **代码规范**: 中文注释,ESLint + Prettier (可选)

### 2.2 目录结构
```
mofang/
├─ index.html                       # 入口 HTML
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ src/
   ├─ main.ts                       # 启动入口,装配场景/控件/UI
   ├─ style.css
   │
   ├─ scene/
   │  └─ SceneManager.ts            # 场景/相机/灯光/渲染循环
   │
   ├─ cube/
   │  ├─ Cube.ts                    # 魔方状态模型 (27 cubies + 朝向)
   │  ├─ Cubie.ts                   # 单个 cubie 类
   │  ├─ cubieFactory.ts            # 几何/材质工厂函数
   │  └─ colors.ts                  # WCA 标准配色
   │
   ├─ moves/
   │  ├─ moveTable.ts               # 21 个 move 的轴/层/角度定义
   │  ├─ parser.ts                  # 公式字符串 → token → AST
   │  └─ executor.ts                # 动作序列应用到 Cube (含动画)
   │
   ├─ control/
   │  ├─ DragController.ts          # 鼠标拖拽 → move
   │  └─ raycast.ts                 # 拾取 cubie 与法线
   │
   ├─ ui/
   │  ├─ FormulaInput.ts            # 输入框 + 执行按钮 + 错误提示
   │  ├─ Log.ts                     # 公式日志显示
   │  ├─ Toolbar.ts                 # 撤销/重做/重置/打乱
   │  └─ Shortcuts.ts               # 全局键盘快捷键
   │
   └─ core/
      ├─ types.ts                   # 公共类型定义
      ├─ history.ts                 # 撤销/重做栈
      └─ util.ts                    # 工具函数 (sleep, 缓动等)
```

### 2.3 数据流
```
用户拖拽 ──► DragController ──► moveTable 解析为 MoveSpec
                                          │
                                          ▼
                                Executor.execute(MoveSpec)
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                     动画播放      更新 Cube 状态     推入历史栈
                                                         │
                                                         ▼
                                                    更新 Log UI

公式输入 ──► Parser.parse(str) ──► MoveSpec[] ──► Executor.executeSequence
```

---

## 3. 魔方状态与渲染

### 3.1 坐标系
Three.js 右手系,魔方中心位于原点:
- **+X** = 右 (R 面), **-X** = 左 (L 面)
- **+Y** = 上 (U 面), **-Y** = 下 (D 面)
- **+Z** = 前 (F 面), **-Z** = 后 (B 面)

### 3.2 WCA 标准配色
| 面 | 颜色 | hex |
|---|---|---|
| U | 白 | `#ffffff` |
| D | 黄 | `#ffd500` |
| R | 红 | `#b71234` |
| L | 橙 | `#ff5800` |
| F | 绿 | `#009b48` |
| B | 蓝 | `#0046ad` |
| 内部 | 黑 | `#111111` |

### 3.3 Cubie 数据模型
```ts
// 逻辑坐标 (整数,-1/0/1)
interface LogicalPos { x: -1 | 0 | 1; y: -1 | 0 | 1; z: -1 | 0 | 1; }

// 物理位置 = 逻辑坐标 × cubieSize (本项目 cubieSize = 1)
class Cubie {
  readonly id: string;                  // 唯一 ID, 例 "x0y1z-1"
  readonly mesh: THREE.Mesh;            // Three.js 网格
  logicalPos: LogicalPos;               // 当前逻辑位置
  quaternion: THREE.Quaternion;         // 当前朝向
}
```

### 3.4 渲染细节
- 27 个 Cubie,中心 cubie 不加入场景(被遮挡)
- 每个 Cubie = `BoxGeometry(0.95, 0.95, 0.95)` + 6 个 `MeshBasicMaterial`
- 6 个面材质顺序固定: `[+X, -X, +Y, -Y, +Z, -Z]`,内部面材质为黑色
- 缝隙 0.05 (cubie 边长 0.95,逻辑间距 1.0)
- 贴纸用 `MeshBasicMaterial` (不参与光照,色彩纯净稳定)
- 不使用阴影(简化渲染,与 WCA 教学软件保持一致的扁平贴纸感)

### 3.5 Move 定义 (moveTable.ts)
```ts
type Axis = 'x' | 'y' | 'z';
type MoveSpec = {
  letter: 'R' | 'U' | 'F' | 'L' | 'D' | 'B' | 'M' | 'E' | 'S';
  wide: boolean;          // true = Rw/Uw 等
  prime: boolean;         // true = 反向
  axis: Axis;             // 旋转轴
  layers: -1 | 0 | 1;     // 受影响层(单层)
  dir: 1 | -1;            // 旋转方向系数
};

// 21 个 MoveSpec 由工厂函数 moveTable() 按字母+wide+prime 三维度生成:
//   12 个基础 (R/U/F/L/D/B × 2)
//   6  个双层 (Rw/Uw/Fw/Lw/Dw/Bw)
//   3  个中间 (M/E/S)
```

基础 move 表(不带 prime / wide):
| 字母 | 轴 | 层 | dir |
|---|---|---|---|
| R | x | +1 | -1 |
| L | x | -1 | +1 |
| U | y | +1 | -1 |
| D | y | -1 | +1 |
| F | z | +1 | -1 |
| B | z | -1 | +1 |
| M | x | 0 | +1 |
| E | y | 0 | +1 |
| S | z | 0 | -1 |
| Rw | x | +1,-1 | -1 |
| Uw | y | +1,-1 | -1 |
| (其他双层类同) |

`prime = true` 时执行时 `dir *= -1`。
`wide = true` 时同时旋转该层 + 0 层(若 M/E/S 则仅 0 层)。

### 3.6 状态变更流程 (无动画)
1. 过滤出该层 9 个 cubie (按 `logicalPos[axis] === layer` 筛选)
2. 创建临时 `THREE.Group`,把 9 个 cubie 加入 group
3. group 旋转 `dir × π/2`
4. `group.updateMatrixWorld()`
5. 解除父子关系,提取 cubie 新的世界变换
6. 把新的位置/朝向写回 cubie 的 `logicalPos` 和 `quaternion`
7. 销毁 group

有动画时:把步骤 3-6 拆到 `requestAnimationFrame` 中做插值。

---

## 4. 鼠标拖拽识别

### 4.1 算法步骤

**mousedown**:
- 用 `Raycaster` 拾取 cubie 和面
- 记录:
  - `faceNormal` = `intersect.face.normal` 应用 cubie 的 worldMatrix 得到的世界空间法线 N
  - `clickPoint` = 射线与面的交点 P (世界空间)
  - `cubieCenter` = C (世界空间)
  - `rotationAxis` = N 的轴向归一化 (X/Y/Z)
  - `layer` = `sign(dot(C, N))` 兜底,从 C 的逻辑坐标也能取

**mousemove** (持续跟踪,直到 mouseup):
- 用当前鼠标位置构造射线,投影到平面 (P, N) 得到当前点 P'
- 计算世界空间拖拽向量 `D = P' - P`
- 累加 `|D|`,若超过阈值 (5px) 标记为已拖拽

**mouseup**:
- 若未拖拽,直接结束
- 取面内切向基:
  - `rightLocal = normalize(cross(N, worldUp))` (worldUp = `(0,1,0)`)
  - `upLocal = cross(rightLocal, N)`
- 投影:`a = dot(D, rightLocal)`,`b = dot(D, upLocal)`
- 取主方向:若 `|a| > |b|`,方向 = `sign(a) × rightLocal`;否则 = `sign(b) × upLocal`
- 查表得到 `MoveSpec`,调用 `Executor.execute(spec)`

### 4.2 面 → 拖拽 → Move 映射

| 起始面 (N) | 拖拽沿 | Move |
|---|---|---|
| +X (R 面) | +rightLocal | R |
| +X (R 面) | -rightLocal | R' |
| +X (R 面) | +upLocal | R |
| +X (R 面) | -upLocal | R' |
| -X (L 面) | +rightLocal | L' |
| -X (L 面) | -rightLocal | L |
| -X (L 面) | +upLocal | L |
| -X (L 面) | -upLocal | L' |
| +Y (U 面) | +rightLocal | U |
| -Y (D 面) | +rightLocal | D |
| +Z (F 面) | +rightLocal | F |
| -Z (B 面) | +rightLocal | B' |

> 实际代码:用 (axis, layer, sign) 三元组生成,横纵两方向用统一规则查表。

### 4.3 与 OrbitControls 协同
- mousedown 命中 cubie → `orbitControls.enabled = false`,独占后续事件
- mouseup / mouseleave → 恢复 `orbitControls.enabled = true`
- mousedown 未命中 cubie → 不干预,OrbitControls 正常旋转相机
- 右键拖拽 → 始终交给 OrbitControls (平移)

### 4.4 动画
- 单步 move: 200ms,缓动 `easeInOutQuad`
- 公式批量执行:每步间隔 50ms,可点"停止"中断
- 180° (count=2) 用单次 400ms 动画,不停顿

---

## 5. 公式解析

### 5.1 语法 (EBNF)
```
formula  := group ("," group)*
group    := atom (atom)*
atom     := move | "(" group ")" [count]
move     := letter [w] [prime] [count]
letter   := R | U | F | L | D | B | M | E | S    (大小写不敏感)
prime    := "'"
count    := 数字 (1-99)
```

支持示例:
```
R, U, R' U', F                       # 4 步
R U R' U'                            # 4 步 (无逗号也支持)
(R U R' U')3                         # 12 步
R2, (U R')2                          # R 180° + (U R' U R') 共 5 步
Rw, Uw', M2                          # 双层与中间层
```

### 5.2 Token 类型
```ts
type Token =
  | { kind: 'move'; letter: string; wide: boolean; prime: boolean; count: number }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'number'; value: number };
```

### 5.3 AST 节点
```ts
type Move = {
  type: 'move';
  letter: string;
  wide: boolean;
  prime: boolean;
  count: number;
};

type Group = {
  type: 'group';
  children: ASTNode[];
  count: number;     // 默认 1
};

type ASTNode = Move | Group;
```

### 5.4 解析流程 (递归下降)
1. **tokenize** (`src/moves/parser.ts`): 字符串 → `Token[]`
2. **parse**: 递归下降 → `ASTNode`
3. **flatten** + **expandCount**: 展平为 `Move[]` (保留 count 字段)
4. **validate**: 字母/宽/反/数字组合是否合法
5. **错误信息**: 行列号 + 友好提示 (`R2'` 非法 / `(R U` 缺右括号)

### 5.5 执行器 (`executor.ts`)
```ts
class Executor {
  async executeSequence(sequence: Move[], options?: {
    speed?: number;   // 单步动画时长 (ms), 默认 200
    gap?: number;     // 步间停顿 (ms), 默认 50
  }): Promise<void>;

  async executeOne(spec: MoveSpec): Promise<void>;

  cancel(): void;     // 中断当前序列
}
```

实现:
```ts
async executeOne(spec: MoveSpec) {
  const angle = (Math.PI / 2) * spec.count * spec.dir * (spec.prime ? -1 : 1);
  await animateRotation(spec.layers, spec.axis, angle, options.speed);
  applyToState(spec);          // 更新 cubie 逻辑坐标和朝向
  history.push(spec);
  log.append(formatMove(spec));
}
```

---

## 6. UI / 交互

### 6.1 布局
```
┌─────────────────────────────────┬──────────────────┐
│                                 │  公式输入        │
│                                 │  ┌────────────┐  │
│                                 │  │ R U R' U'  │  │
│         3D 魔方画布              │  └────────────┘  │
│        (Three.js)                │  [执行] [清空]   │
│                                 │                  │
│                                 │  ─ 操作日志 ─    │
│                                 │  R U R' U' F F'  │
│                                 │  [复制] [清空]   │
│                                 │                  │
│                                 │  ─ 工具 ─        │
│                                 │  ↶撤销 ↷重做     │
│  [↻ 视角重置]                    │  ↻重置 🔀打乱   │
└─────────────────────────────────┴──────────────────┘
```

### 6.2 色系
- 背景:`#1a1a1f`
- 面板:`#25252d` + 1px `#3a3a45` 边
- 主色:`#4f9eff`
- 强调 (危险操作):`#ffb84f`
- 文字:`#e0e0e8`
- 魔方贴纸:WCA 标准色

### 6.3 组件
1. **FormulaInput** — 输入框 + 执行按钮 + 实时校验 + 错误行号
2. **Log** — 顶部一行公式串(等宽) + 复制 + 清空 + 可折叠历史
3. **Toolbar** — 撤销 / 重做 / 重置 / 打乱 / 视角重置
4. **画布角标** — 旋转状态 + 视角重置小按钮

### 6.4 键盘快捷键
| 键 | 行为 |
|---|---|
| `R` / `Shift+R` | R / R' |
| `U` / `Shift+U` | U / U' |
| `F` / `Shift+F` | F / F' |
| `L` / `Shift+L` | L / L' |
| `D` / `Shift+D` | D / D' |
| `B` / `Shift+B` | B / B' |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Ctrl+Enter` | 执行输入框 |
| `Esc` | 停止当前公式 |

### 6.5 撤销 / 重做
- `historyStack: MoveSpec[]`
- `redoStack: MoveSpec[]`
- 撤销:从 historyStack pop,取 `prime = !prime` 重新执行,push 到 redoStack
- 重做:从 redoStack pop,push 回 historyStack
- 重置 / 打乱:清空两个栈

### 6.6 响应式
- 视口 < 900px:面板移至画布下方
- 触屏:复用 pointer 事件

---

## 7. 错误处理

| 错误 | 处理 |
|---|---|
| 公式非法字符 | 输入框红边 + 错误提示("非法字符 `X` 在第 3 列") |
| 括号不匹配 | 同上 |
| 数字超界 | 同上 |
| 公式无 move | 提示"公式为空" |
| 移动端不支持 WebGL | 启动时检测,显示降级提示 |
| OrbitControls 与拖拽冲突 | mouseup 强制恢复 enabled |

---

## 8. 性能

- 27 个 cubie,面数 ≤ 162,渲染压力极小
- 单帧 `requestAnimationFrame` 节流,公式批量执行 60fps 无压力
- 拖拽过程中节流 mousemove 处理 (每帧最多 1 次),避免高频触发

---

## 9. 测试策略 (轻量)

- **类型检查**: `tsc --noEmit`
- **构建**: `vite build` 无报错
- **手动验证**:
  1. 拖拽 R 面向上 → 日志出现 R,魔方状态正确
  2. 输入 `R U R' U'`,执行后魔方回到原状态,日志记录正确
  3. 输入 `(R U R' U')3` 解析为 12 步
  4. 撤销 / 重做往返一致
  5. 21 种 move 全部能执行且魔方几何合法
  6. 移动端 (Chrome DevTools) 触屏拖拽可用

---

## 10. 依赖

```json
{
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

---

## 11. 风险与待办

| 风险 | 缓解 |
|---|---|
| 拖拽识别误判 (阈值 / 方向) | 阈值可配置;提供键盘备选 |
| 公式解析边界情况 (空分组、嵌套) | 单元测试覆盖主要分支 |
| Three.js 版本升级 API 变化 | 锁定到 r170+ 主版本,后续小版本升需回归测试 |

---

## 12. 后续可扩展 (不在本规范)

- 计步 / 计时 (WCA 标准)
- CFOP / OLL / PLL 公式库
- 算法收藏夹
- 求解器 (Kociemba 两阶段算法)
- 多语言
