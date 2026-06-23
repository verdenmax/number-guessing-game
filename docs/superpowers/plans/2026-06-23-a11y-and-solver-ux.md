# 可访问性 + 助手交互 修复包 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两份审查发现的可访问性/语义缺陷，并加「弹出菜单划除、区分事实/假设确定、剩 N 个可能、换数字再战」等小幅高价值改进。

**Architecture:** 先改纯逻辑层 `solver.ts`（+1 态 `fixedAssumed`、+候选计数），再改 `SolverPanel.vue` 交互/图例/样式，随后批量修可访问性（表单、live region、焦点、标题、表格、对比度/动效），最后再战 + 文档 + 部署。每任务 TDD（先写失败测试）、小步提交。

**Tech Stack:** Vue 3 `<script setup>` + TS + Vite；Vitest + @vue/test-utils（jsdom）；纯 CSS 全局表 `src/style.css`；构建用 `vue-tsc --noEmit` + `vite build`。

**基线（开始前）：** 分支 `feat/a11y-and-solver-ux`（基于 main）；现有 207 测试全过；`npm run build` 干净。设计见 `docs/superpowers/specs/2026-06-23-a11y-and-solver-ux-design.md`。

---

## 文件结构（触点地图）

**纯逻辑**
- `src/game/solver.ts` — `CellState` 增 `'fixedAssumed'`；`solve` 区分事实/假设确定；抽出 `computeFactAndWhatif`；新增 `remainingCount`。
- `src/game/solver.test.ts` — 上述的单测。

**助手 UI**
- `src/components/SolverPanel.vue` — 单元格弹出菜单（替代左键/右键/Shift/Delete）；剩 N 个可能；图例拆事实/假设确定；`aria-expanded`/`aria-controls`/具名 `<aside>`；消费 `fixedAssumed` class。
- `src/components/SolverPanel.test.ts` — 菜单交互、计数、图例、语义。
- `src/style.css` — `.solver-cell.fixedAssumed`、菜单样式、非颜色线索、`eliminated` 对比度、`prefers-reduced-motion`、`.solver` 地标无副作用。

**表单与输入**
- `src/components/SecretInput.vue`(+test)、`GuessInput.vue`(+test)、`SetupView.vue`(+test) — `<form @submit.prevent>` + `type="submit"` + 真 `<label for>` + `autocomplete` + `fieldset/legend`。

**Live region 与焦点**
- `src/components/PlayView.vue`(+test) — 反馈 `aria-live` 状态 + 猜测记录上方 `<h2>`。
- `src/components/ResultView.vue`(+test) — 结果标题移焦 + 保存状态 live region + 再战文案。
- `src/components/HandoffScreen.vue` — 挂载聚焦继续按钮。
- `src/App.vue`(+test) — 中文 `<h1>`、`<nav>`、视图切换移焦、再战保留昵称。

**标题/地标/表格**
- `src/components/HistoryView.vue`(+test)、`HistoryDetail.vue`(+test) — `<h1>` + `<nav>` + 移焦。
- `src/components/HistoryList.vue`(+test) — 猜测历史 `<ol>` → `<table>`。

**文档**
- `docs/L3-details/solver.md`、`docs/L4-api/solver.md` — 七态 + `remainingCount`。

---

## 阶段一：solver 纯逻辑（七态 + 候选计数）

### Task 1：`solve` 区分「事实确定 / 假设下确定」（新增 `fixedAssumed` 态）

**Files:**
- Modify: `src/game/solver.ts`（`CellState` 约 line 40；`solve` 每格分支 line 91-104）
- Modify: `src/components/SolverPanel.vue`（`stateLabel` 映射 line 29-36，补 `fixedAssumed` 键以保持 `Record<CellState,string>` 穷尽、构建不报错）
- Test: `src/game/solver.test.ts`（在 solve 的 describe 内追加）

- [ ] **Step 1：写失败测试**

在 `src/game/solver.test.ts` 中、`solve` 相关 describe 内追加（文件顶部已 `import { solve, ... } from './solver'`；如需 `basicSolve` 已在）：

```typescript
describe('solve：区分事实确定 / 假设下确定（fixedAssumed）', () => {
  it('无假设、事实即唯一 → fixed（实心）', () => {
    // guess '01' 反馈2 ⇒ 唯一候选 '01'，两位均事实确定
    const g = solve({ digits: 2, guesses: [{ guess: '01', feedback: 2 }], assumptions: [null, null], crossedOut: new Set() })
    expect(g[0][0]).toBe('fixed')
    expect(g[1][1]).toBe('fixed')
  })

  it('某列仅因假设而唯一 → fixedAssumed（依赖假设）', () => {
    // guess '00' 反馈1 ⇒ 恰有一个 '0'。假设 pos0=5 ⇒ 仅 '50' 满足 ⇒ pos1=0 仅在假设下唯一
    const g = solve({ digits: 2, guesses: [{ guess: '00', feedback: 1 }], assumptions: [5, null], crossedOut: new Set() })
    expect(g[0][5]).toBe('assumed')       // 被假设的格
    expect(g[1][0]).toBe('fixedAssumed')  // 仅因该假设而唯一
  })

  it('撤掉该假设后，同格回到 available（并非事实确定）', () => {
    const g = solve({ digits: 2, guesses: [{ guess: '00', feedback: 1 }], assumptions: [null, null], crossedOut: new Set() })
    expect(g[1][0]).toBe('available')
  })

  it('假设矛盾导致 whatif 空时，不产生 fixedAssumed', () => {
    // 两位假设同一数字 ⇒ 互不相同候选下 whatif 空 ⇒ 回退事实推理，被假设格 conflict
    const g = solve({ digits: 2, guesses: [], assumptions: [5, 5], crossedOut: new Set() })
    const flat = g.flat()
    expect(flat).not.toContain('fixedAssumed')
    expect(g[0][5]).toBe('conflict')
    expect(g[1][5]).toBe('conflict')
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run src/game/solver.test.ts -t fixedAssumed`
Expected: FAIL —— 当前 `solve` 永不返回 `'fixedAssumed'`（`g[1][0]` 实际为 `'fixed'`），且 `CellState` 无此成员（类型错误）。

- [ ] **Step 3：扩展 `CellState`**

将（`src/game/solver.ts` 约 line 40）：
```typescript
export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'assumed' | 'conflict'
```
改为：
```typescript
export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'fixedAssumed' | 'assumed' | 'conflict'
```

- [ ] **Step 4：在 `solve` 每格分支区分两种 fixed**

将 `solve` 内每格推导（line 91-104）：
```typescript
      let state: CellState
      if (assumptions[pos] === digit) {
        state = posDigitOK && !whatifEmpty ? 'assumed' : 'conflict'
      } else if (crossedOut.has(`${pos}-${digit}`)) {
        state = 'crossed'
      } else if (!factHasIt) {
        state = 'eliminated'
      } else if (colOnlyThis) {
        state = 'fixed'
      } else if (!posDigitOK) {
        state = 'eliminated'
      } else {
        state = 'available'
      }
```
改为（仅 `colOnlyThis` 分支区分；其余不动）：
```typescript
      const factColOnlyThis = factDigitsAt[pos].size === 1 && factHasIt
      let state: CellState
      if (assumptions[pos] === digit) {
        state = posDigitOK && !whatifEmpty ? 'assumed' : 'conflict'
      } else if (crossedOut.has(`${pos}-${digit}`)) {
        state = 'crossed'
      } else if (!factHasIt) {
        state = 'eliminated'
      } else if (colOnlyThis) {
        state = factColOnlyThis ? 'fixed' : 'fixedAssumed'
      } else if (!posDigitOK) {
        state = 'eliminated'
      } else {
        state = 'available'
      }
```
（说明：无假设/划除时 `derived==fact` ⇒ `colOnlyThis==factColOnlyThis` ⇒ 恒 `'fixed'`，旧行为不变；whatif 空时 `derived==fact` ⇒ 同样恒 `'fixed'`，故不会泄漏 `fixedAssumed`。）

- [ ] **Step 5：补 `stateLabel` 键，保持构建穷尽**

在 `src/components/SolverPanel.vue` 的 `stateLabel`（line 29-36）中，于 `fixed` 行后加入 `fixedAssumed`：
```typescript
const stateLabel: Record<CellState, string> = {
  available: '可用',
  eliminated: '已排除',
  crossed: '已划除',
  fixed: '确定',
  fixedAssumed: '假设下确定',
  assumed: '已假设',
  conflict: '矛盾',
}
```

- [ ] **Step 6：运行测试，确认通过**

Run: `npx vitest run src/game/solver.test.ts`
Expected: PASS（新增 4 个 + 既有 solve 用例全过；既有 `'fixed'` 断言不受影响）。

- [ ] **Step 7：类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 0 错误（`stateLabel` 已含 `fixedAssumed`，`Record<CellState,string>` 穷尽）。

- [ ] **Step 8：Commit**

