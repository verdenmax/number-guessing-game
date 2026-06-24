# 设计：人机对战（bot opponent）

> 日期：2026-06-23 ｜ 分支：`feat/bot-opponent`
> 背景：当前是热座双人猜数字游戏。新增「人机对战」——开局选择「双人对战 / 人机对战」，人机模式下玩家对战一个会用 solver 推理的 bot（三档难度）。复用现成 solver；引擎零改动（bot 由 App 层 watch 驱动）。

## 1. 决策（已确认）

- **三档难度**：简单(纯随机合法猜) / 普通(从候选集随机挑) / 困难(候选集一步 minimax 选最优)。
- **玩家固定先手**：玩家=红方 `p1`，bot=蓝方 `p2`。
- **两侧助手都显示**（与双人一致，玩家能看到 bot 侧推理）——SolverPanel 无需改。
- **bot 加思考延迟**（~0.8s）+「🤖 电脑思考中…」提示。
- **架构方案 A**：App/composable 层 `watch` 驱动，引擎完全不变；新增纯函数 `src/game/bot.ts`。

**我方默认（已随设计确认）**：bot 名字 `🤖 电脑·难度`（如「🤖 电脑·困难」，🤖 内嵌于名字）；pve 对局照常存历史，所有显示名经既有 `sideName`/`names` 自动带 🤖 与真人区分（历史 schema 零改动、渲染组件零改动）；再战回到「模式选择」。

## 2. 现状（已核实）

- 引擎纯函数（`engine.ts`）：`createGame`/`setSecret`/`submitGuess`；`p1` 先猜、`p2` 后猜，双方各猜一次才判（双中=平、单中=胜、皆不中=`round++`）。`feedback(secret,guess)`=bulls。
- `setSecret(state,player,value)`：设一方秘密；两方都设好→`phase='playing'`。
- `validateSecret`：digits 位 + **互不相同**；`validateGuess`：digits 位、**允许重复**。
- solver（`solver.ts`）：`enumerateCandidates(digits)`（缓存，互不相同候选）、`filterByFacts(cands, guesses)`（保留与每条猜测反馈吻合的候选）、`feedback`。
- `useGame`：暴露 `state/phase/current/outcome/config` + `applySecret/applyGuess/reset/checkSecret/checkGuess`。
- `App.vue`：`names` ref、`saveStatus`、`playAgain()`（reset 保留 names）、`view='game'|'history'`；`SetupView`(step p1→handoff→p2)、`PlayView`、`ResultView`、两个 `SolverPanel`。
- `PlayView`：`GuessInput :key="current"`、两个 `HistoryList`、`names?` prop（昵称已接入）、`announceText` 读屏。

## 3. 新增纯函数 `src/game/bot.ts`（零 Vue/DOM 依赖，可穷举单测）

```typescript
import type { GuessRecord } from './types'
import { feedback } from './engine'
import { enumerateCandidates, filterByFacts } from './solver'

export type BotDifficulty = 'easy' | 'normal' | 'hard'

// 随机互不相同的 digits 位秘密（洗牌 0-9 取前 digits）。digits 必须 ≤10。
export function randomSecret(digits: number, rnd: () => number = Math.random): string

// bot（p2）根据它对玩家的猜测历史 guesses(=state.history.p2) 选下一猜。
// 候选 = filterByFacts(enumerate(digits), guesses)：满足历史所有反馈的可能秘密。
export function botGuess(
  guesses: GuessRecord[],
  digits: number,
  difficulty: BotDifficulty,
  rnd: () => number = Math.random,
): string
```

**`randomSecret`**：`['0'..'9']` 洗牌（Fisher–Yates，用 `rnd`），取前 `digits` 拼接。满足 `validateSecret`（互不相同）。

**`botGuess` 各档**：先算候选集 `C = filterByFacts(enumerateCandidates(digits), guesses)`。
- **easy**：忽略 `C`，随机生成 digits 位（每位 `Math.floor(rnd()*10)`，**允许重复**）——满足 `validateGuess`。
- **normal**：从 `C` 随机挑一个（`C[floor(rnd()*C.length)]`）；`C` 空时回退 easy 随机。
- **hard**：
  - `C` 空 → 回退 easy 随机。
  - `|C| > 150` → 取 `C[0]`（开局候选过多，避免 O(n²) 卡顿；随反馈收窄到 ≤150 自动启用 minimax）。
  - `|C| ≤ 150` → **一步 minimax**：对每个候选 `g ∈ C`，把 `C` 中每个可能秘密 `s` 按 `feedback(s, g)` 分桶，记最大桶大小（=猜 `g` 后最坏剩余候选数）；选使「最大桶最小」的 `g`。平局取候选序最前者（确定性）。`g` 只从 `C` 选（既最优又保证是可能真值，能直接猜中）。
  - 注：`feedback===digits`（全中）的桶视作"已赢"——天然属于最小化最坏桶的解，无需特殊处理。

