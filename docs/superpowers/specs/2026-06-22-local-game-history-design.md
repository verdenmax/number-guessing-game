# 本地对局历史（Local Game History）设计文档

- 日期：2026-06-22
- 状态：已与用户确认，待转入实施计划
- 关联：number-guessing-game（Vue 3 热座双人猜数字游戏，红蓝双方，纯前端 / GitHub Pages）

## 1. 概述与目标

为现有**热座双人猜数字游戏**增加一个**本地对局历史**功能：每打完一局（进入 `over` 阶段）**自动**把这一局存进浏览器，之后可在「历史」视图里浏览过往对局；点开任一局可查看**当时双方各自设置的数字**与**完整猜测记录**。

明确范围：**不做联机/后端**，保持纯前端，部署不变（仍由现有 GitHub Pages workflow 构建 `dist`）。历史数据存在**浏览器本地的 IndexedDB**，因此是"每台设备各看各的"，不跨设备同步——这是本次有意接受的取舍。

**核心价值**：把易逝的对局结果沉淀下来，方便回看"上次我俩各填了什么、怎么一步步猜中的"。

## 2. 已确认的需求决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 是否联机 | **否**。本次只做纯前端单页，历史本地存储 |
| 2 | 存储介质 | **IndexedDB**（浏览器原生、零依赖；WebSQL 已被浏览器删除，不用） |
| 3 | 玩家身份 | **可选昵称**：设置阶段可填名字，留空回退「红/蓝」；历史显示「Alice vs Bob」 |
| 4 | 保存时机 | **对局结束自动保存**（无需手点），saved 标志防重复，`reset` 后复位 |
| 5 | 历史内容 | 列表（时间·对局名·结果·位数·回合）；详情（双方数字 + 双方完整猜测记录） |
| 6 | 管理操作 | 单局删除 + 清空全部（均带确认） |
| 7 | 降级策略 | 历史是增强功能：IndexedDB 不可用/失败时游戏照常，仅内联提示 |

## 3. 架构总览

历史模块与对局引擎（`engine.ts` / `useGame`）**完全解耦**——引擎保持纯函数、不知道持久化的存在；保存动作由 App 层在「进入 over」时触发。

```
┌──────────────────────────────────────────────────────────────┐
│  组件层 (Vue)                                                   │
│   App.vue ── view: 'game' | 'history' 切换                     │
│     ├─ SetupView(填昵称+秘密) ─ PlayView ─ ResultView           │
│     └─ HistoryView ⇄ HistoryDetail                             │
├──────────────────────────────────────────────────────────────┤
│  composable: useHistory.ts   ── 响应式 records + load/remove/clear │
├──────────────────────────────────────────────────────────────┤
│  存储层: src/history/store.ts (纯 TS, 无 Vue)                   │
│     saveGame / listGames / getGame / deleteGame / clearAll      │
│     封装全部 IndexedDB 细节（open/升级/事务/索引）              │
├──────────────────────────────────────────────────────────────┤
│  浏览器 IndexedDB   库 ngg / 仓库 games (keyPath id, 索引 playedAt)│
└──────────────────────────────────────────────────────────────┘
        ▲ 不依赖                              引擎 engine.ts / useGame
        └──────────────────────────────────────────────────────────┘
```

- **存储层 `store.ts`**：唯一接触 IndexedDB 的地方，对外只暴露 5 个 Promise 方法，可用 `fake-indexeddb` 在 jsdom 下完整单测。
- **`useHistory.ts`**：把 store 包成 Vue 响应式，组件不直接碰 store/IndexedDB。
- **录入**：App 用 `watch(phase)`，在首次进入 `over` 时组装 `GameRecord` 调 `saveGame`，与引擎逻辑隔离。

## 4. 数据模型（`src/history/types.ts`）

```typescript
import type { GuessRecord, Outcome } from '../game/types'

export interface GameRecord {
  id: string            // crypto.randomUUID()，不可用时回退 时间戳+随机
  playedAt: number      // Date.now()，毫秒时间戳（也作排序索引）
  digits: number        // 本局位数
  names:   { p1: string | null; p2: string | null }  // null = 用 红/蓝
  secrets: { p1: string; p2: string }   // 对局已结束，双方数字均揭晓
  history: { p1: GuessRecord[]; p2: GuessRecord[] }   // 双方完整猜测记录
  outcome: Outcome      // 保存局必为 win{winner} | draw（不会是 ongoing）
  rounds:  number        // 总回合数（= 结束时的 round）
}
```

- 直接复用引擎的 `GuessRecord`（`{ guess, feedback }`）与 `Outcome`，历史与引擎数据结构同源。
- `secrets` 在保存时双方都已知（游戏结束才存），故为 `string` 而非 `string | null`。