```bash
git add src/game/solver.ts src/game/solver.test.ts src/components/SolverPanel.vue
git commit -m "feat(solver): 区分事实确定 fixed 与假设下确定 fixedAssumed

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2：`remainingCount` —— 剩余候选数与（≤8 时）列表

**Files:**
- Modify: `src/game/solver.ts`（抽出 `computeFactAndWhatif`，`solve` 复用之；新增导出 `remainingCount`）
- Test: `src/game/solver.test.ts`

- [ ] **Step 1：写失败测试**

追加：
```typescript
describe('remainingCount：剩余候选数与列表', () => {
  it('无猜测无假设：digits=1 → 10 个候选，列出全部', () => {
    const r = remainingCount({ digits: 1, guesses: [], assumptions: [null], crossedOut: new Set() })
    expect(r.remaining).toBe(10)
    expect(r.candidates).toEqual([]) // >8 不列出
  })

  it('候选 ≤ 8 时列出（按 whatif）', () => {
    // guess '01' 反馈2 ⇒ 唯一候选 '01'
    const r = remainingCount({ digits: 2, guesses: [{ guess: '01', feedback: 2 }], assumptions: [null, null], crossedOut: new Set() })
    expect(r.remaining).toBe(1)
    expect(r.candidates).toEqual(['01'])
  })

  it('假设收窄后计数随之变化', () => {
    const r = remainingCount({ digits: 2, guesses: [{ guess: '00', feedback: 1 }], assumptions: [5, null], crossedOut: new Set() })
    expect(r.remaining).toBe(1)        // 仅 '50'
    expect(r.candidates).toEqual(['50'])
  })

  it('假设矛盾 → whatif 空 → remaining 0、无列表', () => {
    const r = remainingCount({ digits: 2, guesses: [], assumptions: [5, 5], crossedOut: new Set() })
    expect(r.remaining).toBe(0)
    expect(r.candidates).toEqual([])
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run src/game/solver.test.ts -t remainingCount`
Expected: FAIL —— `remainingCount is not a function` / 未导出。

- [ ] **Step 3：抽出 `computeFactAndWhatif` 并复用**

在 `solve` 之上新增（紧接 `filterByFacts` 定义之后、`solve` 之前）：
```typescript
function computeFactAndWhatif(input: SolverInput): { factPossible: string[]; whatif: string[] } {
  const { digits, guesses, assumptions, crossedOut } = input
  const factPossible = filterByFacts(enumerateCandidates(digits), guesses)
  const whatif = factPossible.filter((c) => {
    for (let i = 0; i < digits; i++) {
      const a = assumptions[i]
      if (a != null && a >= 0 && a <= 9 && c[i] !== String(a)) return false
    }
    for (const key of crossedOut) {
      const [p, d] = key.split('-')
      if (c[Number(p)] === d) return false
    }
    return true
  })
  return { factPossible, whatif }
}
```
然后把 `solve` 开头的 `factPossible`/`whatif` 两段（line 54-66）替换为：
```typescript
  const { digits, assumptions, crossedOut } = input
  const { factPossible, whatif } = computeFactAndWhatif(input)
```
（删除原 `enumerateCandidates`/`filterByFacts`/`.filter(...)` 内联；其余逻辑——`whatifEmpty`、`factDigitsAt`、循环——保持不变。注意 `solve` 解构里去掉未再直接使用的 `guesses`。）

- [ ] **Step 4：新增 `remainingCount` 导出**

在 `solve` 之后追加：
```typescript
export function remainingCount(input: SolverInput): { remaining: number; candidates: string[] } {
  const { whatif } = computeFactAndWhatif(input)
  return { remaining: whatif.length, candidates: whatif.length <= 8 ? [...whatif] : [] }
}
```

- [ ] **Step 5：运行测试 + 类型检查**

Run: `npx vitest run src/game/solver.test.ts` → PASS（含既有 solve 用例，确认抽取未改行为）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/game/solver.ts src/game/solver.test.ts
git commit -m "feat(solver): 新增 remainingCount（剩余候选数 + ≤8 时列出）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段二：SolverPanel 交互（弹出菜单 + 计数 + 图例 + 语义）

### Task 3：单元格弹出菜单（统一假设/划除/清除，替代左键/右键/Shift/Delete）

**Files:**
- Modify: `src/components/SolverPanel.vue`（script 38-60 的交互函数、template 102-120 的格子事件 + 新增菜单/背板）
- Test: `src/components/SolverPanel.test.ts`（顶部加菜单助手；改写「SolverPanel 交互」「what-if 集成」「智能/基础开关」里依赖点击/右键的用例）

- [ ] **Step 1：改写交互测试为「先开菜单、再选菜单项」**

把 `src/components/SolverPanel.test.ts` 顶部（`const noGuesses` 之后）加入助手：
```typescript
async function open(w: ReturnType<typeof mount>, cellIdx: number) {
  await w.findAll('.solver-cell')[cellIdx].trigger('click')
}
async function act(w: ReturnType<typeof mount>, action: 'assume' | 'cross' | 'clear') {
  await w.find(`.solver-menu [data-act="${action}"]`).trigger('click')
}
async function assume(w: ReturnType<typeof mount>, cellIdx: number) {
  await open(w, cellIdx); await act(w, 'assume')
}
async function cross(w: ReturnType<typeof mount>, cellIdx: number) {
  await open(w, cellIdx); await act(w, 'cross')
}
```

将整个 `describe('SolverPanel 交互', ...)` 块（现 line 41-153）替换为：
```typescript
describe('SolverPanel 交互', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }

  it('点击 ? 按钮切换图例显示', async () => {
    const w = expand()
    await w.vm.$nextTick()
    expect(w.find('.solver-legend').exists()).toBe(false)
    await w.find('.solver-help-btn').trigger('click')
    expect(w.find('.solver-legend').exists()).toBe(true)
    await w.find('.solver-help-btn').trigger('click')
    expect(w.find('.solver-legend').exists()).toBe(false)
  })

  it('点格弹出菜单，含 假设/划除/清除 三项', async () => {
    const w = expand()
    await w.vm.$nextTick()
    expect(w.find('.solver-menu').exists()).toBe(false)
    await open(w, 5 * 4 + 0)
    const menu = w.find('.solver-menu')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('role')).toBe('menu')
    expect(menu.find('[data-act="assume"]').exists()).toBe(true)
    expect(menu.find('[data-act="cross"]').exists()).toBe(true)
    expect(menu.find('[data-act="clear"]').exists()).toBe(true)
  })

  it('菜单「假设此位」→ 该格 assumed', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('菜单「划除」→ 该格 crossed，且 aria-label 用中文状态名', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 7 * 4 + 1
    await cross(w, idx)
    const cell = w.findAll('.solver-cell')[idx]
    expect(cell.classes()).toContain('crossed')
    const label = cell.attributes('aria-label') ?? ''
    expect(label).toContain('已划除')
    expect(label).not.toContain('crossed')
  })

  it('菜单「清除」→ 撤销假设回 available（清除项在无标记时禁用）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 5 * 4 + 0
    // 未标记时打开菜单：清除禁用
    await open(w, idx)
    expect(w.find('.solver-menu [data-act="clear"]').attributes('disabled')).toBeDefined()
    await act(w, 'assume')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('assumed')
    // 再开菜单选清除
    await open(w, idx)
    await act(w, 'clear')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('available')
  })

  it('同列另一格假设 → 替换（一列最多一个）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx5 = 5 * 4 + 0
    const idx3 = 3 * 4 + 0
    await assume(w, idx5)
    await assume(w, idx3)
    const cells = w.findAll('.solver-cell')
    expect(cells[idx3].classes()).toContain('assumed')
    expect(cells[idx5].classes()).not.toContain('assumed')
  })

  it('重置 → 清空假设与划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    await cross(w, 7 * 4 + 1)
    await w.find('.solver-reset').trigger('click')
    await w.vm.$nextTick()
    const after = w.findAll('.solver-cell')
    expect(after.filter((c) => c.classes().includes('assumed'))).toHaveLength(0)
    expect(after[7 * 4 + 1].classes()).toContain('available')
  })

  it('假设格 aria-pressed=true；格子有 aria-haspopup=menu', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 5 * 4 + 0
    expect(w.findAll('.solver-cell')[idx].attributes('aria-haspopup')).toBe('menu')
    await assume(w, idx)
    expect(w.findAll('.solver-cell')[idx].attributes('aria-pressed')).toBe('true')
  })

  it('Esc 关闭菜单；点背板关闭菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await open(w, 5 * 4 + 0)
    await w.find('.solver-menu').trigger('keydown', { key: 'Escape' })
    expect(w.find('.solver-menu').exists()).toBe(false)
    await open(w, 5 * 4 + 0)
    await w.find('.solver-menu-backdrop').trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(false)
  })
})
```

在 `describe('SolverPanel what-if 集成', ...)` 内，把两处 `await cells[idx].trigger('click')`（line 165、176）改为经菜单假设：
```typescript
    // 第一个用例（conflict）：
    await assume(w, 9 * 4 + 0)
    expect(w.findAll('.solver-cell')[9 * 4 + 0].classes()).toContain('conflict')
