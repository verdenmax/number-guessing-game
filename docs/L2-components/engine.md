# L2 · 引擎层（`src/game/`）

> 上层：[L1 概览](../L1-overview.md) ｜ 下钻：[L3 状态机](../L3-details/state-machine.md) · [L4 engine API](../L4-api/engine.md) · [L4 validate API](../L4-api/validate.md)

## 定位

引擎层是整个游戏的**核心逻辑**，由**纯函数**与**不可变状态机**构成，**零 Vue 依赖**——只用 TypeScript，可被 Vitest 独立、穷尽地测试。它不知道有界面、不知道有交接屏，只认两次 `setSecret` 与若干 `submitGuess`。

```
┌───────── src/game/ （零 Vue 依赖） ─────────┐
│  types.ts     纯类型定义，无运行时代码      │
│  validate.ts  输入校验（形状/唯一性）       │
│  engine.ts    算提示(Bulls) + 回合状态机    │
└─────────────────────────────────────────────┘
        ▲ 被 useGame() 调用，被 *.test.ts 直接测试
```

## 三个文件的职责

| 文件 | 职责 | 关键导出 |
|------|------|----------|
| `types.ts` | 定义全部数据结构与联合类型，**无运行时逻辑**。 | `GameConfig` `Phase` `PlayerId` `GuessRecord` `Outcome` `GameState` `ValidationResult` |
| `validate.ts` | 校验秘密数与猜测的合法性，返回 `ValidationResult`；不抛错。内部私有 `checkShape` 统一长度与字符校验。 | `validateSecret` `validateGuess` |
| `engine.ts` | 计算 Bulls 提示、创建与推进不可变状态机、回合末结算判胜负。非法调用时**抛错**（防御性断言）。 | `feedback` `createGame` `setSecret` `submitGuess` |

## 对外导出函数清单

```typescript
// engine.ts
feedback(secret: string, guess: string): number
createGame(config?: Partial<GameConfig>): GameState
setSecret(state: GameState, player: PlayerId, value: string): GameState
submitGuess(state: GameState, value: string): GameState

// validate.ts
validateSecret(value: string, config: GameConfig): ValidationResult
validateGuess(value: string, config: GameConfig): ValidationResult
```

逐函数签名、参数、返回、抛错条件见 [L4 engine API](../L4-api/engine.md) 与 [L4 validate API](../L4-api/validate.md)。

## 核心：`feedback`（Bulls）

最易测、是规则核心的纯函数——逐位比较相等的位置数：

```typescript
export function feedback(secret: string, guess: string): number {
  let bulls = 0
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) bulls++   // 全程按字符比较
  }
  return bulls
}
```

## 关键约定

### 1. 状态不可变（immutable）

每个修改状态的函数都返回**全新对象**，绝不就地改 `state`：

```typescript
// setSecret / submitGuess 内部统一用展开生成新对象
const secrets = { ...state.secrets, [player]: value }
return { ...state, secrets, phase: bothSet ? 'playing' : 'setup', ... }
```

好处：利于 Vue 响应式 diff、单元测试可对比快照、为未来「回放 / 悔棋」留扩展点。

### 2. 全程字符串，绝不 `parseInt`

秘密数与猜测**一律以字符串存储与逐字符比较**，从不转数字——否则 `0891`、`0011` 等前导 0 会被破坏。`feedback` 用 `secret[i] === guess[i]` 比较字符；`validate` 用正则 `/^[0-9]+$/` 与 `Set` 判断，都不涉及数值转换。

### 3. 防御性断言

引擎对**编程错误**（非用户错误）直接抛 `Error`：

| 函数 | 抛错条件 | 文案 |
|------|----------|------|
| `createGame` | `digits` 非 1..10 整数 | `digits 必须是 1 到 10 之间的整数` |
| `setSecret` | 非 `setup` 阶段 | `只能在 setup 阶段设置秘密数` |
| `setSecret` | 该玩家秘密已设置 | `${player} 的秘密数已设置` |
| `setSecret` | 秘密数非法 | `非法秘密数：${error}` |
| `submitGuess` | 非 `playing` 阶段 | `只能在 playing 阶段猜测` |
| `submitGuess` | 猜测非法 | `非法猜测：${error}` |

用户可见的校验错误走 `validate*` 的 `ValidationResult.error`（不抛错）；抛错只用于保护引擎被错误地调用。
