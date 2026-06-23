# 助手交互方式开关（菜单 / 右键快捷）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 SolverPanel 加一个全局、持久化的「交互方式」开关——默认点击弹菜单（现状），勾选「🖱 右键快捷」恢复旧的左键假设/右键划除手势；并顺手修 B1（昵称接入对局）+ B2（菜单视口夹取）。

**Architecture:** 新增模块级单例 composable `useInteractionMode`（`ref` + localStorage），两个 SolverPanel 共享同一 ref → 全局同步 + 记住。SolverPanel 的格子事件按 `mode` 分流到「弹菜单」或恢复的「toggle 手势」，复用现有菜单逻辑不变。B1/B2 为同区域顺带修复。

**Tech Stack:** Vue 3 `<script setup>` + TS + Vite；Vitest + @vue/test-utils（jsdom）；全局 CSS `src/style.css`；构建 `vue-tsc --noEmit` + `vite build`。

**基线：** 分支 `feat/solver-interaction-mode`（基于 main）；现有 249 测试全过；`npm run build` 干净。设计见 `docs/superpowers/specs/2026-06-23-solver-interaction-mode-design.md`。

---

## 文件结构（触点）

- **新增** `src/composables/useInteractionMode.ts` — 模块级共享 `Ref<'menu'|'gesture'>` + localStorage 读写。
- **新增** `src/composables/useInteractionMode.test.ts` — 默认/持久化/共享单例/异常降级。
- `src/components/SolverPanel.vue`(+test) — 接入 composable；恢复 `toggleAssumption`/`toggleCrossOut`；`onCellClick`/`onCellContext`/`onCellDelete` 按模式分流；`isGesture`/`gestureChecked` computed；切到 gesture 关菜单；底部勾选框；legend-ops/aria 自适应。
- `src/style.css` — `.solver-footer`（两端对齐）+ `.solver-imode`（复选框尺寸重置）。
- `src/components/PlayView.vue`(+test)、`src/App.vue`(+test) — **B1**：names 接入对局页。
- `src/components/SolverPanel.vue`（`openMenu`）— **B2**：菜单视口夹取。
- `docs/L3-details/solver.md`、`docs/L4-api/components.md` — 补「交互方式开关」。

---

## Task 1：`useInteractionMode` composable（全局单例 + localStorage）

**Files:**
- Create: `src/composables/useInteractionMode.ts`
- Test: `src/composables/useInteractionMode.test.ts`

- [ ] **Step 1：写失败测试**

创建 `src/composables/useInteractionMode.test.ts`：
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