## 5. 存储层（`src/history/store.ts`）

纯 TS、零 Vue/DOM，封装全部 IndexedDB 细节。

### 5.1 Schema 与连接

```
库名(DB)    : "ngg"            版本 1
对象仓库     : "games"          keyPath: "id"
索引        : "playedAt"       → 倒序列出用
onupgradeneeded(v0→v1):
    if !db.objectStoreNames.contains("games"):
        store = db.createObjectStore("games", { keyPath: "id" })
        store.createIndex("playedAt", "playedAt")
```

`openDB()` 内部惰性打开并缓存同一个连接 Promise；`onupgradeneeded` 建仓库+索引；`onerror`/`onblocked` → reject。

### 5.2 函数 API（全部返回 Promise）

```typescript
saveGame(record: GameRecord): Promise<void>      // readwrite put（同 id 覆盖）
listGames(): Promise<GameRecord[]>               // 按 playedAt 倒序（最新在前）
getGame(id: string): Promise<GameRecord | undefined>
deleteGame(id: string): Promise<void>            // 删不存在 = no-op，不报错
clearAll(): Promise<void>                         // store.clear()
```

### 5.3 `listGames` 倒序实现（伪代码）

```
tx    = db.transaction("games", "readonly")
index = tx.objectStore("games").index("playedAt")
cursor = index.openCursor(null, "prev")   # prev = 从大到小遍历 playedAt
out = []
on each cursor:  out.push(cursor.value); cursor.continue()
on complete:     resolve(out)             # 已是最新在前
```

### 5.4 错误处理

- 每个方法把 IndexedDB 请求包成 Promise，`onerror`/事务 `onabort` → reject（带可读信息）。
- 调用方（useHistory / App）负责 catch 并降级，**store 本身不吞错**，便于测试与上层决定 UI。

## 6. Composable（`src/composables/useHistory.ts`）

把 store 包成 Vue 响应式，组件只依赖它。

```typescript
export function useHistory() {
  const records = ref<GameRecord[]>([])
  const error   = ref<string | null>(null)

  const load = async () => {
    try { records.value = await listGames(); error.value = null }
    catch { error.value = '历史读取失败'; records.value = [] }
  }
  const remove = async (id: string) => { await deleteGame(id); await load() }
  const clear  = async () => { await clearAll(); await load() }

  return { records, error, load, remove, clear }
}
```

- 保存（`saveGame`）由 App 录入时直接调 store，不经 useHistory（录入与浏览是两条独立路径）。
- `remove`/`clear` 后重新 `load`，保证 `records` 与库一致。

## 7. 录入逻辑（自动保存）

### 7.1 昵称提升到 App

当前 `SetupView` 只 `emit('setSecret', player, value)`。改为额外 `emit('setName', player, name)`：每位玩家设置步骤上方加可选名字输入，确认时把 `name`（trim，空→null）连同秘密一起上报。App 持有 `names` ref：

```typescript
const names = ref<{ p1: string | null; p2: string | null }>({ p1: null, p2: null })
const applyName = (p: PlayerId, n: string) => { names.value[p] = n.trim() || null }
```

### 7.2 进入 over 时保存一次

```typescript
const saved = ref(false)
const saveError = ref<string | null>(null)

watch(phase, async (p) => {
  if (p === 'over' && !saved.value) {
    saved.value = true
    const s = state.value
    const record: GameRecord = {
      id: newId(),                       // crypto.randomUUID() 带回退
      playedAt: Date.now(),
      digits: s.config.digits,
      names: { ...names.value },
      secrets: { p1: s.secrets.p1!, p2: s.secrets.p2! },   // over 时双方非空
      history: { p1: [...s.history.p1], p2: [...s.history.p2] },
      outcome: s.outcome,
      rounds: s.round,
    }
    try { await saveGame(record) }
    catch { saveError.value = '历史保存失败（可能是浏览器隐私模式）' }
  }
})
```

### 7.3 防重复 / 重开

- `saved` 标志确保一局只存一条（watch 多次触发、组件重渲染都不会重复存）。
- 「再来一局」`reset()` 时一并 `saved.value = false`、`saveError.value = null`、`names` 重置为 `{ p1: null, p2: null }`（让留空重新回退红/蓝），下一局结束再存新的一条（id 不同）。
- `newId()`：`typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : ${Date.now()}-${Math.random().toString(36).slice(2)}`。

### 7.4 为什么放在 App 而非 useGame

`useGame`/`engine` 保持**纯逻辑、无副作用**（利于既有 135 测试与纯函数契约）。持久化是外部副作用，集中在 App 的 `watch`，引擎不感知历史的存在。

## 8. UI 与导航