阈值 150 → minimax 最多 `150×150=22500` 次 `feedback`（每次 O(digits)），亚毫秒级、不卡 UI。

## 4. 模式 / 难度状态（types + App）

`src/game/types.ts` 新增：
```typescript
export type GameMode = 'pvp' | 'pve'
```
`BotDifficulty` **单一来源**：定义并导出于 `bot.ts`；`App.vue`/其它从 `bot.ts` import（不在 types 重复定义）。

`App.vue` 新增 ref：
- `gameMode = ref<GameMode | null>(null)`：`null` → 渲染 `ModeSelect`；选定后渲染既有 setup/play/over 流程。
- `botDifficulty = ref<BotDifficulty>('normal')`。
- `botName = computed(() => '🤖 电脑·' + ({ easy: '简单', normal: '普通', hard: '困难' } as const)[botDifficulty.value])`（🤖 内嵌，play/result/history 经 `sideName` 自动显示，渲染层无需改）。

## 5. 新增组件 `src/components/ModeSelect.vue`

- 开局界面：标题 +「双人对战(热座)」「人机对战」两个大按钮；选人机后展开难度选择（简单/普通/困难，默认普通）+「开始」。
- `emit('select', mode: GameMode, difficulty?: BotDifficulty)`。
- a11y：`<h2>` 标题、真 `<button>`、难度用 `<fieldset><legend>` 单选或一组按钮；挂载聚焦首个选项。

## 6. App 接线（watch 驱动，引擎不变）

**模式选择**：`gameMode===null` 时只渲染 `<ModeSelect @select="onSelectMode" />`。`onSelectMode(m, d)` 设 `gameMode=m`、`botDifficulty=d ?? 'normal'`，pve 时 `applyName('p2', botName.value)`（覆盖任何残留的 p2 名）。之后进入既有 setup 流程。

**pve 自动设 bot 秘密**（跳过交接屏）：玩家在 SetupView 设完红方秘密后，
```
watch(() => state.value.secrets.p1, (p1) => {
  if (gameMode.value === 'pve' && p1 && !state.value.secrets.p2 && phase.value === 'setup') {
    applySecret('p2', randomSecret(config.value.digits))
  }
})
```
→ 两方秘密齐 → `phase='playing'`，SetupView 卸载（`phase!=='setup'`），交接屏不显示。

**SetupView pve 适配**：加 `vsBot?: boolean` prop。`vsBot` 时只渲染玩家(p1)步骤、`confirmP1` 后**不**切到 `handoff`（避免在自动设 bot 秘密前闪现交接屏）；昵称提示文案保持（"留空用红方"）。App 给 `<SetupView :vs-bot="gameMode==='pve'">`。

**bot 自动猜**（带延迟 + 思考提示 + 防重入）：
```
const botThinking = ref(false)
let botTimer: ReturnType<typeof setTimeout> | null = null
watch([phase, current], () => {
  clearBotTimer()
  if (gameMode.value === 'pve' && phase.value === 'playing' && current.value === 'p2') {
    botThinking.value = true
    botTimer = setTimeout(() => {
      applyGuess(botGuess(state.value.history.p2, config.value.digits, botDifficulty.value))
      botThinking.value = false
      botTimer = null
    }, 800)
  } else {
    botThinking.value = false
  }
})
```
- `clearBotTimer()`：清 `botTimer` 并 `botThinking=false`。
- `playAgain()` / 模式切换 / `onUnmounted` 调 `clearBotTimer()`，防再战串台或泄漏。
- 玩家(p1)猜后 `current→p2` 触发 watch → bot 思考 → 出招 → 引擎结算（单中/双中/`round++`，`current→p1`）。

**PlayView bot 回合**：加 `botTurn?: boolean` prop（App 传 `gameMode==='pve' && current==='p2'`）。`botTurn` 时**隐藏玩家 `GuessInput`**、改显示 `<p class="bot-thinking">🤖 电脑思考中…</p>`；玩家回合(p1)正常显示输入框。bot 的猜测照常进蓝方 `HistoryList` + 已有 `announceText` 读屏播报（用 `电脑·难度` 名）。

