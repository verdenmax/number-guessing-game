# L3 · 保密与交接（Handoff）

> 上层：[L2 UI 层](../L2-components/ui.md) ｜ 相关组件：`HandoffScreen.vue` `SetupView.vue` `PlayView.vue`

热座模式两人共用一台电脑，**交接屏**既是仪式感也是**防窥**手段：在每次该换人操作前插入一块过渡屏，保证上一个人输入/查看的内容不会被下一个人看到。**交接屏完全是 UI 层本地状态，引擎状态机不感知。**

## setup 阶段：红方 → 交接 → 蓝方

`SetupView.vue` 用一个本地 `step` ref 编排三步：`'p1' → 'handoff' → 'p2'`（红方 → 交接 → 蓝方）。

```mermaid
sequenceDiagram
    participant U1 as 红方
    participant SV as SetupView(step)
    participant SI as SecretInput
    participant H as HandoffScreen
    participant U2 as 蓝方
    U1->>SI: 输入秘密数（可隐藏为 ●）
    SI->>SV: emit confirm(value)
    SV->>SV: emit setSecret('p1', value); step='handoff'
    SV->>H: 显示「请把电脑交给蓝方，准备好后点击开始」
    U2->>H: 点击「开始」
    H->>SV: emit continue → step='p2'
    SV->>SI: 新的 SecretInput（label=蓝方）
    U2->>SI: 输入秘密数
    SI->>SV: emit confirm(value)
    SV->>SV: emit setSecret('p2', value)
```

对应代码（`SetupView.vue`）：

```typescript
type Step = 'p1' | 'handoff' | 'p2'
const step = ref<Step>('p1')

function confirmP1(value: string) {
  emit('setSecret', 'p1', value)
  step.value = 'handoff'        // 红方确认后立刻切交接屏，清掉红方的输入画面
}
function confirmP2(value: string) {
  emit('setSecret', 'p2', value)   // 引擎在此转入 playing
}
```

`SecretInput` 确认后会把自己的 `value` 清空（`value.value = ''`），叠加交接屏，蓝方不会看到红方输入的痕迹。

## playing 阶段：无交接屏，双历史常驻（红蓝改版）

> **红蓝改版**：猜测阶段**已取消每次轮换的交接屏**。`PlayView.vue` 不再持有 `awaitingHandoff`，也不再渲染 `HandoffScreen`；改为**红蓝同屏、双历史常驻**——两份历史（`history.p1` / `history.p2`）始终并排展示。当前轮到谁，由整页红/蓝背景（`App.vue` 的 `stage` `side-*` class）与输入框标题（`sideName(current)`）区分。

```typescript
// PlayView.vue（现状，简化）
defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
// 模板：
//   <GuessInput :key="current" :label="`${sideName(current)}输入`" ... />
//   <HistoryList :records="history.p1" title="红方" side="red" />
//   <HistoryList :records="history.p2" title="蓝方" side="blue" />
```

设计权衡：双历史常驻牺牲了猜测阶段「只看自己历史」的防窥层（猜测历史本就只是「猜测 + 正确数目」，不泄露秘密本身），换取双方同屏对照、配合两侧推理助手做推理的体验。**秘密数仍然结束才公开。**

## 秘密数：playing 不显示，结束才公开

防窥的核心仍在：**playing 阶段两边的秘密数都不渲染**，只显示猜测历史（猜测串 + 「正确数目 N」）。游戏结束后，`ResultView.vue` 才**公开双方的秘密与完整历史**：

```vue
<p class="reveal">红方的数字：{{ secrets.p1 }}　蓝方的数字：{{ secrets.p2 }}</p>
<HistoryList :records="history.p1" title="红方" side="red" />
<HistoryList :records="history.p2" title="蓝方" side="blue" />
```

| 阶段 | 看得到什么 |
|------|-----------|
| setup | 各自输入自己的秘密数（可隐藏 ●），交接屏隔开红蓝 |
| playing | 红蓝**双方猜测历史常驻**（仅「猜测 + 正确数目」）；双方**秘密数不显示** |
| over | ResultView 公开**双方**秘密与完整历史 |

> 引擎层存的是明文 `secret`（单机热座不加密），保密完全靠 UI **永不渲染对方 secret**、结束才公开。联网版才需要服务端保管 secret（扩展点）。
