# 解算器「智能/基础」推理开关 设计文档

- 日期：2026-06-23
- 状态：已与用户确认，待转入实施计划
- 关联：number-guessing-game 推理提示助手（SolverPanel + `src/game/solver.ts`）

## 1. 概述与目标

现有助手的智能推理（`solve`）基于**全枚举 + 事实过滤**，能从线索推出"逻辑上必然正确/排除"的结论——用户反馈"太强了"。本设计给每个助手面板加一个**「智能推理」开关**，可切换到一个更弱的**基础模式**：

- **智能模式（默认，现状不变）**：枚举式推理，自动判定"确定(绿)"与"排除(灰)"，假设/划除联动收窄。
- **基础模式**：**只推"排除"，绝不自动推"确定"**。两条排除规则——①反馈=0 的直接排除；②"已知正确格"（用户左键假设）的行/列排除。某列即使只剩一个可能也不替用户断定。

**核心价值**：让玩家自行选择助手的"智能强度"，基础模式保留"提示但不剧透"的体验。

## 2. 已确认的需求决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 基础规则① | 任一猜测"正确数目=0" → 该猜测每位数字在对应位置标**排除** |
| 2 | 基础规则② | "已知正确格"(p,d)（用户左键假设）→ 行 `[p'][d]`(p'≠p) 与列 `[p][d']`(d'≠d) 全**排除** |
| 3 | 基础规则③ | **不自动判"确定(绿/fixed)"**——即使某列只剩一个可能 |
| 4 | 手动交互 | 左键假设、右键划除两种模式**都保留** |
| 5 | 开关默认 | **默认开启智能**（保持现状），可手动切到基础 |
| 6 | 开关范围 | **每个助手面板各自独立**（红、蓝各选；贴合现有面板独立状态） |
| 7 | 架构 | 方案 A：新增独立纯函数 `basicSolve`，与 `solve` 并列，按开关选用 |

## 3. 架构（方案 A：basicSolve 纯函数）

```
src/game/solver.ts
  enumerateCandidates / filterByFacts / solve   ← 现有(智能, 枚举)
  basicSolve(input): Grid                        ← 新增(基础, 只排除)
       共用 SolverInput / Grid / CellState

src/components/SolverPanel.vue
  smartMode = ref(true)        ← 每面板独立开关(默认智能)
  grid = computed(() => smartMode.value ? solve(input) : basicSolve(input))
```

- `basicSolve` 与 `solve` 同签名（`SolverInput → Grid`），可互换；各自是独立纯函数，互不影响、独立穷尽单测。
- 切换开关只改"用哪个推理函数"，**保留**面板既有 `assumptions` / `crossedOut`（手动标记不丢）。
- 基础模式**永不产生 `'fixed'`**；复用现有 CellState 的其余 5 态（available/eliminated/crossed/assumed/conflict），无需改类型。

## 4. `basicSolve` 算法（只排除、不确定）

输入同 `SolverInput`：`{ digits, guesses, assumptions, crossedOut }`，输出 `Grid = CellState[][]`（`grid[pos][digit]`，digits 列 × 10 行）。

### 4.1 步骤

```
1) 构造排除集 eliminated: Set<"pos-digit">
   ① 事实排除：对每个 g ∈ guesses 且 g.feedback === 0：
        对每个 pos i (0..digits-1)：eliminated.add(`${i}-${Number(g.guess[i])}`)
   ② 已知正确(假设)的行列排除：对每个有效假设 assumptions[p] = d (d 为 0-9)：
        行：对每个 p' ≠ p：eliminated.add(`${p'}-${d}`)
        列：对每个 d' ≠ d (0..9)：eliminated.add(`${p}-${d'}`)
   注意：假设格自身 `${p}-${d}` 不被自己的行/列规则加入

2) 逐格定状态 cell [p][d]（d=0..9）：**优先级与智能 `solve` 一致（假设优先于划除）**，
   保证切换模式时同一手动标记渲染一致、划除不会掩盖矛盾：
     key = `${p}-${d}`
     if assumptions[p] === d:                      // 该格被假设为正确
        state = eliminated.has(key) ? 'conflict' : 'assumed'
     elif crossedOut.has(key):                     state = 'crossed'
     elif eliminated.has(key):                     state = 'eliminated'
     else:                                         state = 'available'
   （绝不产生 'fixed'）
