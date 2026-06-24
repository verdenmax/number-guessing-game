# L4 · API · 人机 bot（`src/game/bot.ts`）

> 上层：[L2 UI 层](../L2-components/ui.md) · [L3 人机对战策略](../L3-details/bot-strategy.md) ｜ 源码：`src/game/bot.ts`
>
> 纯函数模块、零 Vue/DOM 依赖。复用 `solver.ts`（候选枚举/过滤）与 `engine.ts` 的 `feedback`，可被 Vitest 穷尽测试。所有随机性经 `rnd` 参数注入（缺省 `Math.random`），便于确定性测试。

## 概览

```typescript
export type BotDifficulty = 'easy' | 'normal' | 'hard'

randomSecret(digits: number, rnd?: () => number): string
// 随机互不相同的 digits 位秘密（Fisher–Yates 洗牌 0-9 取前 digits）。digits ≤ 10。满足 validateSecret。

botGuess(guesses: GuessRecord[], digits: number, difficulty: BotDifficulty, rnd?: () => number): string
// bot(p2) 依据其对玩家秘密的猜测历史 guesses(=state.history.p2) 选下一猜。
```

## 行为细节

- **easy**：忽略候选，随机生成 digits 位（每位 `0-9`，**允许重复**），满足 `validateGuess`。
- **normal**：候选 `C = filterByFacts(enumerateCandidates(digits), guesses)`，从 C 随机取一个；`C` 空（历史自相矛盾）时回退随机。
- **hard**：`C` 空回退随机；`|C| > 150` 取 `C[0]`；否则一步 minimax 取「最坏剩余候选最小」者，平局取候选序最前者。详见 [L3 策略](../L3-details/bot-strategy.md)。

`GuessRecord` 来自 `src/game/types.ts`：`{ guess: string; feedback: number }`（`feedback` 即「正确数目」Bulls）。

## 设计要点

- **engine 不依赖 bot**：bot 只产出「秘密」「猜测」两种字符串，由 `App.vue` 调 `applySecret`/`applyGuess` 喂给纯引擎。
- **复用而非重写**：候选枚举/过滤与推理助手同源（`solver.ts`），口径一致。
- **确定性**：注入固定 `rnd` 即可复现输出，单测无随机抖动。