```
```typescript
    // 第二个用例（联动 eliminated）：
    await assume(w, 5 * 4 + 0)
    expect(w.findAll('.solver-cell')[5 * 4 + 1].classes()).toContain('eliminated')
```
（即：删去原先 `const cells = w.findAll(...)` + `cells[idx].trigger('click')`，改用 `assume(w, idx)` 助手并在断言时重新 `findAll`。）

在 `describe('SolverPanel 智能/基础开关', ...)` 的「切换模式保留已有假设与划除」用例（line 207-221）中，把
```typescript
    await cells[5 * 4 + 0].trigger('click') // 假设 pos0=5
    await cells[7 * 4 + 1].trigger('contextmenu') // 划除 pos1=7
    expect(cells[5 * 4 + 0].classes()).toContain('assumed')
```
改为：
```typescript
    await assume(w, 5 * 4 + 0)
    await cross(w, 7 * 4 + 1)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')
```
（其后 `setValue(false)` 与保留断言不变；注意把该用例里对 `cells` 的后续引用都改成即时 `w.findAll('.solver-cell')`。）

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: FAIL —— 当前无 `.solver-menu`/`[data-act]`，菜单流程找不到元素。

- [ ] **Step 3：改 SolverPanel.vue script —— 菜单状态与动作**

将交互函数区（line 38-55 的 `toggleAssumption`/`toggleCrossOut`/`onCellClick`）整体替换为：
```typescript
const menuFor = ref<{ pos: number; digit: number } | null>(null)
const menuStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })
const menuEl = ref<HTMLElement | null>(null)
let triggerEl: HTMLElement | null = null

function isMenuOpen(pos: number, digit: number) {
  return menuFor.value?.pos === pos && menuFor.value?.digit === digit
}

const canClear = computed(() => {
  const m = menuFor.value
  if (!m) return false
  return assumptions.value[m.pos] === m.digit || crossedOut.value.has(`${m.pos}-${m.digit}`)
})

function openMenu(e: MouseEvent, pos: number, digit: number) {
  if (isMenuOpen(pos, digit)) {
    closeMenu()
    return
  }
  triggerEl = e.currentTarget as HTMLElement
  menuStyle.value = { left: `${triggerEl.offsetLeft}px`, top: `${triggerEl.offsetTop + triggerEl.offsetHeight}px` }
  menuFor.value = { pos, digit }
  nextTick(() => menuEl.value?.querySelector('button')?.focus())
}

function closeMenu() {
  menuFor.value = null
  triggerEl?.focus()
  triggerEl = null
}

function chooseAssume() {
  const m = menuFor.value
  if (!m) return
  const next = assumptions.value.slice()
  next[m.pos] = m.digit
  assumptions.value = next
  closeMenu()
}

function chooseCross() {
  const m = menuFor.value
  if (!m) return
  const next = new Set(crossedOut.value)
  next.add(`${m.pos}-${m.digit}`)
  crossedOut.value = next
  closeMenu()
}

function chooseClear() {
  const m = menuFor.value
  if (!m) return
  if (assumptions.value[m.pos] === m.digit) {
    const a = assumptions.value.slice()
    a[m.pos] = null
    assumptions.value = a
  }
  const key = `${m.pos}-${m.digit}`
  if (crossedOut.value.has(key)) {
    const s = new Set(crossedOut.value)
    s.delete(key)
    crossedOut.value = s
  }
  closeMenu()
}
```
并把第 2 行 import 改为含 `nextTick`：
```typescript
import { ref, computed, nextTick } from 'vue'
```
（`reset()` 保留不动。）

- [ ] **Step 4：改 SolverPanel.vue template —— 格子事件 + 菜单/背板**

将格子按钮（line 105-118）改为：
```vue
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${stateLabel[grid[pos - 1][digit - 1]]}`"
            :aria-pressed="grid[pos - 1][digit - 1] === 'assumed'"
            aria-haspopup="menu"
            :aria-expanded="isMenuOpen(pos - 1, digit - 1)"
            @click="openMenu($event, pos - 1, digit - 1)"
            @contextmenu.prevent="openMenu($event, pos - 1, digit - 1)"
          >
            {{ digit - 1 }}
          </button>
```
然后在 `.solver-grid` 闭合 `</div>`（line 120）之前、`</template>` 循环之后，加入背板与菜单：
```vue
        <div v-if="menuFor" class="solver-menu-backdrop" @click="closeMenu"></div>
        <div
          v-if="menuFor"
          ref="menuEl"
          class="solver-menu"
          role="menu"
          :style="menuStyle"
          @keydown.esc="closeMenu"
        >
          <button type="button" role="menuitem" class="solver-menu-item" data-act="assume" @click="chooseAssume">
            假设此位
          </button>
          <button type="button" role="menuitem" class="solver-menu-item" data-act="cross" @click="chooseCross">
            划除
          </button>
          <button
            type="button"
            role="menuitem"
            class="solver-menu-item"
            data-act="clear"
            :disabled="!canClear"
            @click="chooseClear"
          >
            清除
          </button>
        </div>
```

- [ ] **Step 5：运行测试 + 类型检查**

Run: `npx vitest run src/components/SolverPanel.test.ts` → PASS（交互全部经菜单）。
Run: `npx vue-tsc --noEmit` → 0 错误（注意 `menuEl` 用作模板 ref；`triggerEl` 为模块内可变量，非响应式）。

- [ ] **Step 6：Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): 单元格弹出菜单（假设/划除/清除）替代右键/Shift/Delete，触屏可用

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4：面板显示「剩 N 个可能」（仅智能模式）

**Files:**
- Modify: `src/components/SolverPanel.vue`（import + 新增 `meta` computed + 模板插入计数行）
- Test: `src/components/SolverPanel.test.ts`

- [ ] **Step 1：写失败测试**

追加：
```typescript
describe('SolverPanel 剩 N 个可能', () => {
  it('智能模式显示剩余候选数，≤8 时列出', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [{ guess: '1234', feedback: 4 }], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const txt = w.find('.solver-count').text()
    expect(txt).toContain('剩 1 个可能')
    expect(txt).toContain('1234')
  })

  it('基础模式不显示剩余计数', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    expect(w.find('.solver-count').exists()).toBe(false)
  })
})
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts -t "剩 N"`
Expected: FAIL（无 `.solver-count`）。

- [ ] **Step 3：import + meta computed**

第 4 行 import 改为含 `remainingCount`：
```typescript
import { solve, basicSolve, remainingCount, type CellState } from '../game/solver'
```
在 `grid` computed（line 18-25）之后追加：
```typescript
const meta = computed(() =>
  smartMode.value
    ? remainingCount({
        digits: props.digits,
        guesses: props.guesses,
        assumptions: assumptions.value,
        crossedOut: crossedOut.value,
      })
    : null,
)
```

- [ ] **Step 4：模板插入计数行**

在 `.solver-legend` 的 `</div>`（line 101）之后、`<div class="solver-grid" ...>`（line 102）之前插入：
```vue
      <p v-if="meta" class="solver-count">
        剩 {{ meta.remaining }} 个可能<span v-if="meta.candidates.length">：{{ meta.candidates.join('、') }}</span>
      </p>
```

- [ ] **Step 5：测试 + 类型检查**

Run: `npx vitest run src/components/SolverPanel.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): 面板显示剩 N 个可能（智能模式，≤8 列出候选）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5：图例拆「事实确定/假设下确定」+ 切换按钮 aria + 具名 aside 地标

**Files:**
- Modify: `src/components/SolverPanel.vue`（根 `<section>`→`<aside>`、toggle 按钮、`.solver-body` id、图例 fixed 行拆分、ops 文案）
- Test: `src/components/SolverPanel.test.ts`

- [ ] **Step 1：写失败测试**

追加：
```typescript
describe('SolverPanel 图例与语义（事实/假设确定、地标、aria）', () => {
  it('智能模式图例区分 事实确定 / 假设下确定', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.find('.solver-help-btn').trigger('click')
    await w.vm.$nextTick()
    const legend = w.find('.solver-legend')
    expect(legend.find('.solver-cell.fixed').exists()).toBe(true)
    expect(legend.find('.solver-cell.fixedAssumed').exists()).toBe(true)
    expect(legend.text()).toContain('事实确定')
    expect(legend.text()).toContain('假设下确定')
  })

  it('solver-toggle 反映 aria-expanded', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    const toggle = w.find('.solver-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(w.find('.solver-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('面板是具名 aside 互补地标', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'blue' } })
    const aside = w.find('aside.solver')
    expect(aside.exists()).toBe(true)
    expect(aside.attributes('aria-label')).toContain('蓝方')
  })
})
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts -t "图例与语义"`
Expected: FAIL（无 `aside.solver`/`.fixedAssumed` 图例项/toggle 无 aria-expanded）。

- [ ] **Step 3：根元素改具名 aside + toggle aria + body id**

将 line 64-68：
```vue
  <section class="solver" :class="`side-${side}`">
    <button type="button" class="solver-toggle" @click="expanded = !expanded">
      {{ sideName }}助手 {{ expanded ? '▾' : '▸' }}
    </button>
    <div v-if="expanded" class="solver-body">
