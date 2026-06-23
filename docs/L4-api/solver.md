# L4 · API · 推理引擎（`src/game/solver.ts`）

> 上层：[L2 UI 层](../L2-components/ui.md) · [L3 推理引擎细节](../L3-details/solver.md) ｜ 源码：`src/game/solver.ts`
>
> 全部签名以 `src/game/solver.ts` 实际导出为准。solver 是**纯函数模块、零 Vue/DOM 依赖**，仅复用 `engine.ts` 的 `feedback()`，与对局引擎（engine/useGame）完全独立，可被 Vitest 穷尽测试。

## 概览

```typescript
enumerateCandidates(digits: number): string[]
// 全部 digits 位、每位 0-9、互不相同的候选字符串。digits=4 → 5040；digits=1 → 10。

filterByFacts(candidates: string[], guesses: GuessRecord[]): string[]
// 复用 engine.feedback，保留对每条猜测记录都吻合的候选。

solve(input: SolverInput): Grid
// 逐格状态推导：候选 → 事实过滤 → what-if（假设/划除）→ 每格七状态。
remainingCount(input: SolverInput): { remaining: number; candidates: string[] }
// 剩余 what-if 候选数；candidates 在 ≤8 时给出列表，否则为空。
basicSolve(input: SolverInput): Grid
// 基础模式：只排除（反馈=0 + 假设格行/列），不产生 fixed；与 solve 同签名可互换。
```

## 类型定义

```typescript
export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'fixedAssumed' | 'assumed' | 'conflict'

export interface SolverInput {
  digits: number
  guesses: GuessRecord[]            // 该方对对方的猜测历史（事实层）
  assumptions: (number | null)[]    // 长度 = digits，每位假设值，null = 未假设
  crossedOut: Set<string>           // 手动划除，键 `${pos}-${digit}`（如 "0-5"）
}

export type Grid = CellState[][]    // grid[pos][digit]，digits 列 × 10 行
```

`GuessRecord` 来自 `src/game/types.ts`：`{ guess: string; feedback: number }`（`feedback` 即「正确数目」Bulls）。

| 状态 | 含义 | 视觉 |
|------|------|------|
| `available` | 仍可能（默认） | 普通 |
| `eliminated` | 被排除：事实无此 / 联动排除 | 灰 |
| `crossed` | 手动划除（点击格子→菜单「划除」），仅标记、不参与推理 | 琥珀虚线 |
| `fixed` | 事实确定：无需假设，仅凭事实即唯一 | 绿实心 + ✓ |
| `fixedAssumed` | 假设下确定：仅在当前假设/划除下唯一 | 绿虚线 + * |
| `assumed` | 用户假设且成立 | 高亮 |
| `conflict` | 用户假设但与现有约束矛盾 | 红 |

---

## `enumerateCandidates(digits)`

| | |
|---|---|
| **签名** | `enumerateCandidates(digits: number): string[]` |
| **入参** | `digits` —— 位数 N |
| **返回** | 全部长度 `digits`、每位互不相同的数字字符串（字典序，回溯生成） |

枚举即真值的「全集」。`digits=4 → 5040`（= 10·9·8·7），`digits=1 → 10`。内部用回溯：`used[0..9]` 标记已用数字，凑满 `digits` 位即收录。

```typescript
// 简化自源码
function recurse() {
  if (current.length === digits) { results.push(current.join('')); return }
  for (let d = 0; d < 10; d++) {
    if (used[d]) continue
    used[d] = true; current.push(String(d))
    recurse()
    current.pop(); used[d] = false
  }
}
```

```typescript
enumerateCandidates(1).length  // 10
enumerateCandidates(4).length  // 5040
enumerateCandidates(2)         // ['01','02',...,'09','10','12',...]
```

---

## `filterByFacts(candidates, guesses)`

| | |
|---|---|
| **签名** | `filterByFacts(candidates: string[], guesses: GuessRecord[]): string[]` |
| **入参** | `candidates` 候选全集；`guesses` 该方猜测历史 |
| **返回** | 保留对**每条**记录都满足 `feedback(c, g.guess) === g.feedback` 的候选 |

把「逻辑上仍可能的对方秘密数」筛出来。复用 `engine.feedback`，**不重写规则**。

```typescript
return candidates.filter((c) =>
  guesses.every((g) => feedback(c, g.guess) === g.feedback),
)
```

```typescript
// 猜 0123 → 正确数目 1：只保留与 0123 恰好 1 位吻合的候选
filterByFacts(enumerateCandidates(4), [{ guess: '0123', feedback: 1 }])
// 空历史 → 原样返回全部候选
filterByFacts(enumerateCandidates(4), [])  // 5040
```

---

## `solve(input)`

| | |
|---|---|
| **签名** | `solve(input: SolverInput): Grid` |
| **返回** | `Grid` —— `grid[pos][digit]` 的二维 `CellState` 数组（`digits` 列 × 10 行） |

