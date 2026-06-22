# 推理提示助手（Solver Panel）+ 展示优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为猜数字游戏增加一个推理提示助手——左右两侧分别服务红蓝双方，4 列×10 格基于猜测历史自动枚举推理对方秘密数（自动置灰/确定），并支持点击假设、右键划除做实时 what-if 联动推演与矛盾标红；同时打磨整体展示。

**Architecture:** 纯函数 solver 模块（`src/game/solver.ts`，零 Vue，复用 engine.feedback）枚举全部「N 位互不相同」候选→事实过滤→叠加假设/划除→逐格状态推导；`SolverPanel.vue` 红蓝各一实例渲染网格与交互；App 在 playing 阶段排成三栏。solver 与对局引擎完全独立。

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + @vue/test-utils（既有栈）。

> **验证门禁：** 每个任务都要跑 `npm run test`（vitest）**和** `npm run build`（vue-tsc 类型检查 + vite 构建），两者都必须绿——vitest 不做类型检查，类型错误只有 build 能抓到。

---

## 文件结构（File Structure）

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/game/solver.ts` | 新增 | 纯函数推理：`enumerateCandidates` / `filterByFacts` / `solve`，复用 `engine.feedback` |
| `src/game/solver.test.ts` | 新增 | solver 穷尽单测 |
| `src/components/SolverPanel.vue` | 新增 | 4×10 网格面板 + 假设/划除/重置/折叠交互（红蓝复用） |
| `src/components/SolverPanel.test.ts` | 新增 | 面板交互测试 |
| `src/App.vue` | 修改 | playing 阶段三栏布局，左右挂 SolverPanel |
| `src/App.test.ts` | 修改 | 断言 playing 阶段渲染两个 SolverPanel |
| `src/style.css` | 修改 | 三栏 `.table`、助手网格、格子状态配色、展示优化 |
| `docs/L1-overview.md` 等 L1-L4 + `README.md` | 修改/新增 | 同步助手功能、三栏、红蓝改版；新增 solver 的 L3/L4 文档 |

## 任务总览

- **Task 1** `enumerateCandidates()` 枚举互不相同候选 — TDD
- **Task 2** `filterByFacts()` 事实过滤（复用 feedback）— TDD
- **Task 3** `solve()` 逐格状态推导（置灰/确定/假设/矛盾/联动）— TDD（核心）
- **Task 4** `SolverPanel.vue` 渲染网格 + 折叠 — TDD
- **Task 5** `SolverPanel.vue` 交互（假设/划除/重置）— TDD
- **Task 6** App 三栏整合（playing 挂红蓝助手）— TDD
- **Task 7** 样式：三栏布局 + 格子状态配色 + 展示优化
- **Task 8** 文档 L1-L4 + README 同步（含 solver 文档与红蓝改版补更）

> 任务详情见下。每个任务遵循 TDD：写失败测试 → 跑测试看失败 → 最小实现 → 跑测试看通过 →（build 门禁）→ 提交。

---

### Task 1: `enumerateCandidates()` 枚举互不相同候选 — TDD

**Files:**
- Create: `src/game/solver.ts`
- Create: `src/game/solver.test.ts`

- [ ] **Step 1: 写失败测试 `src/game/solver.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { enumerateCandidates } from './solver'

