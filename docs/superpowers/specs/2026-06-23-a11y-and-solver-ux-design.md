# 设计：可访问性 + 助手交互 修复包

> 日期：2026-06-23 ｜ 分支：`feat/a11y-and-solver-ux`
> 来源：两份独立审查子代理（① HTML 结构/语义/a11y；② 游戏改进）的去重合并。
> 范围（用户已确认）：修复全部「缺陷 + 可访问性 + 小幅高价值改进」；**大型新功能**（单机 vs 电脑 AI、PWA、i18n、分享导出、cows 规则、可配置位数）**本次不做**。

## 1. 目标与非目标

**目标**：在不改变核心玩法（仅 bulls 反馈、秘密数互不相同、位数固定 4、回合公平）的前提下，
修复读屏/键盘/触屏可访问性缺陷、补全表单与标题语义、消除助手「确定」误导、并加两处小幅高价值体验改进。

**非目标 / 显式排除**：cows 提示、可配置位数、单机 AI、PWA/离线、i18n、分享/导出、同数字再战、resign/和棋/回合上限。

## 2. 现状（已从代码核实）

- `solve()`（`src/game/solver.ts:51-110`）：枚举互不相同候选 → 事实过滤得 `factPossible` → 叠加假设/划除得 `whatif` → 预计算 `factDigitsAt[]` / `whatifDigitsAt[]` → 逐格六态。`'fixed'` 由 `colOnlyThis`（`derivedDigitsAt[pos]` 即 whatif，除非 whatif 空才回退 fact）唯一推出（`:89,98`）。**关键**：有假设时 `'fixed'` 可能仅在假设下成立，但图例文案声称「该位唯一可能就是它」（`SolverPanel.vue:91`），易被误读为已证明。
- SolverPanel 划除仅靠右键 / Shift+左键 / Delete（`SolverPanel.vue:113-115`）→ 触屏不可用。左键=假设（再点取消、点同列别格替换）。
- 全程无 `<form>`，靠 `@keyup.enter` 手搓提交（`SecretInput.vue:47`、`GuessInput.vue:45`）。
- 无任何 `aria-live`；猜测反馈新增 `<li>`（`HistoryList.vue:10-13`）与胜负 `<h2>`（`ResultView.vue:28`）对读屏静默；over 时不移焦点。
- 历史分支无 `<h1>`（起于 `<h2>对局历史`，`HistoryView.vue:36`）；游戏中 `<h1>`→`<h3>` 跳级。
- `<h1>Guessing Number</h1>` 英文混入 zh-CN 文档（`App.vue:80`）。
- 猜测历史是二列数据却用 `<ol>`（`HistoryList.vue:9-13`）。
- `eliminated` 文字 `#c2c5cc`/底 `#f3f4f6` 对比度仅 1.57:1（`style.css:504-509`）；无 `prefers-reduced-motion`；`fixed`/`available`/`assumed` 三态主要靠颜色区分。
- `playAgain()` 全清、连昵称一起清空（`App.vue:42-47`）。
- 装饰 emoji 无 `aria-hidden`（📜/🗑/←/▾▸/💾/✅/⚠️）。

## 3. 设计决策（用户已逐项确认）

1. **触屏划除 → 弹出菜单**：点击/触摸格子打开锚定小菜单「假设此位 / 划除 / 清除」，桌面与触屏统一，键盘可操作；**替代**隐藏的右键/Shift/Delete。
2. **「确定」误导 → 区分两态**：`事实确定`（无假设也成立，绿实心）vs `假设下确定`（仅当前假设下唯一，绿虚线 + 标记），图例分开说明。
3. **再战 → 仅「换数字再战」**：保留昵称，重置秘密数/历史/回合。

## 4. 详细设计（按主题）

### 主题 A — 助手交互与正确性（智能模式）

**A1 单元格弹出菜单（替代右键/Shift/Delete）**
- 交互模型统一为：**激活某格（点击/触摸/键盘 Enter|Space）→ 打开锚定该格的菜单**，项为：
  - `假设此位`：把该位假设设为该数字（沿用「同列替换」语义：清掉本列其它假设）。
  - `划除`：加入 `crossedOut`。
  - `清除`：移除本格的假设（若本格即本列假设）与/或从 `crossedOut` 移除；当本格既非 assumed 也非 crossed 时禁用此项。
