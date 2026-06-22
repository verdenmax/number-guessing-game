# 推理提示助手（Solver Panel）+ 展示优化 设计文档

- 日期：2026-06-22
- 状态：已与用户确认，待转入实施计划
- 关联：number-guessing-game（Vue 3 热座双人猜数字游戏，红蓝双方）

## 1. 概述与目标

为游戏猜测阶段增加一个**推理提示助手**：左右两侧分别服务红方、蓝方。每个助手是 **4 列 × 10 格**（4 个数字位置，每列纵向 0-9）的网格，基于该方的猜测历史**自动推理对方的秘密数字**，并支持用户手动「假设 / 划除」做 what-if 推演，自动检测矛盾。

同时对整体界面做**展示优化**（历史、输入、结果页、三栏布局的视觉打磨）。

**核心价值**：把玩家心算的排除推理可视化、自动化，并能做"如果第 2 位是 5"这类假设推演与矛盾检测。

## 2. 已确认的需求决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 推理智能度 | **全自动推理引擎**：枚举全部「N 位互不相同」候选，用猜测历史过滤，自动置灰排除 + 假设矛盾标红 |
| 2 | 显示时机 | 助手**默认收起**，可折叠/按钮唤出；仅猜测阶段提供 |
| 3 | 格子交互 | 点击=假设正确；**额外支持手动划除**（右键/长按标为不可能）|
| 4 | 自动确定 | 某列只剩一个可能数字时**自动标「确定」（绿色）** |
| 5 | 假设语义 | **联动收窄**：假设/划除作为额外条件实时重新推理（what-if 工具），不只是矛盾检测 |
| 6 | 架构 | 方案 A：纯函数 solver 模块 + Vue 面板组件 |

## 3. 推理本质

枚举全部「N 位互不相同」的候选秘密数（N=4 → 5040 个），用「事实（该方猜测 + 正确数目历史）」过滤出"逻辑上仍可能的对方数字"集合；再叠加用户「假设/划除」得 what-if 候选集；每格状态由候选集推导。**枚举即真值**——无需手写复杂约束推理，正确性可证明。N=4 数据量极小（5040 × 历史条数），毫秒级。

```
答案候选空间(互不相同 N=4)  ──事实过滤(猜测→正确数目)──▶  factPossible
                                                              │
                                          ┌── 叠加 assumptions/crossedOut ──┘
                                          ▼
                                     whatif 候选集 ──▶ 逐格定状态 + 全局矛盾检测
```

## 4. 架构：纯函数 solver + Vue 面板（方案 A）

```
┌─────────────────────────────────────────────┐
│  SolverPanel.vue (UI)   红蓝各一实例          │  渲染 4×10 网格 + 点击/右键/折叠/重置
├─────────────────────────────────────────────┤
│  src/game/solver.ts (纯 TS, 零 Vue/DOM)       │  枚举·事实过滤·what-if·逐格状态·矛盾
│     复用 engine.ts 的 feedback()              │
└─────────────────────────────────────────────┘
```

- solver 与对局引擎（engine.ts / useGame）**完全独立**：助手是纯辅助叠加层，不改对局逻辑，降低破坏风险。
- 假设/划除是**面板本地 UI 状态**，不进引擎、不影响对局。

## 5. solver 模块（`src/game/solver.ts`）

### 5.1 数据结构

```typescript
export type CellState = 'available' | 'eliminated' | 'fixed' | 'assumed' | 'conflict'
// available=可用(默认)  eliminated=被排除(灰，含事实排除/手动划除/联动排除)
// fixed=唯一确定(绿,自动)  assumed=用户假设(高亮)  conflict=矛盾(红)

export interface SolverInput {
  digits: number
  guesses: GuessRecord[]              // 该方对对方的猜测历史（事实）
  assumptions: (number | null)[]      // 长度 = digits，每位假设值，null=未假设
  crossedOut: Set<string>             // 手动划除，键 "pos-digit"（如 "0-5"）
}

export type Grid = CellState[][]      // grid[pos][digit]，digits 列 × 10 行
```

### 5.2 函数 API

