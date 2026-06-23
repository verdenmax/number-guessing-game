# 设计：助手交互方式开关（点击菜单 / 右键快捷）

> 日期：2026-06-23 ｜ 分支：`feat/solver-interaction-mode`
> 背景：当前 SolverPanel 用统一的「点击格子弹出菜单（假设此位／划除／清除）」交互（替代了旧的右键/Shift/Delete 手势）。用户希望**两种都保留**：菜单更适配触屏/键盘、旧手势对鼠标用户更快——用一个开关切换。

## 1. 目标 / 决策（已确认）

- 新增一个**全局、持久化**的交互方式偏好 `interactionMode: 'menu' | 'gesture'`。
- **默认 `'menu'`**（触屏可用 + 最易发现）；鼠标用户可勾选切到 `'gesture'`。
- **全局**：一个设置同时作用于红蓝两个面板；存 `localStorage`，刷新/下次打开记得。
- 开关 UI：每个面板底部「重置假设」按钮**旁**的勾选框，两侧绑定同一全局值、互相同步。
- **复用**现有菜单的全部逻辑（`openMenu`/`chooseAssume`/`chooseCross`/`chooseClear`/层级/焦点/Esc/focusout）。本任务只在事件处理上**按模式分流**，并**恢复**旧手势函数作为 gesture 模式的目标。

**非目标**：不改 solver 推理逻辑；不改菜单本身的样式/层级；不增加新的格子状态；不做「快捷模式」的额外清除手势（清除沿用旧的「再次点击/右键取消」）。

## 2. 现状（已核实）

- `SolverPanel.vue`：格子按钮 `@click="openMenu($event,pos,digit)"`、`@contextmenu.prevent="openMenu(...)"`，`aria-haspopup="menu"` + `:aria-expanded`；菜单/背板 `v-if="menuFor"`；底部 `<button class="solver-reset" @click="reset">重置假设</button>`；图例底部 `<p class="legend-ops">点击格子打开菜单：假设此位／划除／清除 · 「重置假设」清空全部</p>`。
- 旧手势函数（`toggleAssumption`/`toggleCrossOut`/`onCellClick`）在引入菜单时被删除——本设计**恢复**它们（语义同旧版：assume 为 per-position 替换式 toggle；cross 为 Set toggle）。
- 已存在每面板本地状态：`assumptions`（`(number|null)[]`）、`crossedOut`（`Set<string>`）、`smartMode`、`expanded`、`showHelp` 及菜单态。

## 3. 架构

### 3.1 `useInteractionMode()` composable（新文件 `src/composables/useInteractionMode.ts`）
- **模块级**（单例）`const mode = ref<InteractionMode>(load())`，两个 SolverPanel `import` 同一份 → 天然同步。
- 启动时从 `localStorage` 读取（key `ngg:solver-interaction`），非法/缺失回退 `'menu'`。
- `watch(mode, v => localStorage.setItem(key, v))` 持久化；`localStorage` 不可用（隐私模式）时 `try/catch` 静默降级（仍在内存中工作）。
- 导出：`type InteractionMode = 'menu' | 'gesture'`；`function useInteractionMode(): Ref<InteractionMode>`（直接返回那个**共享的模块级 ref**——两个面板拿到同一个 ref，天然同步）。SolverPanel 内用一个 `computed` 的 get/set 把它映射成勾选框的布尔（`get: mode.value==='gesture'`，`set: v => mode.value = v ? 'gesture' : 'menu'`）。
- 纯前端、零 DOM 依赖，可单测（注入/清理 `localStorage`）。

### 3.2 SolverPanel 接线
- `const { mode } = useInteractionMode()`；勾选框 `v-model` 绑定 `mode === 'gesture'`（用一个 `computed` 的 get/set，或绑定布尔再映射）。
- 事件分流（格子按钮）：
  - `@click="onCellClick"`：menu 模式 → `openMenu`；gesture 模式 → `toggleAssumption`。
  - `@contextmenu.prevent="onCellContext"`：menu 模式 → `openMenu`；gesture 模式 → `toggleCrossOut`。
  - `@keydown.delete.prevent="onCellDelete"`：menu 模式 → 无（或忽略）；gesture 模式 → `toggleCrossOut`。
  - Shift+左键：在 `onCellClick` 里若 `e.shiftKey && gesture` → `toggleCrossOut`，否则按上面。
- 切到 menu 模式时若有菜单开着不受影响；切到 gesture 模式时关闭任何打开的菜单（`closeMenu()`），避免残留。

## 4. 行为对照

| 操作 | 菜单模式（默认） | 快捷模式（勾选「🖱 右键快捷」） |
|---|---|---|
| 左键点格 / 触摸 | 打开菜单（假设此位／划除／清除） | 假设此位（再点同格取消；点同列别格替换） |
| 右键 (contextmenu) | 打开菜单 | 划除（再次取消） |
| Shift + 左键 | 打开菜单 | 划除 |
| 键盘 Enter/Space（格子聚焦） | 打开菜单 | 假设（= 触发 click） |
| 键盘 Delete | （无）| 划除 |
| Esc / 点背板 | 关闭菜单 | （无菜单）|

> 两模式键盘均可用：菜单模式 Enter/Space 开菜单并在菜单内操作；快捷模式 Enter/Space 假设、Delete 划除。