describe('useInteractionMode', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules() // 让模块级单例随每个用例重新初始化
  })

  it('默认 menu（localStorage 空时）', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('menu')
  })

  it('启动时从 localStorage 读取已存偏好', async () => {
    localStorage.setItem('ngg:solver-interaction', 'gesture')
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('gesture')
  })

  it('非法存值回退 menu', async () => {
    localStorage.setItem('ngg:solver-interaction', 'xyz')
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('menu')
  })

  it('切换后写入 localStorage', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    const mode = useInteractionMode()
    mode.value = 'gesture'
    await nextTick()
    expect(localStorage.getItem('ngg:solver-interaction')).toBe('gesture')
  })

  it('两次调用返回同一共享 ref（全局同步）', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    const a = useInteractionMode()
    const b = useInteractionMode()
    a.value = 'gesture'
    expect(b.value).toBe('gesture')
    expect(a).toBe(b)
  })

  it('localStorage 抛错时不崩（隐私模式降级）', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { useInteractionMode } = await import('./useInteractionMode')
    const mode = useInteractionMode()
    expect(() => {
      mode.value = 'gesture'
    }).not.toThrow()
    await nextTick()
    expect(mode.value).toBe('gesture') // 内存仍生效
    spy.mockRestore()
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run src/composables/useInteractionMode.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3：实现 composable**

创建 `src/composables/useInteractionMode.ts`：
```typescript
import { ref, watch, type Ref } from 'vue'

export type InteractionMode = 'menu' | 'gesture'

const KEY = 'ngg:solver-interaction'

function load(): InteractionMode {
  try {
    return localStorage.getItem(KEY) === 'gesture' ? 'gesture' : 'menu'
  } catch {
    return 'menu'
  }
}

// 模块级单例：所有 SolverPanel 共享同一 ref → 天然全局同步
const mode = ref<InteractionMode>(load())

watch(
  mode,
  (v) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // localStorage 不可用（隐私模式）→ 仅内存生效
    }
  },
  { flush: 'sync' },
)

export function useInteractionMode(): Ref<InteractionMode> {
  return mode
}
```

- [ ] **Step 4：运行测试 + 类型检查**

Run: `npx vitest run src/composables/useInteractionMode.test.ts` → PASS（6 个用例）。
Run: `npx vue-tsc --noEmit` → 0 错误。

- [ ] **Step 5：Commit**

```bash
git add src/composables/useInteractionMode.ts src/composables/useInteractionMode.test.ts
git commit -m "feat(solver): useInteractionMode composable（全局单例 + localStorage 记住）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2：SolverPanel 按模式分流 + 勾选框 + 图例/aria 自适应

**Files:**
- Modify: `src/components/SolverPanel.vue`
- Test: `src/components/SolverPanel.test.ts`

> 关键：`useInteractionMode` 是**模块级单例**，跨测试用例共享。必须在测试文件加 `beforeEach` 把它重置回 `'menu'`，否则 gesture 用例会污染现有 menu 用例。

- [ ] **Step 1：测试加全局重置 + 追加 gesture 用例**

在 `src/components/SolverPanel.test.ts` 顶部，把 vitest 导入补上 `beforeEach`（`import { describe, it, expect, beforeEach } from 'vitest'`），并 `import { useInteractionMode } from '../composables/useInteractionMode'`。在所有 describe 之前（顶层）加：
```typescript
beforeEach(() => {
  localStorage.clear()
  useInteractionMode().value = 'menu' // 单例：每个用例从默认菜单模式开始
})
```
在文件末尾追加：
```typescript
describe('SolverPanel 交互方式开关（菜单/右键快捷）', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }
  async function setGesture(w: ReturnType<typeof mount>, on: boolean) {
    await w.find('.solver-imode input').setValue(on)
    await w.vm.$nextTick()
  }

  it('勾选「右键快捷」→ 左键点格直接假设（不弹菜单）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(false)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('快捷模式：右键划除 + 再次取消 + Shift+左键划除 + Delete 划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    const idx = 7 * 4 + 1
    await w.findAll('.solver-cell')[idx].trigger('contextmenu')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('crossed')
    await w.findAll('.solver-cell')[idx].trigger('contextmenu')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('available')
    await w.findAll('.solver-cell')[idx].trigger('click', { shiftKey: true })
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('crossed')
    const idx2 = 4 * 4 + 2
    await w.findAll('.solver-cell')[idx2].trigger('keydown', { key: 'Delete' })
    expect(w.findAll('.solver-cell')[idx2].classes()).toContain('crossed')
  })

  it('快捷模式：同列替换假设、再点同格取消', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    await w.findAll('.solver-cell')[3 * 4 + 0].trigger('click')
    expect(w.findAll('.solver-cell')[3 * 4 + 0].classes()).toContain('assumed')
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).not.toContain('assumed')
    await w.findAll('.solver-cell')[3 * 4 + 0].trigger('click') // 再点取消
    expect(w.findAll('.solver-cell')[3 * 4 + 0].classes()).toContain('available')
  })

  it('默认菜单模式不变：点格弹菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(true)
  })

  it('全局共享：一侧勾选，另一侧勾选框也变 checked', async () => {
    const red = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    const blue = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'blue' } })
    await red.find('.solver-toggle').trigger('click')
    await blue.find('.solver-toggle').trigger('click')
    await red.vm.$nextTick()
    await blue.vm.$nextTick()
    await red.find('.solver-imode input').setValue(true)
    await blue.vm.$nextTick()
    expect((blue.find('.solver-imode input').element as HTMLInputElement).checked).toBe(true)
  })

  it('切到快捷模式时关闭已打开的菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(true)
    await setGesture(w, true)
    expect(w.find('.solver-menu').exists()).toBe(false)
  })

  it('legend-ops 文案随模式变化', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.find('.solver-help-btn').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.legend-ops').text()).toContain('菜单')
    await setGesture(w, true)
    expect(w.find('.legend-ops').text()).toContain('右键')
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts`
Expected: FAIL —— 无 `.solver-imode`；gesture 行为未实现。

- [ ] **Step 3：SolverPanel.vue script —— 接入 composable + 恢复手势 + 分流**

第 2 行 import 加 `watch`：
```typescript
import { ref, computed, nextTick, watch } from 'vue'
```
在 `import { solve, ... }` 之后加：
```typescript
import { useInteractionMode } from '../composables/useInteractionMode'
```
在 `const crossedOut = ...`（line 16）之后加：
```typescript
const mode = useInteractionMode()
const isGesture = computed(() => mode.value === 'gesture')
const gestureChecked = computed({
  get: () => mode.value === 'gesture',
  set: (v: boolean) => {
    mode.value = v ? 'gesture' : 'menu'
  },
})
```
在 `reset()` 函数（line 127-130）**之前**，加入恢复的手势函数 + 分流 + 切模式关菜单：
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

function onCellClick(e: MouseEvent, pos: number, digit: number) {
  if (isGesture.value) {
    if (e.shiftKey) toggleCrossOut(pos, digit)
    else toggleAssumption(pos, digit)
  } else {
    openMenu(e, pos, digit)
  }
}

function onCellContext(e: MouseEvent, pos: number, digit: number) {
  if (isGesture.value) toggleCrossOut(pos, digit)
  else openMenu(e, pos, digit)
}

function onCellDelete(pos: number, digit: number) {
  if (isGesture.value) toggleCrossOut(pos, digit)
}

// 切到快捷模式时，软关闭任何打开的菜单（不抢焦点）
watch(mode, (m) => {
  if (m === 'gesture' && menuFor.value) {
    menuFor.value = null
    triggerEl = null
  }
})
```

- [ ] **Step 4：SolverPanel.vue template —— 格子事件/aria + legend-ops + 底部勾选框**

将格子按钮（line 187-201）改为：
```vue
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${stateLabel[grid[pos - 1][digit - 1]]}${isGesture ? '（左键假设/右键划除）' : ''}`"
            :aria-pressed="grid[pos - 1][digit - 1] === 'assumed'"
            :aria-haspopup="isGesture ? null : 'menu'"
            :aria-expanded="isGesture ? null : isMenuOpen(pos - 1, digit - 1)"
            @click="onCellClick($event, pos - 1, digit - 1)"
            @contextmenu.prevent="onCellContext($event, pos - 1, digit - 1)"
            @keydown.delete.prevent="onCellDelete(pos - 1, digit - 1)"
          >
            {{ digit - 1 }}
          </button>
```
将 legend-ops（line 179）改为按模式自适应：
```vue
        <p class="legend-ops">
          {{ isGesture ? '左键＝假设此位 · 右键／Shift+左键／Delete＝划除 · 再点取消 · 「重置假设」清空全部' : '点击格子打开菜单：假设此位／划除／清除 · 「重置假设」清空全部' }}
        </p>
```
将底部「重置假设」按钮（line 231）替换为底部行（勾选框 + 重置）：
```vue
      <div class="solver-footer">
        <label class="solver-imode">
          <input type="checkbox" v-model="gestureChecked" />
          <span aria-hidden="true">🖱</span> 右键快捷
        </label>
        <button type="button" class="solver-reset" @click="reset">重置假设</button>
      </div>
```

- [ ] **Step 5：运行测试 + 类型检查 + 全量**

Run: `npx vitest run src/components/SolverPanel.test.ts` → PASS（现有菜单用例 + 新 gesture 用例全过；`beforeEach` 保证默认菜单模式）。
Run: `npx vue-tsc --noEmit` → 0 错误（注意 `:aria-haspopup="isGesture ? null : 'menu'"` 用 null 省略属性）。
Run: `npx vitest run` → 全过。

- [ ] **Step 6：Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "feat(solver): 交互方式开关——勾选右键快捷恢复左键假设/右键划除手势，默认菜单不变

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3：底部行与勾选框样式

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1：新增 `.solver-footer` + `.solver-imode`（solver 区域附近）**

```css
.solver-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.solver-imode {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}
/* 复选框重置：避免被全局 input 的 flex/width/padding 拉大（同 .solver-mode input） */
.solver-imode input {
  flex: none;
  width: auto;
  padding: 0;
  margin: 0;
  cursor: pointer;
}
```

- [ ] **Step 2：全量测试 + 构建**

Run: `npx vitest run` → 全过（CSS 不影响 jsdom）。
Run: `npm run build` → `vue-tsc --noEmit` 0 错误 + vite build 成功。

- [ ] **Step 3：视觉自检（headless，可选）**

构建后渲染展开的面板底部，确认：复选框为正常小尺寸（未被全局 input 拉大）、「🖱 右键快捷」在左、「重置假设」在右、两端对齐。完成后删除临时文件。

- [ ] **Step 4：Commit**

```bash
git add src/style.css
git commit -m "style(solver): 底部行(右键快捷勾选框 + 重置假设)两端对齐 + 复选框尺寸重置

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4：B1 — 昵称接入对局页（PlayView + App）

**Files:**
- Modify: `src/components/PlayView.vue`、`src/App.vue`
- Test: `src/components/PlayView.test.ts`、`src/App.test.ts`

- [ ] **Step 1：写失败测试**

`src/components/PlayView.test.ts` 追加（沿用文件内 `okValidate`）：
```typescript
  it('对局中显示昵称（轮次标签/历史标题/播报）', () => {
    const history = { p1: [{ guess: '1234', feedback: 2 }], p2: [] }
    const names = { p1: 'Alice', p2: 'Bob' }
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history, names } })
    expect(w.text()).toContain('Alice') // 轮次标签 + p1 历史标题 + 播报
    expect(w.text()).toContain('Bob') // p2 历史标题
    expect(w.text()).not.toContain('红方') // 已被昵称替代
  })

  it('不传 names 时回退红/蓝方', () => {
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history: { p1: [], p2: [] } } })
    expect(w.text()).toContain('红方')
    expect(w.text()).toContain('蓝方')
  })
```
`src/App.test.ts` 追加：
```typescript
  it('App 透传 names 到 PlayView（对局中可用昵称）', async () => {
    const w = mount(App)
    const sv = w.findComponent(SetupView)
    sv.vm.$emit('setName', 'p1', '红哥')
    sv.vm.$emit('setName', 'p2', '蓝妹')
    sv.vm.$emit('setSecret', 'p1', '1234')
    sv.vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).props('names')).toEqual({ p1: '红哥', p2: '蓝妹' })
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/PlayView.test.ts src/App.test.ts`
Expected: FAIL —— PlayView 无 names prop（显示红/蓝方）；App 未透传。

- [ ] **Step 3：改 PlayView.vue**

把 `defineProps` 类型加 `names?`：
```typescript
const props = defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  names?: { p1: string | null; p2: string | null }
}>()
```
把 `announceText` 里的 `sideName(last.who)` 改为 `sideName(last.who, props.names)`。
模板中：
- 输入标签 `:label="`${sideName(current)}输入`"` → `:label="`${sideName(current, names)}输入`"`。
- 两个 `<HistoryList>` 的 `title="红方"` / `title="蓝方"` → `:title="sideName('p1', names)"` / `:title="sideName('p2', names)"`。

- [ ] **Step 4：改 App.vue**

给 `<PlayView ...>` 加 `:names="names"`（与既有 `:history="state.history"` 并列）。

- [ ] **Step 5：测试 + 类型检查**

Run: `npx vitest run src/components/PlayView.test.ts src/App.test.ts` → PASS。
Run: `npx vue-tsc --noEmit` → 0 错误。
Run: `npx vitest run` → 全过。

- [ ] **Step 6：Commit**

```bash
git add src/components/PlayView.vue src/App.vue src/components/PlayView.test.ts src/App.test.ts
git commit -m "fix(b1): 昵称接入对局页（轮次标签/历史标题/读屏播报用昵称）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5：B2 — 弹出菜单视口夹取（openMenu）

**Files:**
- Modify: `src/components/SolverPanel.vue`（`openMenu`）
- Test: `src/components/SolverPanel.test.ts`

- [ ] **Step 1：写失败测试**

在 `src/components/SolverPanel.test.ts` 顶部 vitest 导入补 `vi`（`import { describe, it, expect, beforeEach, vi } from 'vitest'`）。在「交互方式开关」describe 内（或新 describe）追加：
```typescript
  it('B2 菜单视口夹取：靠右靠下单元格不溢出', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const cell = w.findAll('.solver-cell')[5 * 4 + 3] // 最右列
    vi.spyOn(cell.element, 'getBoundingClientRect').mockReturnValue({
      left: 1000, right: 1040, top: 700, bottom: 740, width: 40, height: 40, x: 1000, y: 700,
      toJSON: () => ({}),
    } as DOMRect)
    await cell.trigger('click')
    const style = (w.find('.solver-menu').element as HTMLElement).style
    const left = parseFloat(style.left)
    const top = parseFloat(style.top)
    expect(left).toBeLessThanOrEqual(window.innerWidth - 120 - 8 + 0.5) // 不溢出右
    expect(top + 132).toBeLessThanOrEqual(window.innerHeight + 0.5) // 不溢出下（必要时上弹）
    expect(left).toBeGreaterThanOrEqual(8)
    expect(top).toBeGreaterThanOrEqual(8)
  })