```typescript
enumerateCandidates(digits: number): string[]
// 全部长度 digits、每位 0-9、互不相同的字符串。digits=4 → 5040；digits=1 → 10。

filterByFacts(cands: string[], guesses: GuessRecord[]): string[]
// 保留满足「∀ g: feedback(c, g.guess) === g.feedback」的候选。复用 engine.feedback。

solve(input: SolverInput): Grid
// 见 5.3 算法。返回每格状态。
```

### 5.3 `solve` 算法（伪代码）

```
cands       = enumerateCandidates(digits)
factPossible = filterByFacts(cands, guesses)               # 事实层仍可能
whatif = factPossible.filter(c =>
            ∀ i where assumptions[i] != null:  c[i] === String(assumptions[i])
            ∧ ∀ "p-d" in crossedOut:           c[p] !== d )

for pos in 0..digits-1, digit in 0..9:
   d = String(digit)
   posDigitOK   = ∃ c in whatif: c[pos] === d
   factHasIt    = ∃ c in factPossible: c[pos] === d
   colOnlyThis  = (whatif 中 pos 位出现过的数字集合 == { d })   # 该列只剩这一个

   if assumptions[pos] === digit:
        grid[pos][digit] = posDigitOK ? 'assumed' : 'conflict'
   elif crossedOut has "pos-digit":
        grid[pos][digit] = 'eliminated'
   elif not factHasIt:
        grid[pos][digit] = 'eliminated'            # 事实排除（如猜 0000→0 全列灰）
   elif colOnlyThis:
        grid[pos][digit] = 'fixed'                 # 自动确定（绿）
   elif not posDigitOK:
        grid[pos][digit] = 'eliminated'            # 被其它假设/划除联动排除
   else:
        grid[pos][digit] = 'available'

# 全局矛盾：what-if 无解 → 所有已假设格标红
if whatif.isEmpty:
   for i where assumptions[i] != null:
        grid[i][assumptions[i]] = 'conflict'
return grid
```

### 5.4 关键点

1. `feedback` 复用 `engine.ts`，不重写规则。
2. 「联动收窄」「矛盾」自然从 `whatif` 候选集得出，无需手写约束闭包。
3. 纯函数：输入→输出确定，可穷尽单测。
4. 猜测允许重复（如 `0000`），但候选(秘密数)互不相同——`feedback('0123','0000')` 这类正常计算，事实过滤照常工作。

## 6. 面板组件（`src/components/SolverPanel.vue`）

### 6.1 Props / Emits

```typescript
defineProps<{
  digits: number
  guesses: GuessRecord[]   // 红方面板传 history.p1，蓝方传 history.p2
  side: 'red' | 'blue'     // 主题色
}>()
// 无对外 emits：assumptions、crossedOut、expanded 均为面板本地 ref。
// guesses 变化 → 计算属性 grid 自动重算。
```

### 6.2 本地状态与计算

```typescript
const expanded   = ref(false)                      // 默认收起
const assumptions = ref<(number|null)[]>(Array(digits).fill(null))
const crossedOut  = ref<Set<string>>(new Set())
const grid = computed(() => solve({ digits, guesses: props.guesses,
                                    assumptions: assumptions.value,
                                    crossedOut: crossedOut.value }))
```

### 6.3 布局（4 列 × 10 格）

```
┌─ 🔴 红方助手 ▸ ──────────┐   折叠条（点击展开/收起）
│  位1   位2   位3   位4    │   列头
│  [0]   [0]   [0]   [0]    │
│  [1]   [1]   [1]   [1]    │   每格 <button> 显示数字
│  [2]   [2]✗  [2]   [2]    │   颜色区分状态
│  ...                      │
│  [9]   [9]   [9]   [9]    │
│        [重置]              │
└───────────────────────────┘
```

### 6.4 交互

- **左键可用格** → 设该列假设（assumed）；再点同格取消；点同列别的格替换（一列最多一个假设）。
- **右键 / 长按格**（`@contextmenu.prevent`）→ 切换手动划除（crossedOut）；再次取消。
- 每次操作 → grid 计算属性自动重算 → 联动置灰/变绿/标红实时反映。
- **重置按钮** → 清空本面板 assumptions + crossedOut（回纯事实推理）。
- **折叠**：标题栏点击切 `expanded`，默认收起为窄条。

### 6.5 安全/无障碍

- 格子为 `<button>`（键盘可聚焦），状态用 class + 颜色；纯文本数字，**无 v-html**。
- `:aria-label` 标注「位N 数字D 状态」。