### 流程

1. `factPossible = filterByFacts(enumerateCandidates(digits), guesses)` —— 事实层仍可能集合。
2. `whatif = factPossible.filter(...)` —— 再叠加用户约束：
   - 对每个**有效**假设位（`a != null && a >= 0 && a <= 9`）要求 `c[i] === String(a)`；
   - 对每个划除键 `"p-d"` 要求 `c[p] !== d`。
3. 预计算每列在 `factPossible` / `whatif` 中出现过的数字集合。
4. 逐格按下方优先级定状态。

### 每格状态推导（与源码一致，自上而下短路）

```text
设 d = String(digit)
posDigitOK  = whatif   中第 pos 位出现过 d
factHasIt   = factPossible 中第 pos 位出现过 d
colOnlyThis = whatif 第 pos 位出现过的数字集合恰为 { d }
factColOnlyThis = factPossible 第 pos 位出现过的数字集合恰为 { d }
whatifEmpty = whatif 为空

if assumptions[pos] === digit:
    state = (posDigitOK && !whatifEmpty) ? 'assumed' : 'conflict'
elif crossedOut.has(`${pos}-${digit}`):
    state = 'crossed'
elif !factHasIt:
    state = 'eliminated'        // 事实排除
elif colOnlyThis:
    state = factColOnlyThis ? 'fixed' : 'fixedAssumed'   // 事实唯一→fixed；仅假设下唯一→fixedAssumed
elif !posDigitOK:
    state = 'eliminated'        // 联动排除
else:
    state = 'available'
```

> 注意优先级：**该格是否为本列假设值** 最优先，因此被假设的格永远显示 `assumed` 或 `conflict`，不会被判成 `crossed`/`fixed`/`eliminated`。

### 健壮性

- 假设数组可稀疏或越界：`null`/`undefined`/超出 0-9 的值都被 `a != null && a >= 0 && a <= 9` 挡掉，视作「无假设」，**不会误清空 `whatif`**。
- 猜测允许重复数字（如 `0000`），候选互不相同——`feedback` 照常计算，事实过滤不受影响。
- 纯函数：相同输入恒得相同 `Grid`。

```typescript
solve({ digits: 4, guesses: [], assumptions: [null,null,null,null], crossedOut: new Set() })
// 无事实无假设 → 每格 'available'（除非某列因 digits 约束天然收窄）

solve({ digits: 4,
        guesses: [{ guess: '0000', feedback: 0 }],
        assumptions: [null,null,null,null], crossedOut: new Set() })
// 正确数目 0 → 每列的数字 0 均 'eliminated'
```

更多推导示例与流程图见 [L3 推理引擎细节](../L3-details/solver.md)。

## `remainingCount(input)`

| | |
|---|---|
| **签名** | `remainingCount(input: SolverInput): { remaining: number; candidates: string[] }` |
| **返回** | `remaining` = `whatif` 候选数；`candidates` 在 `remaining ≤ 8` 时为候选字符串数组，否则 `[]` |

与 `solve` 共用 `computeFactAndWhatif`（事实过滤 + 假设/划除叠加）。供 SolverPanel 在智能模式显示「剩 N 个可能」（≤8 时列出）。`whatif` 为空（假设矛盾）时 `remaining = 0`、`candidates = []`。

## `basicSolve(input)`

| | |
|---|---|
| **签名** | `basicSolve(input: SolverInput): Grid` |
| **返回** | `Grid` —— 与 `solve` 同构的 `CellState` 二维数组；**与 `solve` 同签名可互换** |

基础模式只做「排除」，**绝不自动判 `fixed`**。先构造排除集 `eliminated`，再逐格按优先级定状态。

### 排除集来源

1. **规则①（反馈=0）**：对每条 `feedback === 0` 的猜测，其每一位 `i` 的数字加入排除键 `` `${i}-${Number(guess[i])}` ``。
2. **规则②（假设的行/列）**：对每个**有效**假设位 `(p, d)`（`d != null && d >= 0 && d <= 9`）：同一数字 `d` 在**其它每个位置**（行排除 `` `${p2}-${d}` ``, `p2 !== p`）、同一位置 `p` 的**其它每个数字**（列排除 `` `${p}-${d2}` ``, `d2 !== d`）都加入排除集；不排除假设格自身。

### 每格状态推导（与源码一致，假设优先，与 `solve` 对齐）

```text
key = `${pos}-${digit}`
if assumptions[pos] === digit:
    state = eliminated.has(key) ? 'conflict' : 'assumed'
elif crossedOut.has(key):
    state = 'crossed'
elif eliminated.has(key):
    state = 'eliminated'
else:
    state = 'available'
```

> 优先级与 `solve` 一致：**假设最优先**，故被假设的格只会是 `assumed`/`conflict`，且手动划除不会掩盖矛盾。基础模式**永不产生 `fixed`**。