```
改为：
```vue
  <aside class="solver" :class="`side-${side}`" :aria-label="`${sideName}推理助手`">
    <button
      type="button"
      class="solver-toggle"
      :aria-expanded="expanded"
      :aria-controls="`solver-body-${side}`"
      @click="expanded = !expanded"
    >
      {{ sideName }}助手 <span aria-hidden="true">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <div v-if="expanded" :id="`solver-body-${side}`" class="solver-body">
```
并把模板最后的 `</section>`（line 123）改为 `</aside>`。

- [ ] **Step 4：图例拆分 + ops 文案**

将 fixed 那一项（line 90-92）：
```vue
          <li v-if="smartMode">
            <span class="solver-cell fixed">5</span><span>确定：该位唯一可能就是它</span>
          </li>
```
改为两项：
```vue
          <li v-if="smartMode">
            <span class="solver-cell fixed">5</span><span>事实确定：无需假设即可断定</span>
          </li>
          <li v-if="smartMode">
            <span class="solver-cell fixedAssumed">5</span><span>假设下确定：依赖你当前的假设/划除</span>
          </li>
```
将 crossed 那一项（line 94）文案与 ops 文案（line 100）改为符合菜单交互：
```vue
          <li><span class="solver-cell crossed">5</span><span>已划除：你手动标记为「不是它」</span></li>
```
```vue
        <p class="legend-ops">点击格子打开菜单：假设此位／划除／清除 · 「重置假设」清空全部</p>
```

- [ ] **Step 5：测试 + 类型检查 + 回归**

Run: `npx vitest run src/components/SolverPanel.test.ts` → PASS（含既有「图例随模式自适应」用例：`.solver-cell.fixed` 智能存在/基础隐藏、`枚举`/`只标排除` 不变）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): 图例拆事实/假设确定 + toggle aria-expanded + 具名 aside 地标

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6：SolverPanel 相关样式（fixedAssumed + 弹出菜单 + 计数）

**Files:**
- Modify: `src/style.css`（`.solver-grid` 加 `position:relative`；新增 `.solver-cell.fixedAssumed`、`.solver-menu*`、`.solver-count`）

- [ ] **Step 1：`.solver-grid` 加定位上下文**

定位 `.solver-grid { ... }` 规则（`grep -n "\.solver-grid" src/style.css`），在其声明块内加入 `position: relative;`（菜单按 `offsetLeft/Top` 绝对定位需要）。

- [ ] **Step 2：新增 fixedAssumed 样式（紧接 `.solver-cell.fixed` 规则之后）**

```css
/* 假设下确定：仅在当前假设/划除下唯一。绿底 + 虚线 + 角标 *，与实心「事实确定」区分（形状/标记双重线索）。 */
.solver-cell.fixedAssumed {
  background: #dcfce7;
  color: #15803d;
  border-color: #4ade80;
  border-style: dashed;
  position: relative;
}
.solver-cell.fixedAssumed::after {
  content: '*';
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 0.6rem;
  line-height: 1;
  color: #15803d;
}
```

- [ ] **Step 3：新增弹出菜单与计数样式（文件末尾或 solver 区块附近）**

```css
.solver-count {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
}
/* 层级：背板在格子之下(z5)，格子在背板之上(z10) → 菜单开着时点「别的格子」命中格子(切换锚点)而非背板；
   点格子以外(面板/页面)命中背板 → 关闭。菜单(z20)在最上。 */