```

### 4.2 假设有效性

与 `solve` 一致：仅当 `assumptions[p]` 为 `0..9` 的整数才施加规则②；`null`/越界/数组过短视为"无假设"，不报错、不误排除（健壮性）。

### 4.3 矛盾(conflict)如何自然出现

- **同列两假设不可能**：`assumptions` 是每个位置一个值的数组，一列（一个位置）最多一个假设格，结构上排除了"同列两假设"。同列其它格被规则②列排除标 'eliminated' 即可（它们本就不是假设格）。
- **同行同数两假设**（两个位置都假设为同一个数 d）：`assumptions[p1]=d` 与 `assumptions[p2]=d`。规则②对 p1 的行排除会 add `${p2}-${d}`，对 p2 的行排除会 add `${p1}-${d}` → 两个假设格都 ∈ eliminated → 都判 'conflict'。✓
- **假设一个反馈=0 已排除的格**：`assumptions[p]=d` 且事实已 `eliminated.has("p-d")` → 'conflict'。✓

### 4.4 与智能模式的关键差异

| 行为 | 智能 `solve` | 基础 `basicSolve` |
|------|------------|------------------|
| 排除来源 | 全枚举 + 事实过滤 + 假设/划除联动 | 仅 反馈=0 + 假设格行列 |
| 自动"确定(绿 fixed)" | 有（某列唯一可能→绿） | **无** |
| 划除(右键) | 作为 what-if 约束参与枚举收窄 | 仅手动标记，不参与推理 |
| 矛盾检测 | what-if 候选集为空 | 假设格落入 eliminated |

## 5. 开关 UI 与图例

### 5.1 smartMode 开关（每面板独立）

SolverPanel 新增 `const smartMode = ref(true)`（默认智能）。网格计算：
```typescript
const grid = computed(() =>
  (smartMode.value ? solve : basicSolve)({
    digits: props.digits, guesses: props.guesses,
    assumptions: assumptions.value, crossedOut: crossedOut.value,
  }),
)
```
切换 `smartMode` 不动 `assumptions`/`crossedOut`（手动标记保留）。

### 5.2 控件与布局

放在 `.solver-body` 顶部 help-bar（左开关、右 ? 按钮，`justify-content: space-between`）：
```
┌ 助手面板（展开）──────────────────┐
│ [🧠 智能推理 ☑]              [ ? ] │  ← help-bar
│ (图例，点 ? 展开)                  │
│ 4×10 网格                          │
│ [重置假设]                          │
└───────────────────────────────────┘
```
控件：`<label class="solver-mode"><input type="checkbox" v-model="smartMode" /> 🧠 智能推理</label>`（勾选=智能，取消=基础）。

### 5.3 图例随模式自适应（保证准确）

- 智能模式：6 态全列 + 说明「智能：枚举推理，自动判定确定/排除」。
- 基础模式：**隐藏「确定(绿)」那一行**（`v-if="smartMode"`，basic 永不产生）+ 说明「基础：只标排除（反馈0 + 已知正确的行列），不自动判确定」。

## 6. 测试策略（Vitest）

**`src/game/solver.test.ts`（新增 `describe('basicSolve')`）**：
- 反馈=0 → 对应位置该数字 `eliminated`（如猜 `0000` 得 0 → `grid[0..3][0]` 全 eliminated）。
- 非反馈0 的猜测**不**产生事实排除（如猜 `1234` 得 1 → 不排除任何格）。
- 假设格 (p,d)：自身 `assumed`；同行其它位置的 d 与同列其它数字均 `eliminated`。
- **不自动 fixed**：构造"某列只剩一个可能"的场景，断言该格 basic 下仍 `available`（同输入 `solve` 下为 `fixed`，对比）。
- 矛盾：两位都假设同一数字 d → 两假设格 `conflict`；假设一个反馈=0 已排除的格 → `conflict`。
- 右键划除 → `crossed`；默认 `available`；无效/越界假设不误排除。

**`src/components/SolverPanel.test.ts`**：
- 默认 `smartMode` 为真：渲染走 `solve`（保持现有用例全绿）。
- 勾选框切到基础：构造 smart 判 `fixed` 而 basic 不判的场景，断言切换后该格 class 由 `fixed` → `available`。
- 图例：基础模式不渲染「确定」行（断言图例文本/结构随模式变化）。
- 切换模式保留已有假设/划除（断言切换后 assumed/crossed 仍在）。

## 7. 文件清单

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/game/solver.ts` | 改 | 新增纯函数 `basicSolve(input): Grid`（只排除、不确定） |
| `src/game/solver.test.ts` | 改 | 新增 basicSolve 穷尽单测 |
| `src/components/SolverPanel.vue` | 改 | `smartMode` 开关 + 控件 + 网格按模式选用 + 图例自适应 |
| `src/components/SolverPanel.test.ts` | 改 | 开关切换/默认/图例随模式 用例 |
| `src/style.css` | 改 | help-bar 布局(space-between) + `.solver-mode` 开关样式 |
| `docs/L3-details/solver.md` · `docs/L4-api/solver.md` | 改 | 补「基础模式」规则与 `basicSolve` 签名 |

## 8. 非目标（YAGNI）

- 基础模式**不**做任何枚举/联动/正向确定推理（这正是"基础"的定义）。
- 不持久化开关状态（刷新回默认智能；与现有"刷新重置助手"一致）。
- 不加红蓝共享/全局设置（每面板独立已确认）。
- 不改 CellState 类型（复用现有 5 态，basic 不产生 fixed）。
- 不动对局引擎/历史/其它无关部分。


