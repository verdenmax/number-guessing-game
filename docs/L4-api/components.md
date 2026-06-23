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

编排 setup 三步：P1 输入 → 交接屏 → P2 输入（本地 `step` ref）。每步顶部有**可选昵称**输入（留空回退红方 / 蓝方），确认时随秘密一并上抛。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，透传给 `SecretInput` |
| `validate` | `(value: string) => ValidationResult` | 秘密数校验，透传给 `SecretInput` |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `setSecret` | `[player: PlayerId, value: string]` | P1 或 P2 确认秘密数时（父用 `@set-secret`） |
| `setName` | `[player: PlayerId, name: string]` | 确认前先上抛该方昵称（空串由父侧 `applyName` 归一为 `null`，父用 `@set-name`） |

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

结束屏：胜负/平局文案、公开双方秘密与完整历史、保存状态提示、再来一局 / 查看历史。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `outcome` | `Outcome` | 结局；`draw`→「平局！」，`win`→ `winner==='p1'` 时「红方获胜！」否则「蓝方获胜！」 |
| `secrets` | `{ p1: string \| null; p2: string \| null }` | 双方秘密，结束公开（「红方的数字 / 蓝方的数字」） |
| `history` | `{ p1: GuessRecord[]; p2: GuessRecord[] }` | 双方完整历史，分红/蓝两列展示 |
| `names` | `{ p1: string \| null; p2: string \| null }`（可选） | 可选昵称，经 `sideName` 兜底为「红方 / 蓝方」 |
| `saveError` | `string \| null`（可选） | 历史保存失败文案；非空显示错误横幅，否则显示「✅ 本局已保存到历史」 |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `playAgain` | `[]`（无载荷） | 点「再来一局」（父用 `@play-again`，调 `reset()` 等复位） |
| `viewHistory` | `[]`（无载荷） | 点「📜 查看历史」（父用 `@view-history`，切到历史视图） |

## `HistoryView.vue`

历史列表视图：按 `playedAt` 倒序展示每局（时间 / 对阵 / 胜负 / 「N位·M回合」）。每行可点开详情、可删除，顶部可清空、可返回。错误横幅与列表非互斥；空态「还没有历史记录，玩一局试试吧」仅在无记录且无错误时显示。删除 / 清空均带 `confirm` 二次确认。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `records` | `GameRecord[]` | 历史记录数组（倒序），渲染为可点击行 |
| `error` | `string \| null` | 错误文案；非空时以横幅（`role="alert"`）显示 |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `open` | `[record: GameRecord]` | 点击某行主体，打开详情 |
| `remove` | `[id: string]` | 点行内「删除」并确认（父用 `@remove`） |
| `clear` | `[]`（无载荷） | 点「🗑 清空历史」并确认（列表为空时按钮禁用） |
| `back` | `[]`（无载荷） | 点「← 返回」回到游戏视图 |

## `HistoryDetail.vue`

单局详情：公开双方数字（`secrets.p1` / `secrets.p2`），复用 `HistoryList` ×2 分红/蓝展示双方完整猜测；顶部时间 + 「胜负·N位·M回合」。可返回列表或删除此局（带 `confirm` 确认）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `record` | `GameRecord` | 单条历史记录（含双方昵称 / 秘密 / 双历史 / 结局） |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `back` | `[]`（无载荷） | 点「← 列表」回到历史列表 |
| `delete` | `[id: string]` | 点「删除此局」并确认（父用 `@delete`，删后回列表） |

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
| 点击/触摸格（或回车/空格） | 打开菜单：假设此位（assumed，替换本列）/ 划除（crossedOut）/ 清除 |
| Esc / 点背板 | 关闭菜单 |
| 重置假设 | 清空本面板 assumptions + crossedOut（回纯事实推理） |
| 折叠条 | 点击展开 / 收起；**默认收起** |

格子颜色对应 `CellState`（7 态，权威说明见 [L4 solver 状态表](./solver.md)）：`available`（普通）/ `eliminated`（灰，事实/联动排除）/ `crossed`（琥珀虚线，手动划除）/ `fixed`（绿实心+✓，事实确定）/ `fixedAssumed`（绿虚线+*，仅当前假设/划除下确定）/ `assumed`（高亮，你的假设）/ `conflict`（红，矛盾）。