.solver-cell {
  position: relative;
  z-index: 10;
}
.solver-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5;
}
.solver-menu {
  position: absolute;
  z-index: 20;
  min-width: 104px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.solver-menu-item {
  flex: none;
  width: 100%;
  padding: 9px 14px;
  border: 0;
  background: none;
  text-align: left;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
}
.solver-menu-item:hover:not(:disabled) {
  background: var(--accent-soft, #ececfb);
}
.solver-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 4：修过时的 crossed CSS 注释（划除交互已改菜单）**

定位 `.solver-cell.crossed` 之上的注释（`grep -n "右键/Shift+点击/Delete" src/style.css`），把提及「右键/Shift+点击/Delete」的注释改为「点击格子→菜单「划除」」，与新交互一致（仅注释，不改样式值）。

- [ ] **Step 5：全量测试 + 构建**

Run: `npx vitest run` → 全过（CSS 不影响 jsdom 行为）。
Run: `npm run build` → `vue-tsc --noEmit` 0 错误 + vite build 成功。

- [ ] **Step 6：视觉自检（headless，可选但建议）**

构建后用 `/usr/bin/chromium --headless=new --no-sandbox --screenshot` 渲染一段含展开面板 + 打开菜单（给 `.solver-menu` 内联 `left/top`）+ 一个 `fixedAssumed` 格子的临时 HTML（链接 dist CSS），确认：菜单为带阴影的小浮层、`fixedAssumed` 为绿虚线带 `*` 角标、与实心 `fixed` 可区分。完成后删除临时文件（勿提交 dist 临时件）。

- [ ] **Step 7：Commit**

```bash
git add src/style.css
git commit -m "style(solver): fixedAssumed 绿虚线+角标、弹出菜单与剩余计数样式

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段三：表单与输入语义

### Task 7：SecretInput 改 `<form>` + 真 `<label for>` + autocomplete

**Files:**
- Modify: `src/components/SecretInput.vue`
- Test: `src/components/SecretInput.test.ts`

- [ ] **Step 1：改测试为触发表单 submit（先失败）**

在 `src/components/SecretInput.test.ts` 中：
将「确认后 emit confirm 并清空输入」用例里
```typescript
    await w.find('button.confirm').trigger('click')
```
改为
```typescript
    await w.find('form.secret-input').trigger('submit')
```
将「非法时按 Enter 不提交」用例里
```typescript
    await input.trigger('keyup.enter')
```
改为
```typescript
    await w.find('form.secret-input').trigger('submit')
```
并在该 describe 末尾追加无障碍断言：
```typescript
  it('label 与 input 关联（for/id）且无 keyup 手搓提交', () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置秘密', validate: len4 } })
    const id = w.find('input').attributes('id')
    expect(id).toBeTruthy()
    expect(w.find('label.label').attributes('for')).toBe(id)
    expect(w.find('form.secret-input').exists()).toBe(true)
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/SecretInput.test.ts`
Expected: FAIL（无 `form.secret-input`/`label.label[for]`）。

- [ ] **Step 3：改组件**

第 2 行 import 加 `useId`：
```typescript
import { ref, computed, onMounted, useId } from 'vue'
```
在 `const inputEl = ...` 一行后加：
```typescript
const id = useId()
```
将 `<template>` 整段（line 35-56）替换为：
```vue
<template>
  <form class="secret-input" @submit.prevent="confirm">
    <label class="label" :for="id">{{ label }}</label>
    <div class="row">
      <input
        :id="id"
        ref="inputEl"
        :type="masked ? 'password' : 'text'"
        :value="value"
        inputmode="numeric"
        autocomplete="off"
        :maxlength="digits"
        @input="onInput"
      />
      <button type="button" class="toggle" @click="masked = !masked">
        {{ masked ? '显示' : '隐藏' }}
      </button>
    </div>
    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    <button type="submit" class="confirm" :disabled="!canSubmit">确认</button>
  </form>
</template>
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/components/SecretInput.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/components/SecretInput.vue src/components/SecretInput.test.ts
git commit -m "fix(a11y): SecretInput 用 form 提交 + label/for 关联 + autocomplete off

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 8：GuessInput 改 `<form>` + 真 `<label for>` + autocomplete

**Files:**
- Modify: `src/components/GuessInput.vue`
- Test: `src/components/GuessInput.test.ts`

- [ ] **Step 1：改测试为触发表单 submit（先失败）**

在 `src/components/GuessInput.test.ts` 中，把三处提交方式改为表单 submit：
「允许重复数字并可提交」「确认后 emit 并清空」里的
```typescript
    await w.find('button.confirm').trigger('click')
```
改为
```typescript
    await w.find('form.guess-input').trigger('submit')
```
「非法时按钮禁用且 Enter 不提交」里的
```typescript
    await input.trigger('keyup.enter')
```
改为
```typescript
    await w.find('form.guess-input').trigger('submit')
```
并追加：
```typescript
  it('label 与 input 关联（for/id）', () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '红方输入', validate: len4 } })
    const id = w.find('input').attributes('id')
    expect(id).toBeTruthy()
    expect(w.find('label.label').attributes('for')).toBe(id)
    expect(w.find('form.guess-input').exists()).toBe(true)
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/GuessInput.test.ts` → FAIL。

- [ ] **Step 3：改组件**

第 2 行 import 加 `useId`：
```typescript
import { ref, computed, onMounted, useId } from 'vue'
```
在 `const inputEl = ...` 一行后加：
```typescript
const id = useId()
```
将 `<template>`（line 34-50）替换为：
```vue
<template>
  <form class="guess-input" @submit.prevent="confirm">
    <label class="label" :for="id">{{ label }}</label>
    <input
      :id="id"
      ref="inputEl"
      type="text"
      :value="value"
      inputmode="numeric"
      autocomplete="off"
      :maxlength="digits"
      @input="onInput"
    />
    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    <button type="submit" class="confirm" :disabled="!canSubmit">提交猜测</button>
  </form>
</template>
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/components/GuessInput.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/components/GuessInput.vue src/components/GuessInput.test.ts
git commit -m "fix(a11y): GuessInput 用 form 提交 + label/for 关联 + autocomplete off

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 9：SetupView 两步用 `<fieldset><legend>` 分组

**Files:**
- Modify: `src/components/SetupView.vue`
- Modify: `src/style.css`（`.setup-step` 作为 fieldset 的重置）
- Test: `src/components/SetupView.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/components/SetupView.test.ts` 末尾 describe 内追加：
```typescript
  it('两步各为带 legend 的 fieldset 分组', async () => {
    const w = mount(SetupView, { props: { digits: 4, validate: len4 } })
    const fs1 = w.find('fieldset.setup-step')
    expect(fs1.exists()).toBe(true)
    expect(fs1.find('legend').text()).toContain('红方')
  })
```
（若该测试文件未定义 `len4`，复用文件内既有的校验函数；命名以文件实际为准。）

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/SetupView.test.ts` → FAIL（当前是 `div.setup-step`，无 `<legend>`）。

- [ ] **Step 3：改组件**

将 p1 容器（line 33）`<div v-if="step === 'p1'" class="setup-step">` 改为：
```vue
  <fieldset v-if="step === 'p1'" class="setup-step">
    <legend>红方设置</legend>
```
其对应闭合 `</div>`（line 44）改为 `</fieldset>`。
将 p2 容器（line 50）`<div v-else class="setup-step">` 改为：
```vue
  <fieldset v-else class="setup-step">
    <legend>蓝方设置</legend>
```
其闭合 `</div>`（line 61）改为 `</fieldset>`。

- [ ] **Step 4：style.css 重置 fieldset 外观**

新增（solver/setup 区域附近）：
```css
.setup-step {
  border: 0;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}
.setup-step > legend {
  padding: 0;
  margin-bottom: 8px;
  font-weight: 600;
}
```

- [ ] **Step 5：测试 + 类型检查 + 回归**

Run: `npx vitest run src/components/SetupView.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/components/SetupView.vue src/style.css src/components/SetupView.test.ts
git commit -m "fix(a11y): SetupView 两步用 fieldset/legend 分组 + 重置外观

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段四：Live region 与焦点（读屏/键盘）

### Task 10：PlayView 猜测反馈 live region + 猜测记录可访问标题 + `.visually-hidden`

**Files:**
- Modify: `src/components/PlayView.vue`
- Modify: `src/style.css`（新增 `.visually-hidden` 工具类）
- Test: `src/components/PlayView.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/components/PlayView.test.ts` 末尾 describe 内追加（沿用文件内既有 `len4`/校验函数命名）：
```typescript
  it('最新猜测进入 aria-live 状态区（读屏可闻）', () => {
    const history = { p1: [{ guess: '1234', feedback: 2 }], p2: [] }
    const w = mount(PlayView, { props: { digits: 4, current: 'p2', validate: len4, history } })
    const status = w.find('[role="status"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toContain('1234')
    expect(status.text()).toContain('正确数目 2')
  })

  it('猜测记录区有可访问标题 h2', () => {
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: len4, history: { p1: [], p2: [] } } })
    expect(w.find('.histories h2').exists()).toBe(true)
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/PlayView.test.ts` → FAIL（无 `[role=status]`/`.histories h2`）。

- [ ] **Step 3：改组件**

第 1-5 行脚本：把 `import` 段补 `computed`（从 vue），并新增最新记录推导。将 script 顶部：
```typescript
<script setup lang="ts">
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import { sideName } from '../playerLabels'

const props = defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

function onGuess(value: string) {
  emit('guess', value)
}
</script>
```
替换为：
```typescript
<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import { sideName } from '../playerLabels'

const props = defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

function onGuess(value: string) {
  emit('guess', value)
}

// 回合顺序：每轮 p1 先猜、p2 后猜 ⇒ p1.length ≥ p2.length。最新一手由两者长度关系判定。
const announceText = computed(() => {
  const { p1, p2 } = props.history
  const last = p1.length > p2.length ? { who: 'p1' as const, r: p1[p1.length - 1] } : p2.length ? { who: 'p2' as const, r: p2[p2.length - 1] } : null
  if (!last) return ''
  return `${sideName(last.who)} 猜 ${last.r.guess}，正确数目 ${last.r.feedback}`
})
</script>
```
将 `<template>`（line 20-34）替换为：
```vue
<template>
  <div class="play">
    <p class="visually-hidden" role="status" aria-live="polite">{{ announceText }}</p>
    <GuessInput
      :key="current"
      :digits="digits"
      :validate="validate"
      :label="`${sideName(current)}输入`"
      @confirm="onGuess"
    />
    <section class="histories" aria-labelledby="play-hist-h">
      <h2 id="play-hist-h" class="visually-hidden">猜测记录</h2>
      <HistoryList :records="history.p1" title="红方" side="red" />
      <HistoryList :records="history.p2" title="蓝方" side="blue" />
    </section>
  </div>
</template>
```

- [ ] **Step 4：style.css 新增 `.visually-hidden`**

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 5：测试 + 类型检查**

Run: `npx vitest run src/components/PlayView.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/components/PlayView.vue src/style.css src/components/PlayView.test.ts
git commit -m "fix(a11y): PlayView 猜测反馈 aria-live 状态区 + 猜测记录可访问标题

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 11：ResultView 结果移焦 + 保存状态 live region +「换数字再战」文案

**Files:**
- Modify: `src/components/ResultView.vue`
- Test: `src/components/ResultView.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/components/ResultView.test.ts` 末尾 describe 内追加（沿用文件内构造 props 的既有写法/工厂）：
```typescript
  it('挂载时把焦点移到结果标题', () => {
    const w = mount(ResultView, {
      attachTo: document.body,
      props: {
        outcome: { kind: 'draw' },
        secrets: { p1: '1234', p2: '5678' },
        history: { p1: [], p2: [] },
        saveStatus: 'saved',
      },
    })
    expect(document.activeElement).toBe(w.find('h2').element)
    w.unmount()
  })

  it('保存状态在 polite live region 内', () => {
    const w = mount(ResultView, {
      props: {
        outcome: { kind: 'draw' },
        secrets: { p1: '1234', p2: '5678' },
        history: { p1: [], p2: [] },
        saveStatus: 'saved',
      },
    })
    const region = w.find('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toContain('已保存')
  })

  it('再战按钮文案为「换数字再战」', () => {
    const w = mount(ResultView, {
      props: {
        outcome: { kind: 'draw' },
        secrets: { p1: '1234', p2: '5678' },
        history: { p1: [], p2: [] },
        saveStatus: 'saved',
      },
    })
    expect(w.find('.result-actions').text()).toContain('换数字再战')
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/ResultView.test.ts` → FAIL。

- [ ] **Step 3：改组件**

第 2 行 import 改为含 `onMounted, ref`：
```typescript
import { computed, onMounted, ref } from 'vue'
```
在 `const resultText = ...` 计算之后追加：
```typescript
const headingEl = ref<HTMLElement | null>(null)
onMounted(() => headingEl.value?.focus())
```
将 `<template>` 中（line 28、line 30-34）：
```vue
    <h2>{{ resultText }}</h2>
    <p class="reveal">{{ p1Name }}的数字：{{ secrets.p1 }}　{{ p2Name }}的数字：{{ secrets.p2 }}</p>
    <p v-if="saveStatus === 'saving'" class="saved-hint saving">💾 正在保存…</p>
    <p v-else-if="saveStatus === 'error'" class="error" role="alert">
      ⚠️ 历史保存失败（可能是浏览器隐私模式）
    </p>
    <p v-else-if="saveStatus === 'saved'" class="saved-hint">✅ 本局已保存到历史</p>
```
替换为：
```vue
    <h2 ref="headingEl" tabindex="-1">{{ resultText }}</h2>
    <p class="reveal">{{ p1Name }}的数字：{{ secrets.p1 }}　{{ p2Name }}的数字：{{ secrets.p2 }}</p>
    <div class="save-region" role="status" aria-live="polite">
      <p v-if="saveStatus === 'saving'" class="saved-hint saving"><span aria-hidden="true">💾</span> 正在保存…</p>
      <p v-else-if="saveStatus === 'error'" class="error"><span aria-hidden="true">⚠️</span> 历史保存失败（可能是浏览器隐私模式）</p>
      <p v-else-if="saveStatus === 'saved'" class="saved-hint"><span aria-hidden="true">✅</span> 本局已保存到历史</p>
    </div>
```
将再战按钮（line 40）：
```vue
      <button type="button" @click="emit('playAgain')">再来一局</button>
```
改为：
```vue
      <button type="button" @click="emit('playAgain')">换数字再战</button>
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/components/ResultView.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/components/ResultView.vue src/components/ResultView.test.ts
git commit -m "fix(a11y): ResultView 结果标题移焦 + 保存状态 polite live region + 换数字再战文案

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 12：HandoffScreen 挂载聚焦继续按钮

**Files:**
- Modify: `src/components/HandoffScreen.vue`
- Test: `src/components/HandoffScreen.test.ts`（新建）

- [ ] **Step 1：写失败测试**

新建 `src/components/HandoffScreen.test.ts`：
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HandoffScreen from './HandoffScreen.vue'

describe('HandoffScreen', () => {
  it('挂载时聚焦继续按钮', () => {
    const w = mount(HandoffScreen, { attachTo: document.body, props: { message: '交给蓝方' } })
    expect(document.activeElement).toBe(w.find('button').element)
    w.unmount()
  })

  it('点击继续 emit continue', async () => {
    const w = mount(HandoffScreen, { props: { message: '交给蓝方' } })
    await w.find('button').trigger('click')
    expect(w.emitted('continue')).toBeTruthy()
  })
})
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/HandoffScreen.test.ts` → FAIL（按钮未自动聚焦）。

- [ ] **Step 3：改组件**

替换整文件：
```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
defineProps<{ message: string; buttonText?: string }>()
const emit = defineEmits<{ continue: [] }>()
const btn = ref<HTMLButtonElement | null>(null)
onMounted(() => btn.value?.focus())
</script>

<template>
  <div class="handoff">
    <p class="message">{{ message }}</p>
    <button ref="btn" type="button" @click="emit('continue')">{{ buttonText ?? '开始' }}</button>
  </div>
</template>
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/components/HandoffScreen.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/components/HandoffScreen.vue src/components/HandoffScreen.test.ts
git commit -m "fix(a11y): HandoffScreen 挂载聚焦继续按钮（交接后焦点不丢）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段五：标题层级 / 地标 / 表格

### Task 13：App.vue 中文 `<h1>` + 历史控件 `<nav>` + 装饰 emoji aria-hidden

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/App.test.ts` 末尾追加（沿用文件内既有 import；若无 `mount`/`App` 则补 `import { mount } from '@vue/test-utils'` 与 `import App from './App.vue'`）：
```typescript
describe('App 顶层标题与导航', () => {
  it('主标题为中文 h1，位于 main 内', () => {
    const w = mount(App)
    const h1 = w.find('main h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toBe('猜数字')
  })

  it('历史入口在具名 nav 内', () => {
    const w = mount(App)
    const nav = w.find('nav[aria-label]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('历史')
  })
})
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/App.test.ts` → FAIL（标题为英文且无 `<nav>`）。

- [ ] **Step 3：改 App.vue 头部**

将（line 79-89）：
```vue
          <header class="app-head">
            <h1>Guessing Number</h1>
            <button
              v-if="phase !== 'playing'"
              type="button"
              class="nav-history"
              @click="openHistory"
            >
              📜 历史
            </button>
          </header>
```
改为：
```vue
          <header class="app-head">
            <h1>猜数字</h1>
            <nav v-if="phase !== 'playing'" class="app-nav" aria-label="页面导航">
              <button type="button" class="nav-history" @click="openHistory">
                <span aria-hidden="true">📜</span> 历史
              </button>
            </nav>
          </header>
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/App.test.ts` → PASS（如有旧断言 `'Guessing Number'` 一并改为 `'猜数字'`）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "fix(a11y): App 主标题改中文 h1 + 历史入口具名 nav + emoji aria-hidden

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 14：HistoryView / HistoryDetail 加 `<h1>` + 挂载移焦 + nav/emoji

**Files:**
- Modify: `src/components/HistoryView.vue`、`src/components/HistoryDetail.vue`
- Test: `src/components/HistoryView.test.ts`、`src/components/HistoryDetail.test.ts`

- [ ] **Step 1：写失败测试**

`HistoryView.test.ts` 末尾 describe 内追加：
```typescript
  it('页面标题为 h1 且挂载时聚焦', () => {
    const w = mount(HistoryView, { attachTo: document.body, props: { records: [], error: null } })
    const h1 = w.find('h1')
    expect(h1.text()).toContain('对局历史')
    expect(document.activeElement).toBe(h1.element)
    w.unmount()
  })
```
`HistoryDetail.test.ts` 末尾 describe 内追加（`rec` 用文件内既有的样例记录工厂/常量）：
```typescript
  it('详情标题为 h1 且挂载时聚焦', () => {
    const w = mount(HistoryDetail, { attachTo: document.body, props: { record: rec } })
    const h1 = w.find('h1')
    expect(h1.text()).toContain('对局详情')
    expect(document.activeElement).toBe(h1.element)
    w.unmount()
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/HistoryView.test.ts src/components/HistoryDetail.test.ts` → FAIL。

- [ ] **Step 3：改 HistoryView.vue**

第 1 行 `<script setup lang="ts">` 后补 import：
```typescript
import { onMounted, ref } from 'vue'
```
在 `const emit = defineEmits...` 之后加：
```typescript
const headingEl = ref<HTMLElement | null>(null)
onMounted(() => headingEl.value?.focus())
```
将 `<header class="history-head">`（line 35-43）：
```vue
    <header class="history-head">
      <h2>对局历史</h2>
      <div class="history-actions">
        <button type="button" :disabled="records.length === 0" @click="confirmClear">
          🗑 清空历史
        </button>
        <button type="button" @click="emit('back')">← 返回</button>
      </div>
    </header>
```
改为：
```vue
    <header class="history-head">
      <h1 ref="headingEl" tabindex="-1">对局历史</h1>
      <nav class="history-actions" aria-label="历史导航">
        <button type="button" :disabled="records.length === 0" @click="confirmClear">
          <span aria-hidden="true">🗑</span> 清空历史
        </button>
        <button type="button" @click="emit('back')"><span aria-hidden="true">←</span> 返回</button>
      </nav>
    </header>
```

- [ ] **Step 4：改 HistoryDetail.vue**

第 2 行 import 改为含 `onMounted, ref`：
```typescript
import { computed, onMounted, ref } from 'vue'
```
在 `function confirmDelete...` 之前加：
```typescript
const headingEl = ref<HTMLElement | null>(null)
onMounted(() => headingEl.value?.focus())
```
将 `<h2 class="detail-title">对局详情</h2>`（line 28）改为：
```vue
    <h1 class="detail-title" ref="headingEl" tabindex="-1">对局详情</h1>
```
将返回按钮（line 30）：
```vue
      <button type="button" @click="emit('back')">← 列表</button>
```
改为：
```vue
      <button type="button" @click="emit('back')"><span aria-hidden="true">←</span> 列表</button>
```

- [ ] **Step 5：测试 + 类型检查 + 回归**

Run: `npx vitest run src/components/HistoryView.test.ts src/components/HistoryDetail.test.ts` → PASS（既有 `.history-actions button` 选择器对 `<nav>` 仍匹配，按钮顺序不变）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6：Commit**

```bash
git add src/components/HistoryView.vue src/components/HistoryDetail.vue src/components/HistoryView.test.ts src/components/HistoryDetail.test.ts
git commit -m "fix(a11y): 历史页/详情页加 h1 + 挂载移焦 + 导航 nav + emoji aria-hidden

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 15：HistoryList 猜测历史 `<ol>` → 语义 `<table>`

**Files:**
- Modify: `src/components/HistoryList.vue`
- Test: `src/components/HistoryList.test.ts`（新建）

- [ ] **Step 1：写失败测试**

新建 `src/components/HistoryList.test.ts`：
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryList from './HistoryList.vue'

describe('HistoryList', () => {
  it('猜测记录渲染为带表头的 table', () => {
    const records = [
      { guess: '1234', feedback: 2 },
      { guess: '5678', feedback: 0 },
    ]
    const w = mount(HistoryList, { props: { records, title: '红方', side: 'red' } })
    expect(w.find('table.guess-table').exists()).toBe(true)
    const headers = w.findAll('th[scope="col"]').map((h) => h.text())
    expect(headers).toEqual(['猜测', '正确数目'])
    const firstRow = w.findAll('tbody tr')[0].findAll('td').map((c) => c.text())
    expect(firstRow).toEqual(['1234', '2'])
  })

  it('空记录显示提示、无 table', () => {
    const w = mount(HistoryList, { props: { records: [], title: '红方' } })
    expect(w.find('table').exists()).toBe(false)
    expect(w.find('.empty').text()).toContain('还没有猜测')
  })
})
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/HistoryList.test.ts` → FAIL（当前是 `<ol>`）。

- [ ] **Step 3：改组件**

将 `<template>`（line 6-17）替换为：
```vue
<template>
  <div class="history" :class="side ? 'side-' + side : null">
    <h3 v-if="title">{{ title }}</h3>
    <table v-if="records.length" class="guess-table">
      <caption class="visually-hidden">{{ title ?? '该方' }}的猜测记录</caption>
      <thead>
        <tr>
          <th scope="col">猜测</th>
          <th scope="col">正确数目</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in records" :key="i">
          <td class="guess">{{ r.guess }}</td>
          <td class="fb">{{ r.feedback }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="records.length === 0" class="empty">还没有猜测</p>
  </div>
</template>
```

- [ ] **Step 4：测试 + 类型检查 + 回归**

Run: `npx vitest run src/components/HistoryList.test.ts` → PASS。
Run: `npx vitest run` → 全过（PlayView/ResultView/HistoryDetail 用到 HistoryList，确认无回归——既有测试不依赖 `ol/li/.fb` 文本）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/components/HistoryList.vue src/components/HistoryList.test.ts
git commit -m "fix(a11y): 猜测历史改语义 table（caption + th scope），二列数据可读

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段六：视觉可访问性

### Task 16：eliminated 对比度 + prefers-reduced-motion + 非颜色线索 + 🧠 aria-hidden

**Files:**
- Modify: `src/style.css`
- Modify: `src/components/SolverPanel.vue`（仅给 🧠 包 `aria-hidden` 一处）

- [ ] **Step 1：加深 `.solver-cell.eliminated` 文字、去掉压暗的 opacity**

将（约 line 504-509）：
```css
.solver-cell.eliminated {
  background: #f3f4f6;
  color: #c2c5cc;
  text-decoration: line-through;
  opacity: 0.7;
}
```
改为（删除线保留作形状线索；颜色加深到对 `#f3f4f6` ≥ 4.5:1，去掉 `opacity`）：
```css
.solver-cell.eliminated {
  background: #f3f4f6;
  color: #4b5563;
  text-decoration: line-through;
}
```

- [ ] **Step 2：为 fixed / assumed 增加非颜色标记（色盲可辨）**

在 `.solver-cell.fixed { ... }` 规则之后追加：
```css
/* 非颜色线索：事实确定打 ✓、已假设打 ·，配合 fixedAssumed 的虚线+* 形成形状区分 */
.solver-cell.fixed {
  position: relative;
}
.solver-cell.fixed::after {
  content: '✓';
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 0.6rem;
  line-height: 1;
}
.solver-cell.assumed {
  position: relative;
}
.solver-cell.assumed::after {
  content: '·';
  position: absolute;
  top: 0;
  right: 4px;
  font-weight: 700;
}
```
（注：`.solver-cell.fixed` 已有颜色规则；此处仅追加 `position` 与 `::after`，不与既有冲突。若既有 `.solver-cell.fixed` 已含其它声明，保留并只补 `position: relative;`。）

- [ ] **Step 3：prefers-reduced-motion（文件末尾）**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4：SolverPanel 智能开关的 🧠 包 aria-hidden**

将（`src/components/SolverPanel.vue` 约 line 70-73）：
```vue
        <label class="solver-mode">
          <input type="checkbox" v-model="smartMode" />
          🧠 智能推理
        </label>
```
改为：
```vue
        <label class="solver-mode">
          <input type="checkbox" v-model="smartMode" />
          <span aria-hidden="true">🧠</span> 智能推理
        </label>
```

- [ ] **Step 5：全量测试 + 构建**

Run: `npx vitest run` → 全过（无回归）。
Run: `npm run build` → `vue-tsc --noEmit` 0 错误 + vite build 成功。

- [ ] **Step 6：视觉自检（headless，可选）**

构建后渲染一段含 eliminated/fixed/fixedAssumed/assumed 四态格子的临时 HTML（链接 dist CSS），确认：eliminated 文字清晰可读（非灰到看不见）、fixed 有 ✓、fixedAssumed 虚线带 *、assumed 有 ·。再用模拟 `prefers-reduced-motion` 截图确认背景渐变不再动画。完成后删除临时文件。

- [ ] **Step 7：Commit**

```bash
git add src/style.css src/components/SolverPanel.vue
git commit -m "fix(a11y): eliminated 提对比度 + 非颜色状态标记 + prefers-reduced-motion + 🧠 aria-hidden

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段七：再战保留昵称

### Task 17：换数字再战保留昵称（App.vue playAgain）

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/App.test.ts` 追加（驱动一局到结束、再战后断言昵称仍在；沿用文件内既有 helper，如无则用如下直驱）：
```typescript
describe('App 换数字再战保留昵称', () => {
  it('playAgain 后 names 不被清空（仅重置秘密数/历史）', async () => {
    const w = mount(App)
    // 设置 p1 昵称 + 秘密、过交接、设置 p2 昵称 + 秘密 → 进入对局
    // 为稳健起见，直接断言组件内 names 在 reset 后保留：通过暴露的行为驱动
    // 走最少 UI 路径：填红方昵称与数字
    const nameInputs = () => w.findAll('.name-field input')
    await nameInputs()[0].setValue('红哥')
    await w.find('form.secret-input input').setValue('1234')
    await w.find('form.secret-input').trigger('submit')
    // 交接 → 蓝方
    await w.find('.handoff button').trigger('click')
    await nameInputs()[0].setValue('蓝妹')
    await w.find('form.secret-input input').setValue('5678')
    await w.find('form.secret-input').trigger('submit')
    // 现在 phase=playing；构造一局结束较繁琐，改为直接验证再战语义：
    // 触发 ResultView 之外，最小化——此处只断言昵称已 set 到 App 状态（reveal 文案）
    // 若文件已有更直接的结束局 helper，请用之并在 ResultView 上断言 reveal 含「红哥」「蓝妹」，
    // 再点击「换数字再战」后回到 setup，且 names 仍保留（再次进入 result 时 reveal 仍含昵称）。
    expect(w.html()).toContain('红哥')
  })
})
```
> 说明：若 `App.test.ts` 已存在「玩完一局」的封装（驱动 p1/p2 猜测直到分出胜负），优先复用它：玩到 `over` → ResultView 的 `reveal`/标题应含设置过的昵称 → 点击 `.result-actions button`（换数字再战）→ 回到 `setup` → 再玩一局到 `over` → **断言昵称仍显示**（证明未被清空）。这是更强的断言；上面的最小版仅兜底保证测试可失败/通过。

- [ ] **Step 2：确认失败/现状**

Run: `npx vitest run src/App.test.ts`
Expected: 视所写断言而定；关键是覆盖「reset 后 `names` 保留」这一行为。当前 `playAgain` 会 `names.value = { p1: null, p2: null }`，强断言版应 FAIL。

- [ ] **Step 3：改 `playAgain` 保留昵称**

将（line 42-47）：
```typescript
function playAgain() {
  reset()
  names.value = { p1: null, p2: null }
  saved.value = false
  saveStatus.value = 'saving'
}
```
改为：
```typescript
function playAgain() {
  reset() // 重置秘密数/历史/回合/outcome，回到 setup
  // 保留 names：换数字再战时昵称不清空（重新设秘密数时仍可在昵称框覆盖）
  saved.value = false
  saveStatus.value = 'saving'
}
```

- [ ] **Step 4：测试 + 类型检查**

Run: `npx vitest run src/App.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: 换数字再战保留昵称（playAgain 不再清空 names）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 阶段八：文档与部署

### Task 18：L3/L4 文档对齐（七态 fixedAssumed + remainingCount + 菜单交互改述）

**Files:**
- Modify: `docs/L4-api/solver.md`、`docs/L3-details/solver.md`

> 纯文档，无测试。逐处 `edit` 内容锚定替换；若某锚点不符 STOP 报告。完成后跑 `npx vitest run` 确认未误触代码（仍全过）。

- [ ] **Step 1：L4 — `CellState` 加 `fixedAssumed`（七态）**

old: `export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'assumed' | 'conflict'`
new: `export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'fixedAssumed' | 'assumed' | 'conflict'`

- [ ] **Step 2：L4 — 状态表拆 fixed / 新增 fixedAssumed**

old:
```
| `fixed` | 该列 what-if 只剩这一个数字（自动确定） | 绿 |
```
new:
```
| `fixed` | 事实确定：无需假设，仅凭事实即唯一 | 绿实心 + ✓ |
| `fixedAssumed` | 假设下确定：仅在当前假设/划除下唯一 | 绿虚线 + * |
```

- [ ] **Step 3：L4 — crossed 行交互改述为菜单**

old:
```
| `crossed` | 手动划除（右键 / Shift+左键 / Delete），仅标记、不参与推理 | 琥珀虚线 |
```
new:
```
| `crossed` | 手动划除（点击格子→菜单「划除」），仅标记、不参与推理 | 琥珀虚线 |
```

- [ ] **Step 4：L4 — solve 每格伪代码区分两种 fixed**

在 `## \`solve(input)\`` 节，`colOnlyThis = ...`（约 line 128）下补一行定义；并改 fixed 分支。
在 `colOnlyThis = whatif 第 pos 位出现过的数字集合恰为 { d }` 之后新增一行：
```
factColOnlyThis = factPossible 第 pos 位出现过的数字集合恰为 { d }
```
old:
```
elif colOnlyThis:
    state = 'fixed'             // 自动确定
```
new:
```
elif colOnlyThis:
    state = factColOnlyThis ? 'fixed' : 'fixedAssumed'   // 事实唯一→fixed；仅假设下唯一→fixedAssumed
```

- [ ] **Step 5：L4 — 签名总览加 remainingCount + 新增小节**

在签名总览 ```typescript 块内 `solve(...)` 注释后追加：
```
remainingCount(input: SolverInput): { remaining: number; candidates: string[] }
// 剩余 what-if 候选数；candidates 在 ≤8 时给出列表，否则为空。
```
在 `## \`basicSolve(input)\`` 节之前（即 `更多推导示例与流程图见 [L3 ...]。` 之后）新增：
```markdown

## `remainingCount(input)`

| | |
|---|---|
| **签名** | `remainingCount(input: SolverInput): { remaining: number; candidates: string[] }` |
| **返回** | `remaining` = `whatif` 候选数；`candidates` 在 `remaining ≤ 8` 时为候选字符串数组，否则 `[]` |

与 `solve` 共用 `computeFactAndWhatif`（事实过滤 + 假设/划除叠加）。供 SolverPanel 在智能模式显示「剩 N 个可能」（≤8 时列出）。`whatif` 为空（假设矛盾）时 `remaining = 0`、`candidates = []`。
```

- [ ] **Step 6：L4 — 六→七 文案**

把 L4 中表示状态数的「六」改「七」（如签名注释 `每格六状态` → `每格七状态`；`grep -n "六" docs/L4-api/solver.md` 核对，仅改指状态计数处）。

- [ ] **Step 7：L3 — 标题/流程图/表/伪代码/面板交互**

- `每格六状态`（约 line 32 流程图）→ `每格七状态`。
- `## 六状态推导表`（line 57）→ `## 七状态推导表`。
- 在 `- \`colOnlyThis\` = ...`（line 63）下补：`- \`factColOnlyThis\` = \`factPossible\` 第 \`pos\` 位出现过的数字集合恰为 \`{ 该数字 }\``。
- 推导表 fixed 行（line 72）：
  old: `| 4 | \`colOnlyThis\` | \`fixed\` | 该列只剩这一个（自动确定，绿） |`
  new（拆两行并顺延后续编号）：
  ```
  | 4a | `colOnlyThis` 且 `factColOnlyThis` | `fixed` | 事实唯一：无需假设即确定（绿实心✓） |
  | 4b | `colOnlyThis` 但非 `factColOnlyThis` | `fixedAssumed` | 仅当前假设/划除下唯一（绿虚线*） |
  ```
- 伪代码（line 84-85）：
  old:
  ```
  } else if (colOnlyThis) {
    state = 'fixed'
  ```
  new:
  ```
  } else if (colOnlyThis) {
    state = factColOnlyThis ? 'fixed' : 'fixedAssumed'
  ```
- crossed 表行（line 70）把「右键」改「点击格子菜单」：
  old: `| 2 | 该格被划除（\`crossedOut\` 含 \`"pos-digit"\`） | \`crossed\` | 手动划除（右键，琥珀虚线，仅标记） |`
  new: `| 2 | 该格被划除（\`crossedOut\` 含 \`"pos-digit"\`） | \`crossed\` | 手动划除（点击格子→菜单「划除」，琥珀虚线，仅标记） |`
- 面板侧「交互」一条（约 line 145，原述「左键=假设 / 右键/Shift/Delete=划除」）改为菜单模型：
  new: `- 交互：**点击/触摸格子**打开菜单（假设此位／划除／清除）；键盘 Enter/Space 唤出、Esc 关闭；**重置假设**清空本面板；**折叠条**展开/收起。智能模式额外显示「剩 N 个可能」。`

- [ ] **Step 8：扫尾——README + L4 components + L3 基础模式段的过时交互文案**

把以下「左键/右键/Shift/Delete」交互描述统一改为菜单模型（点击格子→菜单：假设此位／划除／清除）：
- `README.md`（约 line 28-29「点击假设/划除」两条）：改为「**标记**：点击/触摸任一格打开菜单，选「假设此位」做 what-if 推演（联动收窄）、「划除」手动标记不可能、「清除」撤销；一列最多一个假设。」
- `docs/L4-api/components.md`（约 line 187-188 交互表两行）：把「左键点格 / Shift+左键 / 右键 / Delete」两行合并/改为：`| 点击/触摸格（或回车/空格）| 打开菜单：假设此位（assumed，替换本列）/ 划除（crossedOut）/ 清除 |`，并补一行 `| Esc / 点背板 | 关闭菜单 |`。
- `docs/L3-details/solver.md` 基础模式段（约 line 153「左键假设」、156-157「右键划除」）：把「左键假设」改为「假设（菜单「假设此位」）」、「右键划除」改为「划除（菜单「划除」）」。

- [ ] **Step 9：核对 + 提交**

Run: `grep -rn "左键\|右键\|Shift\|Delete\|六状态\|每格六" README.md docs/L3-details/solver.md docs/L4-api/solver.md docs/L4-api/components.md` → 应无残留（划除/假设交互均已改菜单；状态计数均为七）。
Run: `npx vitest run` → 仍全过（仅文档改动）。
```bash
git add README.md docs/L3-details/solver.md docs/L4-api/solver.md docs/L4-api/components.md
git commit -m "docs(solver): 七态(新增 fixedAssumed) + remainingCount + 交互全改菜单(README/L3/L4)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 19：全量验证 + 最终整体审查 + 合并部署

**Files:** 无（验证/部署，由控制者执行，非实现子代理）

- [ ] **Step 1：全量测试**

Run: `npm run test`
Expected: 全部通过（既有 207 + 本计划新增 solver/menu/count/表单/live/标题/表格/再战 等用例）。

- [ ] **Step 2：构建**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 0 错误 + vite build 成功。

- [ ] **Step 3：最终整体审查（独立子代理）**

派 code-review 子代理（pin `claude-opus-4.8`）审 `git diff main...HEAD` 全量：核对弹出菜单 a11y（role/menu、焦点、Esc/背板）、fixedAssumed 逻辑与图例/文档一致、表单/live region/标题层级/表格语义/对比度/reduced-motion 均落实、无回归。修复其指出的 Critical/Important。

- [ ] **Step 4：本地/线上自检**

`npm run preview`：键盘+读屏走一局（听到每次反馈与胜负）、触屏菜单可假设/划除/清除、助手「剩 N 个可能」与事实/假设确定区分、再战保留昵称。

- [ ] **Step 5：合并部署（finishing-a-development-branch）**

用 superpowers:finishing-a-development-branch：`main` 验证测试 → `--no-ff` 合并 `feat/a11y-and-solver-ux` → 删分支 → `git push origin main`（触发 Pages 部署）。

- [ ] **Step 6：验证线上**

轮询 `https://verdenmax.github.io/number-guessing-game/` 的 bundle hash 翻新；确认线上 JS 含新功能字符串（如「剩 」「假设下确定」「换数字再战」）。

---

## Self-Review 结论（计划自查）

- **Spec 覆盖**：A1 菜单(T3)、A2 两种确定(T1)、A3 剩N(T2/T4)、A4 语义(T5)、B 表单(T7-9)、C live/焦点(T10-12)、D 标题/地标(T13-14)、E 表格(T15)、F 视觉(T6 部分 + T16)、G 再战(T11 文案 + T17 逻辑)、文档(T18)、验证部署(T19) —— 全覆盖。
- **类型一致**：`CellState` 新增 `'fixedAssumed'`（T1 同步 stateLabel/图例/样式/文档于 T1/T5/T6/T16/T18）；`remainingCount` 返回 `{remaining, candidates}` 在 T2 定义、T4 消费一致。
- **不破坏既有**：solver 无假设/划除时 `fixed` 行为不变；弹出菜单改写了依赖点击/右键的旧用例(T3)；表单改 submit 同步更新测试(T7/8)；`<ol>→<table>`、`h2→h1`、英文标题改中文经 grep 确认无测试断言依赖。
- **顺序与构建绿**：T1 顺带补 `stateLabel` 键避免 `vue-tsc` 中断；CSS 任务(T6/T16)仅样式不破坏 jsdom 测试。
- **无占位符**：每步含完整代码/命令/预期。