### 8.1 视图切换（不引入 vue-router，YAGNI）

App 增 `const view = ref<'game' | 'history'>('game')`。游戏三阶段（setup/playing/over）都在 `view==='game'` 内；`view==='history'` 时整页渲染历史（无红蓝助手栏）。

```
┌──────────────────────────────────────────────┐
│  Guessing Number                  [📜 历史]    │  ← 设置页/结果页右上
├──────────────────────────────────────────────┤
│  view==='game'    : 设置 → 对战 → 结果           │
│  view==='history' : HistoryView ⇄ HistoryDetail │
└──────────────────────────────────────────────┘
```

- 「📜 历史」入口只在 **setup / over** 显示，**playing 中隐藏**（专注对战）。
- 历史视图内「← 返回」回到 `view='game'`（回到当前对局阶段，不打断进行中的局）。

### 8.2 SetupView：可选昵称

每位玩家秘密设置步骤上方加：

```
┌─────────────────────────────────────┐
│  你的名字（可选，留空用红/蓝）          │
│  [______________]   ≤12 字            │
│  红方：秘密设置你的数字（蓝方勿看）      │
│  [ secret input ... ]      [确认]      │
└─────────────────────────────────────┘
```

确认时 `emit('setName', player, name)` + `emit('setSecret', player, value)`。防窥交接 `HandoffScreen` 流程不变。`SecretInput` 不动（仍专注秘密校验）。

### 8.3 HistoryView（列表）

```
┌ 对局历史 ───────────────────── [🗑 清空历史] [← 返回] ┐
│ 06-22 20:30  Alice vs Bob   🔴 Alice 胜  4位 7回合  [删除] │
│ 06-22 20:05  红 vs 蓝         平局         4位 9回合  [删除] │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
空态：  还没有历史记录，玩一局试试吧
读失败：历史读取失败  [重试]
```

- 挂载时 `useHistory().load()`；`records` 已倒序（最新在上）。
- 每行整体可点 → 进入 `HistoryDetail`（本地 `selected` ref 或传 record）。
- 「删除」`remove(id)`（带 `confirm`）；「清空历史」`clear()`（带 `confirm`）。
- 时间用 `toLocaleString` 简短格式；对局名/结果用 `sideName(player, names)`。

### 8.4 HistoryDetail（单局详情）

```
┌ ← 列表    06-22 20:30    🔴 Alice 胜 · 4位 · 7回合 ┐
│ 揭晓： Alice 的数字 = 0891    Bob 的数字 = 1234       │
│ ┌── Alice 的猜测 ──┐   ┌── Bob 的猜测 ──┐            │
│ │ (复用 HistoryList) │   │ (复用 HistoryList) │        │
│ └───────────────────┘   └───────────────────┘        │
│                                   [删除此局]          │
└──────────────────────────────────────────────────────┘
```

- 双方猜测**并排复用 `HistoryList`**（与结果页同一组件，传 `records` / `title=名字` / `side`），零新渲染逻辑。
- 「删除此局」后回列表。

### 8.5 ResultView：保存提示 + 入口

- 顶部加「✅ 本局已保存到历史」；保存失败则显示 `saveError`（红字内联，不阻断）。
- 加「📜 查看历史」按钮（→ `view='history'`），与「再来一局」并列。
- 揭晓行与红蓝历史标题改用 `sideName(player, names)`（有昵称显示昵称）。

### 8.6 playerLabels 扩展（向后兼容）

```typescript
export const sideName = (
  player: PlayerId,
  names?: { p1: string | null; p2: string | null },
): string =>
  names?.[player]?.trim() || (player === 'p1' ? '红方' : '蓝方')
```

`names` 可选——旧调用 `sideName('p1')` 行为不变。

## 9. 错误处理与降级

历史是**增强功能，绝不拖垮游戏**：

| 场景 | 处理 |
|------|------|
| IndexedDB 不可用（隐私模式/禁用） | `openDB` reject → 保存/读取 catch；游戏照常，结果页内联「历史保存失败」 |
| 保存失败（配额/事务中断） | 捕获后只提示，不抛到 UI 之外，不影响「再来一局」 |
| 列表读取失败 | HistoryView 显示「历史读取失败 + 重试」 |
| `crypto.randomUUID` 缺失 | `newId()` 回退 `时间戳+随机` |
| 删除不存在的 id | store 视作 no-op，不报错 |

## 10. 测试策略（Vitest + jsdom）

重心：存储层穷尽测试 + 录入集成 + 关键组件。**新增 devDependency `fake-indexeddb`**（jsdom 无 IndexedDB；在测试 setup 注入 `indexedDB`/`IDBKeyRange`）。可用 subagent 专门补测试（子代理沿用当前主会话模型）。