```

- [ ] **Step 2：确认失败**

Run: `npx vitest run src/components/SolverPanel.test.ts -t "视口夹取"`
Expected: FAIL —— 当前 `top = r.bottom = 740`，`740 + 132 = 872 > 768` 溢出。

- [ ] **Step 3：改 `openMenu` 加夹取**

将 `openMenu`（line 65-75）中设置 `menuStyle` 的部分：
```typescript
  triggerEl = e.currentTarget as HTMLElement
  const r = triggerEl.getBoundingClientRect()
  menuStyle.value = { left: `${r.left}px`, top: `${r.bottom}px` }
  menuFor.value = { pos, digit }
```
改为：
```typescript
  triggerEl = e.currentTarget as HTMLElement
  const r = triggerEl.getBoundingClientRect()
  const MENU_W = 120
  const MENU_H = 132
  const pad = 8
  let left = Math.min(r.left, window.innerWidth - MENU_W - pad)
  left = Math.max(pad, left)
  let top = r.bottom
  if (top + MENU_H > window.innerHeight) top = r.top - MENU_H // 下方不够 → 向上弹
  top = Math.max(pad, Math.min(top, window.innerHeight - MENU_H - pad))
  menuStyle.value = { left: `${left}px`, top: `${top}px` }
  menuFor.value = { pos, digit }