- 关闭：选中项后、点击外部、或 `Esc`；关闭后焦点回到触发格。
- a11y：菜单容器 `role="menu"`，项 `role="menuitem"`，方向键移动、`Esc` 关闭。格子按钮保留 `aria-label`（含状态词），并以 `aria-haspopup="menu"` + `aria-expanded` 表达菜单开合。
- **统一入口（消歧）**：菜单是**唯一**交互入口。移除既有的左键直接假设、右键 `contextmenu`、`Shift+左键`、`Delete` 直接划除——这些都改由菜单项承载（更易发现、桌面触屏一致）。键盘：格子聚焦后 Enter/Space 开菜单。
- 仅一个菜单实例（同一面板内同时只开一个；切换格子时旧菜单关闭）。

**A2 两种「确定」**
- 在 `solve()` 增加 `factColOnlyThis = factDigitsAt[pos].size === 1 && factHasIt`。
- 当 `colOnlyThis` 命中时：`state = factColOnlyThis ? 'fixed' : 'fixedAssumed'`。
- 新增 `CellState` 成员 `'fixedAssumed'`（7 态）。语义：该格在「事实集」并非唯一，仅因当前假设而唯一。
- 无假设或 whatif 空时 `derived==fact`，恒为 `'fixed'`（不退化）。`basicSolve` 不变（永不产 fixed/fixedAssumed）。
- 样式：`fixed` 绿实心（现状）；`fixedAssumed` 绿底 + **虚线边框** + 角标/标记（如 `*` 或问号上标），与 `fixed` 区分且对色盲可辨（形状线索）。
- 图例：拆成两行——「事实确定：无需假设即可断定」与「假设下确定：依赖你当前的假设」。
- 文档：更新 L3 六态→七态推导表与 L4 `CellState` 联合 + `solve` 伪代码。

**A3 「剩 N 个可能」**
- 让 `solve()`（或新增轻量导出）回传 `whatif.length`（及 whatif 空时回退口径需明确：显示基于 `factPossible` 的口径并注明「假设无解」）。
- 面板在网格上方显示「剩 N 个可能」；当 `N ≤ 8` 列出候选字符串。**口径（消歧）**：N 与列表均取 `whatif`（叠加假设/划除后的集合）；当 `whatif` 为空（假设无解）时显示「剩 0 个可能（当前假设无解）」且不列表。
- 形式：纯展示，不影响推导；随假设/划除实时更新。

**A4 助手语义/地标**
- `solver-toggle` 按钮加 `:aria-expanded="expanded"` + `aria-controls="<body-id>"`，`.solver-body` 加该 id；▾/▸ 包 `aria-hidden`。
- 面板根 `<section class="solver">` → `<aside class="solver" :aria-label="`${sideName}推理助手`">`（具名 complementary 地标）。

### 主题 B — 表单与输入语义
- **B1**：`SecretInput`、`GuessInput`、`SetupView` 昵称输入各自包进 `<form @submit.prevent="confirm">`，主按钮 `type="submit"`；移除 `@keyup.enter`（表单原生处理 Enter，移动端出现「前往/Go」）。
- **B2**：可见标签改真 `<label :for="id">` + 输入 `:id`（用稳定 id；去掉与 `<p class="label">` 重复的 `:aria-label`）；数字/昵称输入 `autocomplete="off"`；`SetupView` 两步各用 `<fieldset><legend>红方设置/蓝方设置</legend>`。

### 主题 C — Live region 与焦点
- **C1**：`PlayView` 增加 `<p class="visually-hidden" role="status" aria-live="polite">`，内容为最近一次「{猜测} 正确数目 N」，仅供读屏。
- **C2**：`ResultView` 结果标题 `<h2 tabindex="-1" ref>` 在挂载时 `.focus()`；保存状态三态（saving/saved/error）统一包进单个 `role="status" aria-live="polite"` 容器（现仅 error 有 `role="alert"`）。
- **C3**：`HandoffScreen` 继续按钮 `onMounted` 聚焦；打开历史列表 / 打开详情 / 返回 时把焦点移到目标视图标题（`<h1>`/`<h2>`，`tabindex="-1"`）。