## 7. 历史 / 结果 / 再战

- **历史**：pve 对局照常 `buildGameRecord`（`names.p2='🤖 电脑·难度'`，🤖 已内嵌 bot 名）。`HistoryView`/`HistoryList`/`ResultView` 经既有 `sideName(_, names)` 自动显示带 🤖 的 bot 名——**历史 schema 零改动、这些渲染组件零改动**（避免逐组件加前缀，也不会误标 pvp 中自起名含「电脑」的真人）。
- **结果**：`ResultView` 照常揭晓双方数字（含 bot 的）。
- **再战**：`playAgain()` 末尾 `gameMode.value = null`（回到 ModeSelect）+ `clearBotTimer()`；**`names` 保留**——pvp 再战回 ModeSelect→选双人后 `SetupView` 仍预填昵称，延续既有「保留昵称再战」语义；pve 再次选模式时 `onSelectMode` 用 `applyName('p2', botName)` 覆盖蓝方名（若从 pve 切回 pvp，蓝方残留 bot 名属边缘路径，用户可在 setup 改写，无害）。

## 8. 测试

- **`bot.ts` 单测（注入确定性 `rnd`）**：
  - `randomSecret`：长度=digits、每位 0-9、互不相同；注入 rnd 得确定输出；digits=10 仍互异。
  - `botGuess` easy：digits 位、字符合法（可重复）。
  - `botGuess` normal：结果 ∈ 候选集（构造历史使候选收窄，断言不选被排除的）；候选空回退合法猜。
  - `botGuess` hard：小案例断言选「最坏剩余最小」的猜测（如构造 |C| 小、已知最优分割）；`|C|>150` 取候选首个；候选空回退。
  - 确定性：相同 rnd+输入恒等输出。
- **App pve 集成（fake timers）**：
  - 选「人机·普通」→ 玩家设红方秘密 → bot 秘密自动设、phase=playing（不显示交接屏）。
  - 玩家猜 → `current=p2` → `vi.advanceTimersByTime(800)` → bot 自动猜进蓝方历史、`current` 回 p1。
  - 一局到 over → ResultView 揭晓 bot 数字。
  - 两侧 SolverPanel 都渲染（pve）。
  - `botTurn` 时 PlayView 隐藏输入、显示思考提示。
  - 再战 → 回 ModeSelect、bot timer 清除（不串台）。
  - **更新既有 App「换数字再战保留昵称」测试**：playAgain 后现在先到 `ModeSelect`（非直达 SetupView）；改为 playAgain→选双人→断言 SetupView 昵称仍预填。
- **ModeSelect 单测**：渲染两模式按钮；选人机展开难度；`emit('select', 'pve', 'hard')`。
- 全量回归：现有 270 测试不回归；`vue-tsc` + build 干净。

## 9. 影响面 / 风险

- 新增：`src/game/bot.ts`(+test)、`src/components/ModeSelect.vue`(+test)。
- 改：`App.vue`（模式状态/ModeSelect/watch 驱动/setup 接线/思考提示/再战；**含更新既有「换数字再战保留昵称」测试以适配 ModeSelect 中转**）、`SetupView.vue`（`vsBot` prop）、`PlayView.vue`（`botTurn` prop + 思考提示）、`types.ts`（`GameMode`）、`style.css`（ModeSelect + `.bot-thinking`）、文档（L2/L3/L4 + README）。`HistoryView.vue`/`HistoryList.vue`/`ResultView.vue` 因 🤖 内嵌 bot 名而**零改动**（经既有 `sideName` 自动显示）。
- 风险：bot timer 防重入/再战串台（统一 `clearBotTimer`）；困难档性能（阈值 150 保护）；setup→playing 时序（自动设 bot 秘密用 watch，交接屏不闪现靠 `vsBot` 不进 handoff）；玩家不能在 bot 回合输入（`botTurn` 隐藏输入框）。
- 顺序：bot.ts（纯逻辑，先）→ ModeSelect → App 接线（模式选择 + 自动设秘密 + 自动猜 + 思考提示）→ SetupView/PlayView 适配 → 历史🤖 → 文档 → 验证部署。

## 10. 验收

开局可选双人/人机；人机下选难度、玩家设秘密后 bot 自动设秘密并开打；轮到 bot 显示「思考中」并在 ~0.8s 后出招、用 solver 推理（普通不重复犯错、困难残局精准）；结果揭晓 bot 数字；历史区分 vs 电脑；再战回模式选择、不串台。现有 270 测试 + 新增全绿、构建干净、线上生效。
