# 解算器「智能/基础」推理开关 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给每个推理助手面板加一个「智能推理」开关，可从默认的枚举式智能推理切换到只做排除、不自动判定确定的「基础模式」。

**Architecture:** 方案 A——`src/game/solver.ts` 新增独立纯函数 `basicSolve(input: SolverInput): Grid`，与现有枚举式 `solve` 并列同签名；`SolverPanel.vue` 加每面板独立的 `smartMode` ref（默认 true），网格按开关在 `solve`/`basicSolve` 间切换，图例随模式自适应。

**Tech Stack:** Vue 3（`<script setup>` + TS）、Vite、Vitest + `@vue/test-utils`。

关联设计文档：`docs/superpowers/specs/2026-06-23-solver-basic-mode-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/game/solver.ts` | 改 | 新增纯函数 `basicSolve`（只排除：反馈0 + 假设行列；不产生 fixed） |
| `src/game/solver.test.ts` | 改 | 新增 `describe('basicSolve')` 穷尽单测（复用模块级 `baseInput`） |
| `src/components/SolverPanel.vue` | 改 | `smartMode` 开关 + 控件 + 网格按模式选用 + 图例自适应 |
| `src/components/SolverPanel.test.ts` | 改 | 默认/切换/图例随模式/保留手动标记 用例 |
| `src/style.css` | 改 | `.solver-help-bar` 改 space-between + `.solver-mode` 开关样式 |
| `docs/L3-details/solver.md`、`docs/L4-api/solver.md` | 改 | 补「基础模式」规则与 `basicSolve` 签名 |

**依赖顺序**：T1（basicSolve）→ T2（开关 + 网格选用）→ T3（图例自适应）→ T4（样式）→ T5（文档）→ T6（验证+部署）。

---

## Task 1: `basicSolve` 纯函数

**Files:**
- Modify: `src/game/solver.ts`
- Test: `src/game/solver.test.ts`

- [ ] **Step 1: 在 `src/game/solver.test.ts` 顶部 import 加入 `basicSolve`**

把第 2 行：
```typescript
import { enumerateCandidates, filterByFacts, solve } from './solver'
```
改为：
```typescript
import { enumerateCandidates, filterByFacts, solve, basicSolve } from './solver'
```

- [ ] **Step 2: 在文件末尾（最后一个 `})` 之后）追加失败测试**

```typescript
describe('basicSolve（基础模式：只排除、不确定）', () => {
  it('反馈=0 → 该猜测每位数字在对应位置 eliminated', () => {
    const g = basicSolve(baseInput({ guesses: [{ guess: '0000', feedback: 0 }] }))
    for (let p = 0; p < 4; p++) expect(g[p][0]).toBe('eliminated')
    expect(g[0][5]).toBe('available') // 其它数字不受影响
  })

  it('非反馈0 的猜测不产生事实排除', () => {
    const g = basicSolve(baseInput({ guesses: [{ guess: '1234', feedback: 1 }] }))
    expect(g.flat().every((s) => s === 'available')).toBe(true)
  })

  it('假设格 → 自身 assumed；同行其它位置该数字 + 同列其它数字 eliminated', () => {
    const g = basicSolve(baseInput({ assumptions: [5, null, null, null] })) // pos0=5
    expect(g[0][5]).toBe('assumed')
    expect(g[0][3]).toBe('eliminated') // 同列(pos0)其它数字
    expect(g[1][5]).toBe('eliminated') // 同行(数字5)其它位置
    expect(g[2][5]).toBe('eliminated')
    expect(g[3][5]).toBe('eliminated')
  })

  it('不自动判 fixed：basic 留 available，而 solve 判 fixed（对比）', () => {
    // 反馈=0 排除 pos0 的 0..8（每个猜测 pos0=d、其余位填 9）
    const guesses = Array.from({ length: 9 }, (_, d) => ({ guess: `${d}999`, feedback: 0 }))
    const inp = baseInput({ guesses })
    expect(basicSolve(inp)[0][9]).toBe('available')
    expect(solve(inp)[0][9]).toBe('fixed')
  })

  it('两位假设同一数字 → 两假设格 conflict', () => {
    const g = basicSolve(baseInput({ assumptions: [5, 5, null, null] }))
    expect(g[0][5]).toBe('conflict')
    expect(g[1][5]).toBe('conflict')
  })

  it('假设一个反馈=0 已排除的格 → conflict', () => {
    const g = basicSolve(
      baseInput({ guesses: [{ guess: '5000', feedback: 0 }], assumptions: [5, null, null, null] }),
    )
    expect(g[0][5]).toBe('conflict')
  })

  it('右键划除 → crossed；默认 available；无效假设不误排除', () => {
    const g = basicSolve(baseInput({ crossedOut: new Set(['0-7']), assumptions: [99, null, null, null] }))
    expect(g[0][7]).toBe('crossed')
    expect(g[1][1]).toBe('available')
    // 越界假设(99)被忽略，不产生任何排除
    expect(g.flat().filter((s) => s === 'eliminated')).toHaveLength(0)
  })

  it('既假设又划除同一格：假设优先（与智能模式一致，划除不掩盖矛盾）', () => {
    // 假设 pos0=5 同时右键划除 pos0=5 → 显示 assumed（不被 crossed 掩盖）
    const g1 = basicSolve(baseInput({ assumptions: [5, null, null, null], crossedOut: new Set(['0-5']) }))
    expect(g1[0][5]).toBe('assumed')
    // 两位假设同数字 + 划除其一 → 仍 conflict（不被 crossed 掩盖）
    const g2 = basicSolve(baseInput({ assumptions: [5, 5, null, null], crossedOut: new Set(['0-5']) }))
    expect(g2[0][5]).toBe('conflict')
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/game/solver.test.ts`
Expected: FAIL —— `basicSolve` 不是导出函数（`is not a function`）。