## 7. 布局整合（猜测阶段三栏）

```
桌面宽屏：  [红方助手] [ 游戏卡片 ] [蓝方助手]      助手默认收起为窄条
窄屏手机：   游戏卡片
            [红方助手 ▸]                          折叠条堆叠在下方
            [蓝方助手 ▸]
```

- App 的 `.stage` 内用 `.table` flex：左 `SolverPanel(side=red, :guesses=state.history.p1)` + 中 `.app` 卡片 + 右 `SolverPanel(side=blue, :guesses=state.history.p2)`。
- **仅 `phase==='playing'` 渲染两侧助手**；setup/over 阶段只有中间卡片。
- 整页红蓝背景（已实现）保留；助手主题色跟随各自方。
- 窄屏 `flex-wrap` 堆叠；收起态不挤压游戏。

## 8. 展示优化（CSS 调整，不改 DOM 结构/class 契约）

- 历史项：猜测数字逐位分隔更清晰；正确数目徽章更醒目。
- 猜测输入区：当前方标签更大、配合整页色；聚焦态明显（已做）。
- 结果页：胜负标题加大、双方数字对比更清晰。
- 三栏桌面间距有呼吸感；助手网格紧凑可点。
- 全部为样式调整，不动模板结构/现有 class，保证既有测试不破。

## 9. 测试策略（Vitest）

重心在 solver 穷尽测试；面板做关键交互测试。

**`src/game/solver.test.ts`**：
- `enumerateCandidates(4)` 数量=5040、每个 4 位互不相同；`enumerateCandidates(1)`=10。
- `filterByFacts`：构造已知 secret + 若干猜测，断言 secret 仍在候选集、`feedback` 不符的被滤除。
- 自动置灰：猜 `0000`→正确数目 0，则数字 0 在所有列被排除（grid 对应格 eliminated）。
- 自动 fixed：构造历史使某列只剩一个可能 → 该格 `fixed`。
- 假设命中：assumptions 命中候选 → `assumed`；联动其它列收窄（相应格变 eliminated/fixed）。
- 假设矛盾：两位假设同一数字（违反互不相同）→ whatif 空 → 相关格 `conflict`。
- 划除：crossedOut 排除候选 → 影响 grid。
- N=4 性能（隐含）：测试整体毫秒级完成。

**`src/components/SolverPanel.test.ts`**：
- 渲染 digits 列 × 10 格。
- 左键设假设（格变 assumed）、再点取消；同列替换。
- 右键划除（@contextmenu）→ 格变 eliminated。
- 重置清空假设/划除。
- 折叠/展开切换。
- 红蓝 side 主题 class。

## 10. 文档

- 更新 L1-L4 + README：新增助手功能与三栏布局；同步「红蓝改版」之前未更新的文档（玩家1/2→红蓝、猜测阶段无交接屏、「提示」→「正确数目」）。
- 新增 `docs/L3-details/solver.md`（枚举推理、what-if、矛盾检测、状态推导）。
- 新增 `docs/L4-api/solver.md`（enumerateCandidates/filterByFacts/solve 签名）。
- `docs/L4-api/components.md` 增 SolverPanel props。
- README「当前文档覆盖」表更新。

## 11. 非目标（YAGNI）

- 不做增量约束传播（方案 C）：枚举法在 N≤7 足够快且可证明正确。
- 不持久化助手状态（刷新重置）。
- 助手不参与/不改变对局判定，纯辅助。
- 不支持运行期改位数 UI（位数仍是引擎参数）。

## 12. 文件清单

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/game/solver.ts` | 新增 | 纯函数推理：枚举·事实过滤·what-if·逐格状态·矛盾 |
| `src/game/solver.test.ts` | 新增 | solver 穷尽单测 |
| `src/components/SolverPanel.vue` | 新增 | 4×10 网格面板 + 交互 + 折叠 |
| `src/components/SolverPanel.test.ts` | 新增 | 面板交互测试 |
| `src/App.vue` | 改 | 三栏布局，playing 阶段挂左右助手 |
| `src/style.css` | 改 | 三栏/助手网格/格子状态配色 + 展示优化 |
| `docs/**` + `README.md` | 改/增 | L1-L4 同步 + solver 文档 |