### 主题 D — 标题层级与地标
- **D1**：历史列表页加 `<h1>对局历史</h1>`、详情页加 `<h1>对局详情</h1>`（替原 `<h2>`，或在其上补 h1）；游戏中在双方猜测记录块上方补一个（可视觉隐藏的）`<h2 id>猜测记录</h2>` 并用 `aria-labelledby` 关联（消除 h1→h3 跳级）。
- **D2**：把「📜 历史」「← 返回/列表」「🗑 清空」等导航控件包进具名 `<nav aria-label>`；`App.vue:80` 的英文 `<h1>` 改为中文「猜数字」（与 zh-CN 一致）。

### 主题 E — 表格化
- **E1**：`HistoryList` 的猜测历史 `<ol>` → `<table class="history">`（`<caption>` 用方标题、`<thead><tr><th scope="col">猜测</th><th scope="col">正确数目</th></tr>`、`<tbody>` 逐行 `<td>`）。该组件用于对局中 / 结果 / 详情三处，一处改动多处受益；空态保留「暂无」提示。

### 主题 F — 视觉可访问性
- **F1**：`eliminated` 文字色加深至与 `#f3f4f6` 对比度 ≥ 4.5:1（保留删除线，仅改色值）。
- **F2**：新增 `@media (prefers-reduced-motion: reduce)`：将全页背景渐变（`style.css:65`）与各处 `transition` 降为 `none`/极短。
- **F3**：为 `fixed`/`fixedAssumed`/`available`/`assumed` 增加**非颜色线索**（如 `fixed` 加 `✓`、`assumed` 加圆点、`fixedAssumed` 虚线已具形状差异），使色盲可辨。
- **F4**：装饰性 emoji/字形包 `<span aria-hidden="true">`（文本已另载语义）。

### 主题 G — 再战
- **G1**：`ResultView` 的「再来一局」语义改为「换数字再战」：`App.vue` 新 reset 保留 `names`，重置 `secrets`/`history`/`round`/`outcome` 并回到 setup 重新设秘密数。文案与按钮 label 同步。

## 5. 测试策略

- **纯逻辑（Vitest）**：`solve()` 的 `fixedAssumed` 判定——构造「无假设→fixed」「加一个让某列唯一的假设→该列其它格 fixedAssumed、撤销假设→回 fixed」「whatif 空→不产 fixedAssumed」；`剩 N 个可能` 计数（含 whatif 空口径）。`basicSolve` 仍永不产 fixed/fixedAssumed（加固测试）。
- **组件（@vue/test-utils + jsdom）**：弹出菜单（激活格→菜单出现、选「假设/划除/清除」生效、Esc 关闭、同列替换、清除禁用态）；表单 `@submit.prevent` 提交；live region 文本随猜测/结果更新；标题层级存在；表格渲染（`<th scope>`）；再战保留昵称、清空秘密数。
- **角落/核心**（用户偏好）：单独子代理补 corner 测试——菜单键盘路径、focus 移动、fixedAssumed 边界、表格空态、reduced-motion 不破坏渲染。
- 全量回归：现 207 测试不得回归；`npm run build`（`vue-tsc --noEmit` + vite）零错误。

## 6. 影响面 / 风险

- 触点最广：`SolverPanel.vue`（菜单 + 计数 + 语义 + 图例）、`solver.ts`（+1 态 +计数）、`style.css`（多处）、`ResultView.vue`/`App.vue`（live/focus/再战）、`SecretInput`/`GuessInput`/`SetupView`（表单）、`HistoryList`/`HistoryView`/`HistoryDetail`/`PlayView`（标题/表格/焦点）、L3/L4 文档。
- 风险点：弹出菜单的定位/外部点击/焦点管理与 a11y 菜单语义最复杂，单列为较大任务；新增 `'fixedAssumed'` 态需同步所有 `CellState` 消费点与文档（参照上次「crossed」遗漏的教训，务必全量对齐图例+L3+L4）。
- 顺序：先纯逻辑（solver 七态 + 计数）→ 再 SolverPanel 交互/图例/样式 → 再表单/live/focus/标题/表格/视觉 a11y → 再战 → 文档 → 全量验证 + 部署。

## 7. 验收

- 键盘+读屏可完整完成一局并听到每次反馈与最终胜负；触屏可假设/划除/清除；助手不再把「假设下唯一」呈现为「已证明」；对比度/动效满足偏好；再战保留昵称。207+ 测试与构建全绿；线上部署生效。