- [ ] **Step 4: 在 `src/game/solver.ts` 末尾追加 `basicSolve` 实现**

```typescript
export function basicSolve(input: SolverInput): Grid {
  const { digits, guesses, assumptions, crossedOut } = input

  const eliminated = new Set<string>()
  // ① 反馈=0 的事实排除：该猜测每位数字在对应位置不可能
  for (const g of guesses) {
    if (g.feedback === 0) {
      for (let i = 0; i < digits; i++) {
        eliminated.add(`${i}-${Number(g.guess[i])}`)
      }
    }
  }
  // ② 已知正确(用户假设)的行/列排除：仅对有效的 0-9 假设施加
  for (let p = 0; p < digits; p++) {
    const d = assumptions[p]
    if (d != null && d >= 0 && d <= 9) {
      for (let p2 = 0; p2 < digits; p2++) {
        if (p2 !== p) eliminated.add(`${p2}-${d}`) // 行：该数字在其它位置不可能
      }
      for (let d2 = 0; d2 < 10; d2++) {
        if (d2 !== d) eliminated.add(`${p}-${d2}`) // 列：该位置其它数字不可能
      }
    }
  }

  const grid: Grid = []
  for (let pos = 0; pos < digits; pos++) {
    const col: CellState[] = []
    for (let digit = 0; digit < 10; digit++) {
      const key = `${pos}-${digit}`
      let state: CellState
      if (assumptions[pos] === digit) {
        state = eliminated.has(key) ? 'conflict' : 'assumed'
      } else if (crossedOut.has(key)) {
        state = 'crossed'
      } else if (eliminated.has(key)) {
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

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/game/solver.test.ts`
Expected: PASS（原有 solve 用例 + 新增 7 个 basicSolve 用例）。

- [ ] **Step 6: Commit**

```bash
git add src/game/solver.ts src/game/solver.test.ts
git commit -m "feat(solver): 新增 basicSolve 纯函数（基础模式：只排除、不自动判确定）"
```

## Task 2: SolverPanel `smartMode` 开关 + 网格按模式选用

**Files:**
- Modify: `src/components/SolverPanel.vue`
- Test: `src/components/SolverPanel.test.ts`

- [ ] **Step 1: 追加失败测试到 `src/components/SolverPanel.test.ts`**

在文件末尾（最后一个 `})` 之后）追加一个新 describe：

