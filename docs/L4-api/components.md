# L4 · API · 组件 props / emits

> 上层：[L2 UI 层](../L2-components/ui.md) ｜ 源码：`src/components/*.vue`
>
> 全部以各 `.vue` 的 `defineProps` / `defineEmits` 为准。emits 名以模板/`defineEmits` 中的 camelCase 定义；在父模板里用 kebab-case 监听（如 `setSecret` → `@set-secret`）。

## `SecretInput.vue`

单个秘密输入框：实时校验、可切换隐藏（`password`/`text`）、确认后清空。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，用于 `maxlength` 与过滤截断 |
| `label` | `string` | 提示文案（同时作 `aria-label`） |
| `validate` | `(value: string) => ValidationResult` | 校验函数（通常为 `useGame.checkSecret`） |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `confirm` | `[value: string]` | 校验通过并点确认/回车；emit 后清空输入 |

## `HandoffScreen.vue`

通用交接屏：一句提示 + 一个继续按钮。**目前仅 setup 阶段使用**（playing 阶段已取消交接屏）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `message` | `string` | 交接提示文案 |
| `buttonText` | `string`（可选） | 按钮文字，缺省 `'开始'` |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `continue` | `[]`（无载荷） | 点击按钮 |

## `SetupView.vue`

编排 setup 三步：P1 输入 → 交接屏 → P2 输入（本地 `step` ref）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，透传给 `SecretInput` |
| `validate` | `(value: string) => ValidationResult` | 秘密数校验，透传给 `SecretInput` |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `setSecret` | `[player: PlayerId, value: string]` | P1 或 P2 确认秘密数时（父用 `@set-secret`） |

## `GuessInput.vue`

猜测输入框：实时校验、提交后清空。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，用于 `maxlength` 与过滤截断 |
| `label` | `string` | 提示文案（同时作 `aria-label`） |
| `validate` | `(value: string) => ValidationResult` | 校验函数（通常为 `useGame.checkGuess`） |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `confirm` | `[value: string]` | 校验通过并点提交/回车；emit 后清空输入 |

## `HistoryList.vue`

纯展示一串猜测记录，可复用（PlayView 展示当前玩家、ResultView 展示双方）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `records` | `GuessRecord[]` | 猜测记录数组（`{ guess, feedback }`，每条渲染为「猜测 + 正确数目 N」） |
| `title` | `string`（可选） | 标题；为空则不渲染 `<h3>` |
| `side` | `'red' \| 'blue'`（可选） | 红/蓝主题样式 |

**emits**：无。

## `PlayView.vue`

编排 playing 阶段：当前方猜测输入 + **红蓝双历史常驻**（无交接屏、无 `round` prop）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，透传给 `GuessInput` |
| `current` | `PlayerId` | 当前轮到谁猜，决定输入框标题（`sideName`：红/蓝） |
| `validate` | `(value: string) => ValidationResult` | 猜测校验，透传给 `GuessInput` |
| `history` | `{ p1: GuessRecord[]; p2: GuessRecord[] }` | 双方历史；**红蓝两份都常驻展示**（HistoryList ×2，标题「红方」「蓝方」，每条显示「正确数目 N」） |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `guess` | `[value: string]` | 当前方提交猜测 |

## `ResultView.vue`

结束屏：胜负/平局文案、公开双方秘密与完整历史、再来一局。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `outcome` | `Outcome` | 结局；`draw`→「平局！」，`win`→ `winner==='p1'` 时「红方获胜！」否则「蓝方获胜！」 |
| `secrets` | `{ p1: string \| null; p2: string \| null }` | 双方秘密，结束公开（「红方的数字 / 蓝方的数字」） |
| `history` | `{ p1: GuessRecord[]; p2: GuessRecord[] }` | 双方完整历史，分红/蓝两列展示 |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `playAgain` | `[]`（无载荷） | 点「再来一局」（父用 `@play-again`，调 `reset()`） |

## `SolverPanel.vue`

推理提示助手：4×10 网格，红蓝各一实例，仅 playing 阶段渲染。基于该方猜测历史自动推理对方秘密数（调用纯函数 `solve`），支持假设 / 划除做 what-if。详见 [L3 推理引擎](../L3-details/solver.md) · [L4 solver API](./solver.md)。

**props**（以 `defineProps` 为准）

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，决定网格列数 |
| `guesses` | `GuessRecord[]` | 该方猜测历史（事实）。App 中红方传 `state.history.p1`，蓝方传 `state.history.p2` |
| `side` | `'red' \| 'blue'` | 主题色与标题（「红方助手 / 蓝方助手」） |

**emits**：无对外 emits。`assumptions`、`crossedOut`、`expanded` 均为面板**本地** ref；`grid` 为 `computed`，随 `guesses` 及本地状态自动重算。

**交互**

| 操作 | 行为 |
|------|------|
| 左键点格 | 设该列假设（assumed）；再点同格取消；点同列别格替换（一列最多一个假设） |
| Shift+左键 / 右键 / Delete | 切换手动划除（crossedOut）；再次取消 |
| 重置假设 | 清空本面板 assumptions + crossedOut（回纯事实推理） |
| 折叠条 | 点击展开 / 收起；**默认收起** |

格子颜色对应 `CellState`：`available`（普通）/ `eliminated`（灰）/ `fixed`（绿，自动确定）/ `assumed`（高亮）/ `conflict`（红，矛盾）。