## 5. 图例 / aria 自适应

- `legend-ops` 文案随模式：
  - menu：`点击格子打开菜单：假设此位／划除／清除 · 「重置假设」清空全部`
  - gesture：`左键＝假设此位 · 右键／Shift+左键／Delete＝划除 · 再点取消 · 「重置假设」清空全部`
- 格子 `aria` 在 menu 模式保留 `aria-haspopup="menu"` + `:aria-expanded`；gesture 模式去掉 `aria-haspopup`（无弹出），`aria-label` 末尾追加模式相关动作提示（如「（左键假设／右键划除）」）。`aria-pressed`（assumed）两模式都保留。

## 6. 开关 UI（每面板底部）

把底部从单独的 `<button class="solver-reset">` 改为一个 footer 行：
```
[ ☐ 🖱 右键快捷 ]            [ 重置假设 ]
```
- 勾选框 `<label class="solver-imode"><input type="checkbox" v-model="gestureChecked"> 🖱 右键快捷</label>`（🖱 包 `aria-hidden`）。
- 复用 `.solver-mode input` 的复选框尺寸重置思路（避免被全局 input 样式拉大），新增 `.solver-imode` 样式 + footer 两端对齐。

## 7. 测试

- **composable（vitest，jsdom localStorage）**：默认 `'menu'`；`setItem` 后再 `useInteractionMode` 读到持久值；切换后写入 localStorage；两次调用返回同一 ref（共享）；localStorage 抛错时不崩。
- **SolverPanel（@vue/test-utils）**：
  - 默认菜单模式：点格弹菜单（现有用例保持）。
  - 勾选「右键快捷」→ 菜单模式关闭：点格 = assumed（不再弹菜单）、右键 = crossed、Shift+左键 = crossed、Delete = crossed、点同格取消、同列替换。
  - 取消勾选 → 回菜单模式：点格又弹菜单。
  - 两个面板共享：mount 两个 SolverPanel，在一个里勾选，另一个的勾选框也变 checked（全局同步）。
  - legend-ops 文案随模式变化（含「右键」when gesture / 「菜单」when menu）。
  - 切到 gesture 时若菜单开着 → 关闭。
- 全量回归：现有 SolverPanel 菜单用例（默认 menu 模式）保持绿；249 测试不回归；`vue-tsc` + build 干净。

## 8. 影响面 / 风险

- 触点：新增 `src/composables/useInteractionMode.ts`（+test）；`SolverPanel.vue`（恢复旧手势函数 + 事件分流 + 勾选框 + legend-ops/aria 自适应）+ 其 test；`src/style.css`（`.solver-imode` + footer 布局）；文档 L3/L4 补「交互方式开关」。
- 风险：事件分流要确保 menu 模式行为**完全不变**（现有菜单用例全绿即证）；gesture 模式恢复的 toggle 语义要与历史一致（per-position assume 替换、Set toggle cross）。localStorage 持久化需 try/catch。
- 顺序：composable（纯逻辑，先）→ SolverPanel 分流 + 勾选框 + 同步 → 图例/aria/样式 → 文档 → 验证部署。

## 9. 验收

鼠标用户勾选「🖱 右键快捷」后：左键假设、右键/Shift/Delete 划除、再点取消，与旧版手感一致；刷新后仍是快捷模式；红蓝两侧同步。默认（未勾选）仍是点击菜单、触屏/键盘可用。现有 249 测试 + 新增用例全绿，构建干净，线上生效。

## 10. 附带修复（本次一并做，来自优化审查）

**B1 — 昵称接入对局页（Med-High bug）**：当前 `App.vue` 没把 `:names` 传给 `PlayView`，导致猜测页轮次标签、两列历史标题、读屏播报都用「红方/蓝方」而非昵称。
- `App.vue`：给 `<PlayView>` 加 `:names="names"`。
- `PlayView.vue`：新增 `names?: { p1: string|null; p2: string|null }` prop；输入标签用 `sideName(current, names)`；两列 `<HistoryList>` 的 `title` 用 `sideName('p1', names)` / `sideName('p2', names)`（替代硬编码「红方」「蓝方」）；`announceText` 里 `sideName(last.who, names)`。
- 测试：PlayView 传 names → 轮次标签 / 历史标题 / 播报均显示昵称；不传时回退红/蓝方。

**B2 — 弹出菜单视口夹取（Med bug）**：`openMenu` 当前 `left:r.left, top:r.bottom` 无夹取，最右列/最底行在窄屏溢出。
- `openMenu`：用单元格 `getBoundingClientRect()` 计算后，按估算菜单尺寸（宽 ~120、3 项高 ~132）做夹取：`left` 限制在 `[8, innerWidth-菜单宽-8]`；若 `下方空间不足` 则向上弹（`top = r.top - 菜单高`），否则 `r.bottom`；`top` 也夹到 `[8, innerHeight-菜单高-8]`。
- 验证：headless 在窄视口渲染最右列/最底行菜单，确认完整可见不溢出（jsdom 无布局，单测不校验坐标）。

> B1/B2 与本开关同处 SolverPanel/PlayView 区域，顺手修复；不扩展到位数选择、perf 合并、CI/lint 等其它审查项（另行安排）。