```typescript
describe('SolverPanel 智能/基础开关', () => {
  it('默认智能模式（solve）：构造 fixed 场景该格为 fixed', async () => {
    const guesses = Array.from({ length: 9 }, (_, d) => ({ guess: `${d}999`, feedback: 0 }))
    const w = mount(SolverPanel, { props: { digits: 4, guesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const idx = 9 * 4 + 0 // 行优先：digit=9 行、pos0
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('fixed')
  })

  it('切到基础模式（basicSolve）：同场景该格变 available（不自动判 fixed）', async () => {
    const guesses = Array.from({ length: 9 }, (_, d) => ({ guess: `${d}999`, feedback: 0 }))
    const w = mount(SolverPanel, { props: { digits: 4, guesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const idx = 9 * 4 + 0
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('fixed')

    await w.find('.solver-mode input').setValue(false) // 关闭智能
    await w.vm.$nextTick()
    const cell = w.findAll('.solver-cell')[idx]
    expect(cell.classes()).toContain('available')
    expect(cell.classes()).not.toContain('fixed')
  })

  it('切换模式保留已有假设与划除', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    let cells = w.findAll('.solver-cell')
    await cells[5 * 4 + 0].trigger('click') // 假设 pos0=5
    await cells[7 * 4 + 1].trigger('contextmenu') // 划除 pos1=7
    expect(cells[5 * 4 + 0].classes()).toContain('assumed')

    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    cells = w.findAll('.solver-cell')
    expect(cells[5 * 4 + 0].classes()).toContain('assumed') // 假设保留
    expect(cells[7 * 4 + 1].classes()).toContain('crossed') // 划除保留
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: FAIL —— 找不到 `.solver-mode input`（开关未实现）；切换断言不成立。

- [ ] **Step 3: 修改 `src/components/SolverPanel.vue`**

（a）import 加入 `basicSolve`：
```typescript
import { solve, basicSolve, type CellState } from '../game/solver'
```

（b）在 `const expanded = ref(false)` 之后加 `smartMode`：
```typescript
const expanded = ref(false)
const showHelp = ref(false)
const smartMode = ref(true)
```
（注：`showHelp` 已存在，保持原样；仅在其后/其前新增 `smartMode` 一行——确保两行都在。）

（c）网格计算改为按模式选用。将：
```typescript
const grid = computed(() =>
  solve({
    digits: props.digits,
    guesses: props.guesses,
    assumptions: assumptions.value,
    crossedOut: crossedOut.value,
  }),
)
```
改为：
```typescript
const grid = computed(() =>
  (smartMode.value ? solve : basicSolve)({
    digits: props.digits,
    guesses: props.guesses,
    assumptions: assumptions.value,
    crossedOut: crossedOut.value,
  }),
)
```

（d）在 `.solver-help-bar` 内、`?` 按钮**之前**加入开关控件。将：
```vue
      <div class="solver-help-bar">
        <button
          type="button"
          class="solver-help-btn"
