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

通用交接屏：一句提示 + 一个继续按钮。setup 与 playing 复用。

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
| `records` | `GuessRecord[]` | 猜测记录数组（`{ guess, feedback }`） |
| `title` | `string`（可选） | 标题；为空则不渲染 `<h3>` |

**emits**：无。

## `PlayView.vue`

编排 playing 阶段：交接屏 → 猜测输入 + 当前玩家历史（本地 `awaitingHandoff` ref）。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `digits` | `number` | 位数 N，透传给 `GuessInput` |
| `current` | `PlayerId` | 当前轮到谁猜，决定 `playerName`/`opponentName`/取哪份历史 |
| `round` | `number` | 当前回合数，显示于交接屏与回合提示 |
| `validate` | `(value: string) => ValidationResult` | 猜测校验，透传给 `GuessInput` |
| `history` | `{ p1: GuessRecord[]; p2: GuessRecord[] }` | 双方历史；只展示 `history[current]` |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `guess` | `[value: string]` | 当前玩家提交猜测；emit 后本地置 `awaitingHandoff=true` |

## `ResultView.vue`

结束屏：胜负/平局文案、公开双方秘密与完整历史、再来一局。

**props**

| prop | 类型 | 说明 |
|------|------|------|
| `outcome` | `Outcome` | 结局；`draw`→「平局！」，`win`→「玩家1/2 获胜！」 |
| `secrets` | `{ p1: string \| null; p2: string \| null }` | 双方秘密，结束公开 |
| `history` | `{ p1: GuessRecord[]; p2: GuessRecord[] }` | 双方完整历史，分两列展示 |

**emits**

| 事件 | 载荷 | 触发时机 |
|------|------|----------|
| `playAgain` | `[]`（无载荷） | 点「再来一局」（父用 `@play-again`，调 `reset()`） |
