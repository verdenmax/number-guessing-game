# L4 · API · `engine.ts`

> 上层：[L2 引擎层](../L2-components/engine.md) · [L3 状态机](../L3-details/state-machine.md) ｜ 类型见 [types](#相关类型)
>
> 源码：`src/game/engine.ts`。所有函数为纯函数；修改状态的函数返回**全新的不可变 `GameState`**。

## `feedback(secret, guess) → number`

计算 Bulls 提示：逐位比较，统计「位置且数字都正确」的个数。

| 参数 | 类型 | 说明 |
|------|------|------|
| `secret` | `string` | 答案（被猜方的秘密数） |
| `guess` | `string` | 猜测值 |
| **返回** | `number` | 相等位置数（0 .. `secret.length`） |

- **语义**：`Σ [secret[i] === guess[i]]`，逐**字符**比较，不转数字。
- **抛错**：无。假定两串等长（由上层 `validate` 保证）。

```typescript
feedback('0891', '0290') // → 2   位置1(0✓)、位置3(9✓)
feedback('1234', '4321') // → 0
feedback('1234', '1234') // → 4   达到 digits 即命中
feedback('1234', '1111') // → 1   猜测允许重复
```

## `createGame(config?) → GameState`

创建初始游戏状态，进入 `setup` 阶段、等 P1。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | `Partial<GameConfig>`（可选，默认 `{}`） | `config.digits` 位数；缺省为 `4`（`DEFAULT_DIGITS`） |
| **返回** | `GameState` | 初始状态（见下） |

- **抛错**：`digits` 非 1..10 的整数时抛 `Error('digits 必须是 1 到 10 之间的整数')`。
- **初始状态**：

```typescript
{
  config: { digits },
  phase: 'setup',
  secrets: { p1: null, p2: null },
  current: 'p1',
  round: 1,
  history: { p1: [], p2: [] },
  pendingHits: { p1: false, p2: false },
  outcome: { kind: 'ongoing' },
}
```

```typescript
createGame()            // digits=4
createGame({ digits: 5 })
createGame({ digits: 0 })   // throws
createGame({ digits: 11 })  // throws
```

## `setSecret(state, player, value) → GameState`

为某玩家设置秘密数，返回新状态。两人都设置后阶段转为 `playing`。

| 参数 | 类型 | 说明 |
|------|------|------|
| `state` | `GameState` | 当前状态（须 `phase === 'setup'`） |
| `player` | `PlayerId` | `'p1'` 或 `'p2'` |
| `value` | `string` | 秘密数（须通过 `validateSecret`） |
| **返回** | `GameState` | 写入 `secrets[player]`；若两人都已设置则 `phase='playing'`，并重置 `current='p1'`、`round=1` |

- **抛错**：
  - `phase !== 'setup'` → `Error('只能在 setup 阶段设置秘密数')`
  - `secrets[player] !== null`（重复设置）→ `Error('${player} 的秘密数已设置')`
  - `value` 非法 → `Error('非法秘密数：${error}')`（`error` 来自 `validateSecret`）

```typescript
let s = createGame()            // phase=setup
s = setSecret(s, 'p1', '1234')  // phase 仍 setup，secrets.p1='1234'
s = setSecret(s, 'p2', '5678')  // phase=playing, current=p1, round=1
```

## `submitGuess(state, value) → GameState`

当前玩家（`state.current`）提交一次对**对手**秘密数的猜测：算提示、记历史；P1 猜后切到 P2，P2 猜后回合末结算。

| 参数 | 类型 | 说明 |
|------|------|------|
| `state` | `GameState` | 当前状态（须 `phase === 'playing'`） |
| `value` | `string` | 猜测值（须通过 `validateGuess`） |
| **返回** | `GameState` | 见下「结算逻辑」 |

- **抛错**：
  - `phase !== 'playing'` → `Error('只能在 playing 阶段猜测')`
  - `value` 非法 → `Error('非法猜测：${error}')`（`error` 来自 `validateGuess`）

**结算逻辑**（详见 [L3 状态机](../L3-details/state-machine.md)）：

```
fb = feedback(secrets[opponent], value); hit = (fb === digits)
history[player] 追加 { guess: value, feedback: fb }
pendingHits[player] = hit

若 player == 'p1': 仅 current='p2'（不结算）
否则（player == 'p2'）回合末四分支：
  p1Hit && p2Hit → phase='over', outcome={kind:'draw'}
  仅 p1Hit       → phase='over', outcome={kind:'win', winner:'p1'}
  仅 p2Hit       → phase='over', outcome={kind:'win', winner:'p2'}
  都没中          → round+1, pendingHits 重置, current='p1'
```

```typescript
let s = /* playing, current=p1 */
s = submitGuess(s, '5678')   // 记录 p1 猜测，current → p2
s = submitGuess(s, '1234')   // p2 猜测后回合末结算
```

## 相关类型

```typescript
interface GameConfig { digits: number }
type Phase = 'setup' | 'playing' | 'over'
type PlayerId = 'p1' | 'p2'
interface GuessRecord { guess: string; feedback: number }
type Outcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winner: PlayerId }
  | { kind: 'draw' }
interface GameState {
  config: GameConfig
  phase: Phase
  secrets: { p1: string | null; p2: string | null }
  current: PlayerId
  round: number
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  pendingHits: { p1: boolean; p2: boolean }
  outcome: Outcome
}
```