**`src/history/store.test.ts`**（fake-indexeddb，每例前重置库）：
- save 后 `listGames` 含该条；多条按 `playedAt` **倒序**返回。
- `getGame(id)` 命中 / 不存在返回 `undefined`。
- `deleteGame` 删除指定；删**不存在**的 id = no-op（不抛）。
- `clearAll` 清空；对**空库** clear 不报错。
- 同 id 再 `saveGame` **覆盖**（put 语义）。
- 首次打开触发 `onupgradeneeded` **建仓库+索引**（可由能正常读写间接验证）。
- corner：大 `history` 数组（几十条猜测）存取无损；`names`/`secrets` 原样回读。

**`src/composables/useHistory.test.ts`**：
- `load` 填充 `records`（倒序）；`remove` 后 `records` 同步减少；`clear` 后为空。
- store 抛错时 `error` 置位、`records` 退化为 `[]`（不崩）。

**录入集成（`src/App.test.ts` 扩展或新 `recording.test.ts`）**：
- 走完整一局到 `over` → **恰好保存一条**，字段正确（secrets/names/outcome/rounds/digits）。
- `reset` 后再走一局 → **再存一条且 id 不同**（saved 标志按局复位，不重复存）。
- 昵称：填名→记录 `names` 为名；留空→`null`。
- 保存失败（mock `saveGame` reject）→ 不崩、显示 `saveError`。

**组件（`HistoryView.test.ts` / `HistoryDetail.test.ts` / 扩展 `SetupView.test.ts`）**：
- HistoryView：渲染行、空态、删除调用、清空调用、点击行进详情。
- HistoryDetail：渲染双方数字 + 两列 `HistoryList`；昵称缺省回退红/蓝。
- SetupView：名字输入 `emit('setName')`（空字符串→null）；不破坏既有 setSecret 流程。

**回归**：保持现有 **135 测试全绿**；`npm run build`（`vue-tsc --noEmit`）必须过——注意未使用变量/props（TS6133，vitest 不查、只有 build 查）。

## 11. 文档（随代码同步，L1–L4 + README）

| 文件 | 动作 |
|------|------|
| `docs/L1-overview.md` | 增「本地对局历史」模块概述 |
| `docs/L2-components/` 新增 `history.md` | 历史模块职责与接口（store/useHistory/视图） |
| `docs/L3-details/` 新增 `history-storage.md` | IndexedDB schema、倒序游标、错误降级、保存时机 |
| `docs/L4-api/` 新增 `history.md` | `store` 五方法 + `useHistory` + `GameRecord` 签名 |
| `docs/L4-api/components.md` | 增 HistoryView / HistoryDetail props、SetupView setName |
| `README.md` | 功能介绍增「本地历史」；文档覆盖表更新 |

## 12. 非目标（YAGNI）

- 不做联机/后端/跨设备同步（历史仅本机 IndexedDB）。
- 不做导入/导出、搜索/筛选、分页（先全量倒序展示）。
- 不做对局**回放动画**——详情为静态展示。
- 不持久化进行中的对局（只存已结束的局）。
- 不引入 vue-router（`view` ref 足够）。
- 不做账号/鉴权（仅可选昵称，纯展示用）。

## 13. 文件清单

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/history/types.ts` | 新增 | `GameRecord` 数据结构 |
| `src/history/store.ts` | 新增 | IndexedDB 封装：save/list/get/delete/clear |
| `src/history/store.test.ts` | 新增 | 存储层穷尽单测（fake-indexeddb） |
| `src/composables/useHistory.ts` | 新增 | 响应式 records + load/remove/clear |
| `src/composables/useHistory.test.ts` | 新增 | composable 测试 |
| `src/components/HistoryView.vue` | 新增 | 历史列表 + 删除/清空/空态 |
| `src/components/HistoryDetail.vue` | 新增 | 单局详情（数字 + 复用 HistoryList×2） |
| `src/components/HistoryView.test.ts` | 新增 | 列表组件测试 |
| `src/components/HistoryDetail.test.ts` | 新增 | 详情组件测试 |
| `src/App.vue` | 改 | `view` 切换、`names`、`watch(phase)` 录入、历史入口 |
| `src/components/SetupView.vue` | 改 | 可选昵称输入 + `setName` emit |
| `src/components/ResultView.vue` | 改 | 保存提示 + 查看历史按钮 + 昵称显示 |
| `src/playerLabels.ts` | 改 | `sideName(player, names?)` 兼容扩展 |
| `src/style.css` | 改 | 历史列表/详情/昵称输入样式 |
| `package.json` | 改 | 新增 devDependency `fake-indexeddb` |
| `docs/**` + `README.md` | 改/增 | L1–L4 + README 同步 |