```
改为：
```vue
      <div class="solver-help-bar">
        <label class="solver-mode">
          <input type="checkbox" v-model="smartMode" />
          🧠 智能推理
        </label>
        <button
          type="button"
          class="solver-help-btn"
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: PASS（原有用例 + 新增 3 个开关用例）。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 6: Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): SolverPanel 加智能/基础开关，网格按模式选用 solve/basicSolve"
```

## Task 3: 图例随模式自适应

**Files:**
- Modify: `src/components/SolverPanel.vue`
- Test: `src/components/SolverPanel.test.ts`

- [ ] **Step 1: 追加失败测试到 `src/components/SolverPanel.test.ts`**

在 `describe('SolverPanel 智能/基础开关', ...)` 块内追加：

```typescript
  it('图例随模式自适应：基础模式隐藏「确定」色块、说明文案随之变化', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    await w.find('.solver-help-btn').trigger('click') // 展开图例
    await w.vm.$nextTick()

    // 智能模式：图例含 fixed 色块 + 含「枚举」说明
    expect(w.find('.solver-legend .solver-cell.fixed').exists()).toBe(true)
    expect(w.find('.solver-legend').text()).toContain('枚举')

    // 切基础模式
    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    expect(w.find('.solver-legend .solver-cell.fixed').exists()).toBe(false)
    expect(w.find('.solver-legend').text()).toContain('只标排除')
    expect(w.find('.solver-legend').text()).not.toContain('枚举')
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: FAIL —— 基础模式下 fixed 色块仍在；无「枚举」/「只标排除」说明文案。

- [ ] **Step 3: 修改 `src/components/SolverPanel.vue` 的图例块**

在 `<div v-if="showHelp" class="solver-legend">` 内、`<ul class="legend-list">` **之前**插入模式说明：
```vue
      <div v-if="showHelp" class="solver-legend">
        <p class="legend-mode">
          {{ smartMode ? '智能：枚举推理，自动判定确定/排除' : '基础：只标排除（反馈0 + 已知正确的行列），不自动判确定' }}
        </p>
        <ul class="legend-list">
```
并给「确定」那一项加 `v-if="smartMode"`。将：
```vue
          <li><span class="solver-cell fixed">5</span><span>确定：该位唯一可能就是它</span></li>
```
改为：
```vue
          <li v-if="smartMode">
            <span class="solver-cell fixed">5</span><span>确定：该位唯一可能就是它</span>
          </li>
```
其余图例项不变。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: PASS（新增图例自适应用例通过）。

- [ ] **Step 5: Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): 图例随模式自适应（基础模式隐藏确定行 + 模式说明）"
```

## Task 4: 样式（开关 + 模式说明）

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 改 `.solver-help-bar` 为两端对齐**

将：
```css
.solver-help-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}
```
改为：
```css
.solver-help-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
```

- [ ] **Step 2: 在 `.solver-help-bar` 规则之后追加开关与模式说明样式**

```css
.solver-mode {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}
/* 复选框需重置全局 input 的 flex/width/padding，否则会被拉伸成大框 */
.solver-mode input {
  flex: none;
  width: auto;
  padding: 0;
  margin: 0;
  cursor: pointer;
}
.legend-mode {
  margin: 0 0 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
}
```

- [ ] **Step 3: 运行全部测试，确认未破坏**

Run: `npm run test`
Expected: PASS（CSS 不影响 jsdom 测试，确认无误改）。

- [ ] **Step 4: 构建（类型检查 + 打包）**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 0 错误 + `vite build` 成功。

- [ ] **Step 5: 视觉自检（headless chromium 渲染助手面板片段）**

用 dist CSS 渲染 `.solver > .solver-body`（含 help-bar 的 🧠 智能推理 复选框 + ? 按钮 + 展开的图例），确认：复选框为正常小尺寸（未被全局 input 样式拉大）、开关与 ? 两端对齐、图例顶部有模式说明。可用如下命令（路径替换为实际 dist CSS）：
```bash
# 起静态服务后用 chromium --headless=new --screenshot 截图人工确认
```
（无强制断言，人工目检即可。）

- [ ] **Step 6: Commit**

```bash
git add src/style.css
git commit -m "style(solver): 智能/基础开关与模式说明样式（help-bar 两端对齐 + 复选框尺寸重置）"
```

## Task 5: 文档（L3/L4）

**Files:**
- Modify: `docs/L3-details/solver.md`、`docs/L4-api/solver.md`

- [ ] **Step 1: 在 `docs/L3-details/solver.md` 末尾追加「基础模式」一节**

````markdown
## 基础模式（basicSolve）

助手面板可关闭「智能推理」开关切到基础模式（`basicSolve`）。**只推排除、绝不自动判确定**：

- **规则①（反馈=0 排除）**：任一猜测 `feedback === 0` → 该猜测每位数字在对应位置标排除。
- **规则②（已知正确的行列排除）**：用户左键假设某格 (p,d) 为正确 → 该数字所在**行**的其它位置、该位置所在**列**的其它数字 全部排除（各位互不相同、每位一个数）。
- **不产生 `fixed`**：某列即使只剩一个可能也不自动判「确定(绿)」。
- **矛盾**：假设格落入排除集即 `conflict`（如两个位置假设同一数字、或假设一个反馈=0 已排除的格）。
- 右键划除在基础模式下仅作手动标记，不参与推理。

与智能 `solve`（全枚举 + 事实过滤 + 假设/划除联动 + 自动 fixed）的差异见设计文档
`docs/superpowers/specs/2026-06-23-solver-basic-mode-design.md`。开关每面板独立、默认开启智能、不持久化（刷新回默认）。
````

- [ ] **Step 2: 在 `docs/L4-api/solver.md` 的函数签名区追加 `basicSolve`**

在 `solve` 签名附近追加：
````markdown
```typescript
basicSolve(input: SolverInput): Grid
// 基础模式：只排除（反馈=0 + 假设格行/列），不产生 fixed；与 solve 同签名可互换。
```
````

- [ ] **Step 3: Commit**

```bash
git add docs/L3-details/solver.md docs/L4-api/solver.md
git commit -m "docs(solver): 补基础模式规则(L3) + basicSolve 签名(L4)"
```

## Task 6: 全量验证 + 部署

**Files:** 无（验证与部署）

- [ ] **Step 1: 全量测试**

Run: `npm run test`
Expected: 全部通过（既有 + basicSolve 7 + 开关/图例 4 个新用例）。

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 0 错误；`vite build` 成功。

- [ ] **Step 3: 本地/线上自检**

`npm run preview` 或线上：进对战阶段展开助手 → 看到「🧠 智能推理」复选框；取消勾选 → 网格不再自动出现绿色「确定」格、只保留灰色排除；点 ? 图例顶部说明随模式变化、基础模式不显示「确定」行。切换模式时已有假设/划除保留。

- [ ] **Step 4: 推送部署**

```bash
git push
```
Expected: 推送到 `main`，GitHub Actions 自动构建测试并部署。

- [ ] **Step 5: 验证线上**

等待 Actions `success`，访问 https://verdenmax.github.io/number-guessing-game/ 确认开关生效。

---

## Self-Review 结论（计划自查）

- **Spec 覆盖**：规则①②③(T1)、手动交互保留(T1/T2)、开关默认 true + 每面板独立(T2)、图例自适应(T3)、样式(T4)、文档(T5) 均有对应任务。
- **类型一致**：`basicSolve(input: SolverInput): Grid` 与 `solve` 同签名；复用 `CellState`/`Grid`，不产生 `fixed`；`smartMode: Ref<boolean>` 默认 true。
- **不破坏既有**：grid 计算默认走 `solve`（smartMode=true），既有 SolverPanel 用例不变；basicSolve 为纯新增函数。
- **无占位符**：每步含完整代码与命令。