```

- [ ] **Step 4：测试 + 类型检查 + 全量**

Run: `npx vitest run src/components/SolverPanel.test.ts` → PASS（含夹取用例 + 既有菜单用例——既有用例 rect 为 0，夹取后落在 (8,8) 不影响断言）。
Run: `npx vue-tsc --noEmit` → 0 错误。
Run: `npx vitest run` → 全过。

- [ ] **Step 5：视觉自检（headless，建议）**

构建后用 puppeteer-core 设窄视口（如 380×640），渲染面板、点最右列/最底行格子，确认菜单完整在视口内（向上弹、左移）。删除临时文件。

- [ ] **Step 6：Commit**

```bash
git add src/components/SolverPanel.vue src/components/SolverPanel.test.ts
git commit -m "fix(b2): 弹出菜单视口夹取（靠右左移、靠下上弹，不溢出屏幕）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6：文档（L3/L4 补交互方式开关）

**Files:**
- Modify: `docs/L3-details/solver.md`、`docs/L4-api/components.md`

- [ ] **Step 1：L3 面板侧补一条交互方式说明**

在 L3 `## 面板侧（`SolverPanel.vue`）` 的「交互」一条之后，新增：
```markdown
- 交互方式开关（全局、`localStorage` 记住，默认「点击菜单」）：底部勾选「🖱 右键快捷」切到旧手势——左键＝假设、右键／Shift+左键／Delete＝划除、再点取消；不勾＝点击格子弹菜单。两侧面板共享同一全局偏好（composable `useInteractionMode`）。
```