describe('enumerateCandidates', () => {
  it('digits=1 返回 0-9 共 10 个', () => {
    expect(enumerateCandidates(1)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('digits=4 返回 5040 个（10*9*8*7）', () => {
    expect(enumerateCandidates(4)).toHaveLength(5040)
  })

  it('每个候选长度为 digits 且各位互不相同', () => {
    for (const c of enumerateCandidates(4)) {
      expect(c).toHaveLength(4)
      expect(new Set(c).size).toBe(4)
    }
  })

  it('全部候选唯一且只含数字字符', () => {
    const all = enumerateCandidates(3)
    expect(new Set(all).size).toBe(all.length)
    expect(all.every((c) => /^[0-9]+$/.test(c))).toBe(true)
  })

  it('digits=2 返回 90 个（10*9）', () => {
    expect(enumerateCandidates(2)).toHaveLength(90)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— 找不到模块 `./solver` 或 `enumerateCandidates` 未定义。

- [ ] **Step 3: 实现 `src/game/solver.ts`**

```typescript
export function enumerateCandidates(digits: number): string[] {
  const results: string[] = []
  const used = new Array<boolean>(10).fill(false)
  const current: string[] = []

  function recurse(): void {
    if (current.length === digits) {
      results.push(current.join(''))
      return
    }
    for (let d = 0; d < 10; d++) {
      if (used[d]) continue
      used[d] = true
      current.push(String(d))
      recurse()
      current.pop()
      used[d] = false
    }
  }

  recurse()
  return results
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，enumerateCandidates 全部用例通过。

- [ ] **Step 5: 类型检查 + 构建门禁**

Run: `npm run build`
Expected: vue-tsc 无类型错误，vite 构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/game/solver.ts src/game/solver.test.ts
git commit -m "feat: solver enumerateCandidates 枚举互不相同候选

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: `filterByFacts()` 事实过滤（复用 feedback）— TDD

**Files:**
- Modify: `src/game/solver.ts`
- Modify: `src/game/solver.test.ts`

> `filterByFacts` 用「每条猜测的正确数目」过滤候选：只保留对每条历史猜测 `feedback(候选, 猜测) === 记录的 feedback` 的候选。复用 `engine.ts` 已实现并测试过的 `feedback`，不重写规则。

- [ ] **Step 1: 在 `solver.test.ts` 追加测试**

将顶部 import 行改为：
```typescript
import { enumerateCandidates, filterByFacts } from './solver'
import type { GuessRecord } from './types'
```

在文件末尾追加：
```typescript
describe('filterByFacts', () => {
  it('无猜测时返回全部候选', () => {
    const all = enumerateCandidates(4)
    expect(filterByFacts(all, [])).toHaveLength(5040)
  })

  it('猜测 0000 正确数目 0 → 排除任何含 0 的候选', () => {
    const all = enumerateCandidates(4)
    const facts: GuessRecord[] = [{ guess: '0000', feedback: 0 }]
    const filtered = filterByFacts(all, facts)
    expect(filtered.every((c) => !c.includes('0'))).toBe(true)
    expect(filtered.length).toBeGreaterThan(0)
  })

  it('真实秘密数始终保留在候选集中', () => {
    const secret = '1234'
    const all = enumerateCandidates(4)
    const facts: GuessRecord[] = [
      { guess: '1200', feedback: 2 },
      { guess: '5634', feedback: 2 },
      { guess: '1239', feedback: 3 },
    ]
    const filtered = filterByFacts(all, facts)
    expect(filtered).toContain(secret)
  })

  it('与正确数目矛盾的候选被滤除', () => {
    const all = enumerateCandidates(4)
    // 猜 1234 得 4（完全猜中）→ 候选集只剩 1234
    const filtered = filterByFacts(all, [{ guess: '1234', feedback: 4 }])
    expect(filtered).toEqual(['1234'])
  })

  it('多条事实取交集', () => {
    const all = enumerateCandidates(4)
    const filtered = filterByFacts(all, [
      { guess: '1234', feedback: 2 },
      { guess: '1256', feedback: 2 },
    ])
    // 所有保留候选必须同时满足两条
    for (const c of filtered) {
      let m1 = 0
      for (let i = 0; i < 4; i++) if (c[i] === '1234'[i]) m1++
      let m2 = 0
      for (let i = 0; i < 4; i++) if (c[i] === '1256'[i]) m2++
      expect(m1).toBe(2)
      expect(m2).toBe(2)
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— `filterByFacts` 未导出。

- [ ] **Step 3: 在 `solver.ts` 实现 `filterByFacts`**

在文件顶部加 import，并追加实现：
```typescript
import { feedback } from './engine'
import type { GuessRecord } from './types'

export function filterByFacts(candidates: string[], guesses: GuessRecord[]): string[] {
  return candidates.filter((c) => guesses.every((g) => feedback(c, g.guess) === g.feedback))
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: 构建门禁**

Run: `npm run build`
Expected: 无类型错误，构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/game/solver.ts src/game/solver.test.ts
git commit -m "feat: solver filterByFacts 事实过滤（复用 engine.feedback）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: `solve()` 逐格状态推导（核心）— TDD

**Files:**
- Modify: `src/game/solver.ts`
- Modify: `src/game/solver.test.ts`

> 这是功能核心。`solve` 输入 `{ digits, guesses, assumptions, crossedOut }`，输出 `Grid`（`digits` 列 × 10 行的 `CellState`）。状态语义见下表。

| 状态 | 含义 | 触发条件（按优先级从上到下）|
|------|------|------|
| `assumed` | 用户假设且成立 | `assumptions[pos]===digit` 且 what-if 候选集中存在 `c[pos]===digit` |
| `conflict` | 矛盾 | ① `assumptions[pos]===digit` 但 what-if 中无 `c[pos]===digit`；② what-if 整体为空时，所有已假设格 |
| `eliminated` | 被排除（灰/划除）| 手动划除；或事实候选集中该位无此数字；或被其它假设/划除联动排除 |
| `fixed` | 唯一确定（绿）| what-if 候选中该列 `pos` 位只可能是这一个数字 |
| `available` | 可用（默认）| 其余 |

- [ ] **Step 1: 在 `solver.test.ts` 追加测试**

将顶部 import 行改为：
```typescript
import { enumerateCandidates, filterByFacts, solve } from './solver'
import type { GuessRecord } from './types'
import type { SolverInput } from './solver'
```

在文件末尾追加（`baseInput` 构造无假设无划除的输入）：
```typescript
function baseInput(over: Partial<SolverInput> = {}): SolverInput {
  return {
    digits: 4,
    guesses: [],
    assumptions: [null, null, null, null],
    crossedOut: new Set<string>(),
    ...over,
  }
}

describe('solve', () => {
  it('返回 digits 列 × 10 行的网格', () => {
    const grid = solve(baseInput())
    expect(grid).toHaveLength(4)
    for (const col of grid) expect(col).toHaveLength(10)
  })

  it('无任何信息时所有格为 available', () => {
    const grid = solve(baseInput())
    for (const col of grid) for (const s of col) expect(s).toBe('available')
  })

  it('猜 0000 正确数目 0 → 数字 0 在所有列 eliminated', () => {
    const grid = solve(baseInput({ guesses: [{ guess: '0000', feedback: 0 }] }))
    for (let pos = 0; pos < 4; pos++) {
      expect(grid[pos][0]).toBe('eliminated')
    }
  })

  it('完全确定时每列正确数字为 fixed', () => {
    // 猜 1234 得 4 → 候选只剩 1234 → 各位对应数字 fixed
    const grid = solve(baseInput({ guesses: [{ guess: '1234', feedback: 4 }] }))
    expect(grid[0][1]).toBe('fixed')
    expect(grid[1][2]).toBe('fixed')
    expect(grid[2][3]).toBe('fixed')
    expect(grid[3][4]).toBe('fixed')
    // 同列其它数字 eliminated
    expect(grid[0][2]).toBe('eliminated')
  })

  it('用户假设成立 → assumed', () => {
    // 无事实约束，假设 pos0 = 5；5 在 pos0 仍可能 → assumed
    const grid = solve(baseInput({ assumptions: [5, null, null, null] }))
    expect(grid[0][5]).toBe('assumed')
  })

  it('假设联动收窄其它列：假设 pos0=5 → pos1..3 的 5 变 eliminated', () => {
    // 因为互不相同，pos0 既然假设是 5，其它位不可能是 5
    const grid = solve(baseInput({ assumptions: [5, null, null, null] }))
    expect(grid[1][5]).toBe('eliminated')
    expect(grid[2][5]).toBe('eliminated')
    expect(grid[3][5]).toBe('eliminated')
  })

  it('矛盾假设 → 相关假设格 conflict', () => {
    // 假设 pos0=1 且 pos1=1：互不相同使 what-if 为空 → 两格 conflict
    const grid = solve(baseInput({ assumptions: [1, 1, null, null] }))
    expect(grid[0][1]).toBe('conflict')
    expect(grid[1][1]).toBe('conflict')
  })

  it('假设与事实矛盾 → conflict', () => {
    // 事实：猜 1234 得 4 → 秘密就是 1234；假设 pos0=9 与之矛盾
    const grid = solve(
      baseInput({
        guesses: [{ guess: '1234', feedback: 4 }],
        assumptions: [9, null, null, null],
      }),
    )
    expect(grid[0][9]).toBe('conflict')
  })

  it('手动划除 → eliminated', () => {
    const grid = solve(baseInput({ crossedOut: new Set(['0-7']) }))
    expect(grid[0][7]).toBe('eliminated')
  })

  it('划除联动：划掉 pos0 除某值外所有 → 余下值 fixed', () => {
    // 划掉 pos0 的 0..8（保留 9）→ pos0 只能是 9 → fixed
    const crossed = new Set<string>()
    for (let d = 0; d <= 8; d++) crossed.add(`0-${d}`)
    const grid = solve(baseInput({ crossedOut: crossed }))
    expect(grid[0][9]).toBe('fixed')
  })

  it('digits=1 网格为 1 列', () => {
    const grid = solve(baseInput({ digits: 1, assumptions: [null] }))
    expect(grid).toHaveLength(1)
    expect(grid[0]).toHaveLength(10)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— `solve` / `SolverInput` 未导出。

- [ ] **Step 3: 在 `solver.ts` 实现类型与 `solve`**

在文件顶部类型区追加导出，并在文件末尾追加实现：
```typescript
export type CellState = 'available' | 'eliminated' | 'fixed' | 'assumed' | 'conflict'

export interface SolverInput {
  digits: number
  guesses: GuessRecord[]
  assumptions: (number | null)[]
  crossedOut: Set<string>
}

export type Grid = CellState[][]

export function solve(input: SolverInput): Grid {
  const { digits, guesses, assumptions, crossedOut } = input

  const factPossible = filterByFacts(enumerateCandidates(digits), guesses)
  const whatif = factPossible.filter((c) => {
    for (let i = 0; i < digits; i++) {
      const a = assumptions[i]
      if (a !== null && c[i] !== String(a)) return false
    }
    for (const key of crossedOut) {
      const [p, d] = key.split('-')
      if (c[Number(p)] === d) return false
    }
    return true
  })

  const whatifEmpty = whatif.length === 0

  // 预计算每列在 factPossible / whatif 中各位出现过的数字集合
  const factDigitsAt: Set<string>[] = []
  const whatifDigitsAt: Set<string>[] = []
  for (let pos = 0; pos < digits; pos++) {
    factDigitsAt.push(new Set(factPossible.map((c) => c[pos])))
    whatifDigitsAt.push(new Set(whatif.map((c) => c[pos])))
  }

  const grid: Grid = []
  for (let pos = 0; pos < digits; pos++) {
    const col: CellState[] = []
    for (let digit = 0; digit < 10; digit++) {
      const d = String(digit)
      const posDigitOK = whatifDigitsAt[pos].has(d)
      const factHasIt = factDigitsAt[pos].has(d)
      const colOnlyThis = whatifDigitsAt[pos].size === 1 && posDigitOK

      let state: CellState
      if (assumptions[pos] === digit) {
        state = posDigitOK && !whatifEmpty ? 'assumed' : 'conflict'
      } else if (crossedOut.has(`${pos}-${digit}`)) {
        state = 'eliminated'
      } else if (!factHasIt) {
        state = 'eliminated'
      } else if (colOnlyThis) {
        state = 'fixed'
      } else if (!posDigitOK) {
        state = 'eliminated'
      } else {
        state = 'available'
      }
      col.push(state)
    }
    grid.push(col)
  }
  return grid
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，solve 全部分支通过（含置灰/确定/假设/矛盾/联动/划除）。

- [ ] **Step 5: 构建门禁**

Run: `npm run build`
Expected: 无类型错误，构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/game/solver.ts src/game/solver.test.ts
git commit -m "feat: solver solve 逐格状态推导（置灰/确定/假设/矛盾/联动/划除）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: `SolverPanel.vue` 渲染网格 + 折叠 — TDD

**Files:**
- Create: `src/components/SolverPanel.vue`
- Create: `src/components/SolverPanel.test.ts`

> 本任务先实现渲染与折叠（默认收起）。交互（假设/划除/重置）在 Task 5 加。安全：格子为 `<button>`，纯文本数字，无 `v-html`。

- [ ] **Step 1: 创建 `src/components/SolverPanel.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GuessRecord } from '../game/types'
import { solve } from '../game/solver'

const props = defineProps<{
  digits: number
  guesses: GuessRecord[]
  side: 'red' | 'blue'
}>()

const expanded = ref(false)
const assumptions = ref<(number | null)[]>(Array.from({ length: props.digits }, () => null))
const crossedOut = ref<Set<string>>(new Set())

const grid = computed(() =>
  solve({
    digits: props.digits,
    guesses: props.guesses,
    assumptions: assumptions.value,
    crossedOut: crossedOut.value,
  }),
)

const sideName = computed(() => (props.side === 'red' ? '红方' : '蓝方'))
</script>

<template>
  <section class="solver" :class="`side-${side}`">
    <button type="button" class="solver-toggle" @click="expanded = !expanded">
      {{ sideName }}助手 {{ expanded ? '▾' : '▸' }}
    </button>
    <div v-if="expanded" class="solver-body">
      <div class="solver-grid" :style="{ gridTemplateColumns: `repeat(${digits}, 1fr)` }">
        <div v-for="pos in digits" :key="`h-${pos}`" class="solver-col-head">位{{ pos }}</div>
        <template v-for="digit in 10" :key="`row-${digit}`">
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${grid[pos - 1][digit - 1]}`"
          >
            {{ digit - 1 }}
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: 创建 `src/components/SolverPanel.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SolverPanel from './SolverPanel.vue'
import type { GuessRecord } from '../game/types'

const noGuesses: GuessRecord[] = []

describe('SolverPanel 渲染与折叠', () => {
  it('默认收起：不显示网格', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    expect(w.find('.solver-grid').exists()).toBe(false)
  })

  it('点击标题展开后显示 4 列 × 10 格 = 40 个格子', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(true)
    expect(w.findAll('.solver-cell')).toHaveLength(40)
  })

  it('再次点击标题收起', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(true)
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(false)
  })

  it('side 主题 class', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'blue' } })
    expect(w.find('.solver').classes()).toContain('side-blue')
  })

  it('展开后每格带状态 class（初始 available）', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.findAll('.solver-cell.available')).toHaveLength(40)
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm run test`
Expected: PASS（渲染与折叠测试全绿）。

- [ ] **Step 4: 构建门禁**

Run: `npm run build`
Expected: 无类型错误，构建成功。

- [ ] **Step 5: 提交**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat: SolverPanel 渲染 4×10 网格 + 折叠

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: `SolverPanel.vue` 交互（假设/划除/重置）— TDD

**Files:**
- Modify: `src/components/SolverPanel.vue`
- Modify: `src/components/SolverPanel.test.ts`

> 左键格 → 设/取消/替换该列假设；右键格（`@contextmenu.prevent`）→ 切换手动划除；重置 → 清空假设与划除。已是 `eliminated`（事实/联动排除）的格仍可被点击假设（用户可"强行假设"，矛盾会标红），但实现上左键统一走 setAssumption。

- [ ] **Step 1: 在 `SolverPanel.test.ts` 追加交互测试**

在文件末尾追加：
```typescript
describe('SolverPanel 交互', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }

  it('左键点格 → 该格变 assumed', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    // pos0(第1列) digit5 在网格中的索引：行优先排列，行=digit、列=pos
    // 行 digit=5 起始索引 = 5*4，pos0 偏移 0
    await cells[5 * 4 + 0].trigger('click')
    expect(cells[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('再次点同格 → 取消假设（回 available）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 5 * 4 + 0
    await cells[idx].trigger('click')
    expect(cells[idx].classes()).toContain('assumed')
    await cells[idx].trigger('click')
    expect(cells[idx].classes()).toContain('available')
  })

  it('点同列另一格 → 替换假设（一列最多一个）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx5 = 5 * 4 + 0 // pos0 digit5
    const idx3 = 3 * 4 + 0 // pos0 digit3
    await cells[idx5].trigger('click')
    await cells[idx3].trigger('click')
    expect(cells[idx3].classes()).toContain('assumed')
    expect(cells[idx5].classes()).not.toContain('assumed')
  })

  it('右键格 → 切换 eliminated（手动划除）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 7 * 4 + 1 // pos1 digit7
    await cells[idx].trigger('contextmenu')
    expect(cells[idx].classes()).toContain('eliminated')
  })

  it('重置 → 清空假设与划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    await cells[5 * 4 + 0].trigger('click') // 假设
    await cells[7 * 4 + 1].trigger('contextmenu') // 划除
    await w.find('.solver-reset').trigger('click')
    await w.vm.$nextTick()
    const after = w.findAll('.solver-cell')
    expect(after.filter((c) => c.classes().includes('assumed'))).toHaveLength(0)
    // 之前划除的格恢复 available
    expect(after[7 * 4 + 1].classes()).toContain('available')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— 点击无反应（未绑定 handler）、`.solver-reset` 不存在。

- [ ] **Step 3: 在 `SolverPanel.vue` 加入交互逻辑**

在 `<script setup>` 末尾（`sideName` 之后）追加：
```typescript
function toggleAssumption(pos: number, digit: number) {
  const next = assumptions.value.slice()
  next[pos] = next[pos] === digit ? null : digit
  assumptions.value = next
}

function toggleCrossOut(pos: number, digit: number) {
  const next = new Set(crossedOut.value)
  const key = `${pos}-${digit}`
  if (next.has(key)) next.delete(key)
  else next.add(key)
  crossedOut.value = next
}

function reset() {
  assumptions.value = Array.from({ length: props.digits }, () => null)
  crossedOut.value = new Set()
}
```

修改格子按钮，绑定左键/右键（把原 `<button ... class="solver-cell" ...>` 整段替换为）：
```vue
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${grid[pos - 1][digit - 1]}`"
            @click="toggleAssumption(pos - 1, digit - 1)"
            @contextmenu.prevent="toggleCrossOut(pos - 1, digit - 1)"
          >
            {{ digit - 1 }}
          </button>
```

在网格 `</div>` 之后、`solver-body` 的 `</div>` 之前加入重置按钮：
```vue
      <button type="button" class="solver-reset" @click="reset">重置假设</button>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS（交互测试全绿）。

- [ ] **Step 5: 构建门禁**

Run: `npm run build`
Expected: 无类型错误，构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat: SolverPanel 交互（假设/划除/重置）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: App 三栏整合（playing 挂红蓝助手）— TDD

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`

> playing 阶段把布局排成三栏：左 SolverPanel(red, 红方猜测历史 p1) + 中游戏卡片 + 右 SolverPanel(blue, 蓝方猜测历史 p2)。setup/over 阶段只有中间卡片。红方助手用红方的猜测历史推理蓝方的数，蓝方反之——传各自的 `history`。

- [ ] **Step 1: 在 `App.test.ts` 追加测试**

将顶部 import 增加 SolverPanel：
```typescript
import SolverPanel from './components/SolverPanel.vue'
```

在 `describe('App 整合', () => {` 块内末尾追加：
```typescript
  it('playing 阶段渲染左右两个 SolverPanel', async () => {
    const w = mount(App)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    const panels = w.findAllComponents(SolverPanel)
    expect(panels).toHaveLength(2)
    expect(panels[0].props('side')).toBe('red')
    expect(panels[1].props('side')).toBe('blue')
  })

  it('setup 阶段不渲染 SolverPanel', () => {
    const w = mount(App)
    expect(w.findAllComponents(SolverPanel)).toHaveLength(0)
  })

  it('结束阶段不渲染 SolverPanel', async () => {
    const w = mount(App)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '1234') // 双中 → 平局结束
    await w.vm.$nextTick()
    expect(w.findAllComponents(SolverPanel)).toHaveLength(0)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— App 未渲染 SolverPanel。

- [ ] **Step 3: 修改 `src/App.vue`**

在 `<script setup>` 的 import 区追加：
```typescript
import SolverPanel from './components/SolverPanel.vue'
```

把 `<template>` 中 `<div class="stage" ...>` 的内容改为三栏结构（用 `.table` 包裹，左右助手仅 playing 显示）：
```vue
<template>
  <div class="stage" :class="`side-${activeSide}`">
    <div class="table">
      <SolverPanel
        v-if="phase === 'playing'"
        class="solver-left"
        :digits="config.digits"
        :guesses="state.history.p1"
        side="red"
      />

      <main class="app">
        <h1>Guessing Number</h1>

        <SetupView
          v-if="phase === 'setup'"
          :digits="config.digits"
          :validate="checkSecret"
          @set-secret="applySecret"
        />

        <PlayView
          v-else-if="phase === 'playing'"
          :digits="config.digits"
          :current="current"
          :validate="checkGuess"
          :history="state.history"
          @guess="applyGuess"
        />

        <ResultView
          v-else
          :outcome="outcome"
          :secrets="state.secrets"
          :history="state.history"
          @play-again="reset()"
        />
      </main>

      <SolverPanel
        v-if="phase === 'playing'"
        class="solver-right"
        :digits="config.digits"
        :guesses="state.history.p2"
        side="blue"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS（含 playing 两个面板、setup/over 无面板）。

- [ ] **Step 5: 构建门禁**

Run: `npm run build`
Expected: 无类型错误，构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: App 三栏整合，playing 阶段挂红蓝 SolverPanel

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: 样式（三栏布局 + 格子状态配色 + 展示优化）

**Files:**
- Modify: `src/style.css`

> 纯样式任务，不改任何 .vue 模板/class，保证既有测试不破。在 `src/style.css` 末尾追加以下样式块。

- [ ] **Step 1: 在 `src/style.css` 末尾追加三栏与助手样式**

```css
/* ---------- Table: 三栏布局（playing 阶段） ---------- */
.table {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  width: 100%;
  flex-wrap: wrap;
}

.table > .app {
  flex: 0 1 460px;
}

/* ---------- Solver panel ---------- */
.solver {
  flex: 0 1 auto;
  min-width: 0;
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  align-self: stretch;
}

.solver.side-red {
  border-top: 5px solid var(--red);
}

.solver.side-blue {
  border-top: 5px solid var(--blue);
}

.solver-toggle {
  width: 100%;
  border-radius: 0;
  text-align: left;
  background: var(--card);
  color: var(--text);
  font-weight: 700;
}

.solver.side-red .solver-toggle {
  color: var(--red);
}

.solver.side-blue .solver-toggle {
  color: var(--blue);
}

.solver-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.solver-grid {
  display: grid;
  gap: 4px;
}

.solver-col-head {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  padding-bottom: 2px;
}

.solver-cell {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 6px 0;
  border-radius: 8px;
  background: #f3f4fb;
  color: var(--text);
  border: 1.5px solid transparent;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease,
    opacity 0.15s ease;
}

/* 格子状态配色 */
.solver-cell.available {
  background: #f3f4fb;
  color: var(--text);
}

.solver-cell.eliminated {
  background: #f3f4f6;
  color: #c2c5cc;
  text-decoration: line-through;
  opacity: 0.7;
}

.solver-cell.fixed {
  background: #dcfce7;
  color: #15803d;
  border-color: #4ade80;
}

.solver-cell.assumed {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}

.solver-cell.conflict {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #ef4444;
}

.solver-reset {
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.85rem;
  padding: 8px 12px;
}

/* ---------- 展示优化 ---------- */
.history .guess {
  word-spacing: 0.15em;
}

@media (max-width: 920px) {
  .table {
    flex-direction: column;
    align-items: center;
  }

  .table > .app {
    order: -1;
    flex: 1 1 auto;
    width: 100%;
  }

  .solver {
    width: 100%;
    max-width: 460px;
  }
}
```

- [ ] **Step 2: 运行测试与构建确认未破坏**

Run: `npm run test`
Expected: PASS（样式不影响断言，仍全绿）。

Run: `npm run build`
Expected: 构建成功，`dist/assets` 生成 CSS。

- [ ] **Step 3: 提交**

```bash
git add src/style.css
git commit -m "style: 三栏布局 + 助手格子状态配色 + 展示优化

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: 文档 L1-L4 + README 同步

**Files:**
- Create: `docs/L3-details/solver.md`, `docs/L4-api/solver.md`
- Modify: `docs/L1-overview.md`, `docs/L2-components/ui.md`, `docs/L4-api/components.md`, `README.md`

> 阅读最终实现后撰写，保证与代码一致。除新增 solver 文档外，需同步「红蓝改版」之前未更新的内容（玩家1/2→红蓝、猜测阶段无交接屏、「提示」→「正确数目」），以及助手与三栏布局。

- [ ] **Step 1: 创建 `docs/L3-details/solver.md`**

必含：枚举推理原理（5040 候选→事实过滤→what-if）；`solve` 状态推导表（available/eliminated/fixed/assumed/conflict 触发条件，与 `solver.ts` 实现一致）；联动收窄与矛盾检测说明；一个带数字的推导示例（如猜 `0000`→0 使数字 0 全列置灰）；Mermaid 或 ASCII 流程图（候选→过滤→what-if→逐格状态）。

- [ ] **Step 2: 创建 `docs/L4-api/solver.md`**

必含逐函数签名（与 `src/game/solver.ts` 实际一致）：
```
enumerateCandidates(digits: number): string[]
filterByFacts(candidates: string[], guesses: GuessRecord[]): string[]
solve(input: SolverInput): Grid
type CellState = 'available' | 'eliminated' | 'fixed' | 'assumed' | 'conflict'
interface SolverInput { digits; guesses; assumptions; crossedOut }
type Grid = CellState[][]
```

- [ ] **Step 3: 更新 `docs/L2-components/ui.md`**

在组件树加入 `SolverPanel`（4×10 网格助手，红蓝复用，本地 assumptions/crossedOut/expanded）；说明三栏布局（playing 阶段左红助手/中卡片/右蓝助手）；补正红蓝改版（玩家→红蓝、猜测阶段无交接屏、历史「正确数目」）。

- [ ] **Step 4: 更新 `docs/L4-api/components.md`**

追加 SolverPanel props：`digits: number`、`guesses: GuessRecord[]`、`side: 'red' | 'blue'`（无对外 emits）。同步 PlayView（已去 `round` prop）与 ResultView 红蓝文案的现状。

- [ ] **Step 5: 更新 `docs/L1-overview.md` 与 `README.md`**

L1：架构图补 solver 层（UI 的 SolverPanel → 纯函数 solver，复用 engine.feedback，独立于对局）；玩法/阶段描述更新为红蓝、助手。
README：玩法说明加入「推理助手」一段（左右两侧、自动排除、点击假设、右键划除、矛盾标红）；「当前文档覆盖」表加入 solver 的 L3/L4 行。

- [ ] **Step 6: 提交**

```bash
git add docs README.md
git commit -m "docs: 同步助手/三栏/红蓝改版，新增 solver L3+L4 文档

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 自检（Self-Review）

- **Spec 覆盖**：枚举(Task1) · 事实过滤(Task2) · solve 五状态+联动+矛盾(Task3) · 面板渲染折叠(Task4) · 假设/划除/重置交互(Task5) · 三栏整合(Task6) · 配色与展示(Task7) · 文档(Task8)。全覆盖 spec §5-10。
- **类型一致**：`CellState`/`SolverInput`/`Grid`、`enumerateCandidates`/`filterByFacts`/`solve` 在 solver.ts、SolverPanel.vue、文档中签名一致；SolverPanel props `{digits,guesses,side}` 与 App 传参一致；solver 复用 `engine.feedback`、`types.GuessRecord`。
- **无占位符**：每个代码步骤含完整代码与可运行命令及预期输出；每任务含 `npm run test` + `npm run build` 双门禁。