- [ ] **Step 2：L4 components 交互表补两行**

在 `docs/L4-api/components.md` 的 SolverPanel 交互表追加：
```markdown
| 🖱 右键快捷（勾选，全局/记住） | 切到手势模式：左键假设 · 右键/Shift+左键/Delete 划除 · 再点取消（不弹菜单） |
| 默认（不勾选） | 点击/触摸/回车 弹菜单（假设此位/划除/清除） |
```
并在该文件状态/说明处补一句：交互方式由 composable `useInteractionMode`（`src/composables/useInteractionMode.ts`，`'menu' | 'gesture'`，存 `localStorage` 键 `ngg:solver-interaction`）提供，红蓝两面板共享。

- [ ] **Step 3：核对 + 提交**

Run: `npx vitest run` → 仍全过（仅文档）。
```bash
git add docs/L3-details/solver.md docs/L4-api/components.md
git commit -m "docs: 补助手交互方式开关（菜单/右键快捷，全局+记住）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7：全量验证 + 整体审查 + 合并部署

**Files:** 无（验证/部署，控制者执行）

- [ ] **Step 1：全量测试 + 构建**

Run: `npm run test` → 全过（既有 249 + 新增 composable/gesture/B1/B2 用例）。
Run: `npm run build` → `vue-tsc --noEmit` 0 错误 + vite build 成功。

- [ ] **Step 2：本地/线上自检**

`npm run preview`：默认点击弹菜单；勾选「🖱 右键快捷」→ 左键假设/右键划除/再点取消；刷新仍是快捷模式；红蓝两侧同步；对局页显示昵称；窄屏菜单不溢出。

- [ ] **Step 3：最终整体审查（独立子代理，pin opus-4.8）**

审 `git diff main...HEAD`：composable 单例/持久化、模式分流不破坏菜单、全局同步、B1 昵称三处、B2 夹取、a11y（勾选框 label、aria 自适应）、无回归。修复 Critical/Important。

- [ ] **Step 4：合并部署（finishing-a-development-branch）**

main 验证 → `--no-ff` 合并 `feat/solver-interaction-mode` → 删分支 → `git push origin main`（触发 Pages 部署）→ 轮询 bundle hash 翻新 → 确认线上含「右键快捷」字符串。

---

## Self-Review 结论（计划自查）

- **Spec 覆盖**：composable(T1)、模式分流+勾选框+同步+图例/aria(T2)、样式(T3)、B1 昵称(T4)、B2 夹取(T5)、文档(T6)、验证部署(T7) —— 全覆盖。
- **类型一致**：`InteractionMode='menu'|'gesture'`；`useInteractionMode(): Ref<InteractionMode>`（T1 定义、T2 消费一致）；`gestureChecked` computed get/set 布尔映射。
- **不破坏既有**：menu 模式分流后行为与现状一致（现有菜单用例全绿即证）；测试加 `beforeEach` 重置全局单例避免污染；B2 夹取对 0-rect 既有用例不改变断言。
- **无占位符**：每步含完整代码/命令/预期。
