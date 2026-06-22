# 本地对局历史（Local Game History）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给现有热座双人猜数字游戏增加**纯前端的本地对局历史**：每局结束自动存入浏览器 IndexedDB，支持可选昵称，并提供「列表 + 详情」查看当时双方各自的数字与完整猜测记录。

**Architecture:** 三层解耦——纯 TS 的 `src/history/store.ts` 封装全部 IndexedDB 细节（5 个 Promise 方法）；`useHistory` composable 把 store 包成 Vue 响应式；`App.vue` 在 `phase` 进入 `over` 时组装 `GameRecord` 自动保存。对局引擎 `engine.ts` / `useGame` 保持纯函数、**不改动**，历史是叠加的副作用层。

**Tech Stack:** Vue 3（`<script setup>` + TS）、Vite、Vitest + `@vue/test-utils`（jsdom）、`fake-indexeddb`（测试注入）、浏览器 IndexedDB。

关联设计文档：`docs/superpowers/specs/2026-06-22-local-game-history-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/history/types.ts` | 新增 | `GameRecord` 数据结构（复用引擎 `GuessRecord`/`Outcome`） |
| `src/history/store.ts` | 新增 | IndexedDB 封装：`openDB` + `saveGame`/`listGames`/`getGame`/`deleteGame`/`clearAll` |
| `src/history/store.test.ts` | 新增 | 存储层单测（`fake-indexeddb`） |
| `src/history/record.ts` | 新增 | 纯函数 `buildGameRecord(state, names, opts?)` 组装记录（便于测字段正确性） |
| `src/history/record.test.ts` | 新增 | `buildGameRecord` 纯函数测试 |
| `src/composables/useHistory.ts` | 新增 | 响应式 `records`/`error` + `load`/`remove`/`clear` |
| `src/composables/useHistory.test.ts` | 新增 | composable 测试（mock store） |
| `src/components/HistoryView.vue` | 新增 | 历史列表（行/空态/删除/清空/点击进详情） |
| `src/components/HistoryView.test.ts` | 新增 | 列表组件测试 |
| `src/components/HistoryDetail.vue` | 新增 | 单局详情（双方数字 + 复用 `HistoryList`×2） |
| `src/components/HistoryDetail.test.ts` | 新增 | 详情组件测试 |
| `src/playerLabels.ts` | 改 | `sideName(player, names?)` 兼容扩展 |
| `src/playerLabels.test.ts` | 新增 | `sideName` 测试（新建，原无测试） |
| `src/components/SetupView.vue` | 改 | 可选昵称输入 + `setName` emit |
| `src/components/SetupView.test.ts` | 改 | 增昵称 emit 用例 |
| `src/components/ResultView.vue` | 改 | 保存提示 + 「查看历史」按钮 + 昵称显示 |
| `src/components/ResultView.test.ts` | 改 | 增昵称/按钮用例 |
| `src/App.vue` | 改 | `view` 切换 + `names` + `watch(phase)` 录入 + 历史入口 |
| `src/App.test.ts` | 改 | 增录入/视图切换集成用例 |
| `src/style.css` | 改 | 历史列表/详情/昵称输入样式 |
| `package.json` | 改 | 新增 devDependency `fake-indexeddb` |
| `docs/L1-overview.md`、`docs/L2-components/history.md`、`docs/L3-details/history-storage.md`、`docs/L4-api/history.md`、`docs/L4-api/components.md`、`README.md` | 改/增 | L1–L4 + README 同步 |

**依赖顺序**：T1（依赖+类型）→ T2/T3（store）→ T4（record 纯函数）→ T5（useHistory）→ T6（sideName）→ T7（SetupView 昵称）→ T8（App 录入）→ T9（HistoryView）→ T10（HistoryDetail）→ T11（App 视图切换 + ResultView）→ T12（样式）→ T13（文档）。

---

## Task 1: 安装 fake-indexeddb + `GameRecord` 类型

**Files:**
- Modify: `package.json`（devDependencies）
- Create: `src/history/types.ts`

- [ ] **Step 1: 安装 fake-indexeddb（项目本地 devDependency）**

Run:
```bash
npm install -D fake-indexeddb
```
Expected: `package.json` 的 `devDependencies` 出现 `"fake-indexeddb"`，`node_modules/fake-indexeddb` 存在，`npm` 退出码 0。

- [ ] **Step 2: 创建 `src/history/types.ts`**

```typescript
import type { GuessRecord, Outcome } from '../game/types'

export interface GameRecord {
  id: string
  playedAt: number
  digits: number
  names: { p1: string | null; p2: string | null }
  secrets: { p1: string; p2: string }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  outcome: Outcome
  rounds: number
}
```

- [ ] **Step 3: 类型检查通过**

Run: `npx vue-tsc --noEmit`
Expected: 无错误（退出码 0）。新类型文件可编译。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/history/types.ts
git commit -m "feat(history): 新增 GameRecord 类型 + fake-indexeddb 测试依赖"
```

## Task 2: store —— `openDB` + `saveGame` + `listGames` + `clearAll`

**Files:**
- Create: `src/history/store.ts`
- Test: `src/history/store.test.ts`

- [ ] **Step 1: 写失败测试 `src/history/store.test.ts`**

```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, listGames, clearAll } from './store'
import type { GameRecord } from './types'

function rec(id: string, playedAt: number): GameRecord {
  return {
    id,
    playedAt,
    digits: 4,
    names: { p1: null, p2: null },
    secrets: { p1: '0123', p2: '4567' },
    history: {
      p1: [{ guess: '4567', feedback: 4 }],
      p2: [{ guess: '0000', feedback: 0 }],
    },
    outcome: { kind: 'win', winner: 'p1' },
    rounds: 1,
  }
}

describe('history store: save/list/clear', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('保存后能在列表中找到该记录', async () => {
    await saveGame(rec('a', 1000))
    const all = await listGames()
    expect(all.map((r) => r.id)).toEqual(['a'])
  })

  it('多条按 playedAt 倒序返回（最新在前）', async () => {
    await saveGame(rec('old', 1000))
    await saveGame(rec('new', 3000))
    await saveGame(rec('mid', 2000))
    const all = await listGames()
    expect(all.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('嵌套字段（history/secrets/names/outcome）原样回读', async () => {
    await saveGame(rec('x', 5000))
    const [r] = await listGames()
    expect(r).toEqual(rec('x', 5000))
  })

  it('同 id 再次保存为覆盖（put 语义）', async () => {
    await saveGame(rec('dup', 1000))
    await saveGame({ ...rec('dup', 9000), rounds: 7 })
    const all = await listGames()
    expect(all).toHaveLength(1)
    expect(all[0].rounds).toBe(7)
  })

  it('clearAll 清空；对空库再 clear 不报错', async () => {
    await saveGame(rec('a', 1000))
    await clearAll()
    expect(await listGames()).toEqual([])
    await clearAll() // 空库再清不抛
    expect(await listGames()).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/history/store.test.ts`
Expected: FAIL —— 解析不到 `./store`（模块不存在）。

- [ ] **Step 3: 创建 `src/history/store.ts`（最小实现：open/save/list/clear）**

```typescript
import type { GameRecord } from './types'

const DB_NAME = 'ngg'
const DB_VERSION = 1
const STORE = 'games'
const INDEX = 'playedAt'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex(INDEX, 'playedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  dbPromise = p
  // 打开失败不缓存被拒绝的连接，允许后续重试（也避免 jsdom 无 indexedDB 时污染后续）
  p.catch(() => {
    if (dbPromise === p) dbPromise = null
  })
  return dbPromise
}

export async function saveGame(record: GameRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('saveGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('saveGame aborted'))
  })
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index(INDEX)
    const out: GameRecord[] = []
    const cursorReq = index.openCursor(null, 'prev')
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        out.push(cursor.value as GameRecord)
        cursor.continue()
      } else {
        resolve(out)
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error('listGames failed'))
  })
}

export async function clearAll(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('clearAll failed'))
  })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/history/store.test.ts`
Expected: PASS（5 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add src/history/store.ts src/history/store.test.ts
git commit -m "feat(history): store 实现 open/save/list/clear + 单测"
```

## Task 3: store —— `getGame` + `deleteGame`

**Files:**
- Modify: `src/history/store.ts`
- Test: `src/history/store.test.ts`（追加 describe）

- [ ] **Step 1: 追加失败测试到 `src/history/store.test.ts`**

在文件末尾（最后一个 `})` 之后）追加：

```typescript
describe('history store: get/delete', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('getGame 命中返回该记录', async () => {
    await saveGame(rec('a', 1000))
    expect(await getGame('a')).toEqual(rec('a', 1000))
  })

  it('getGame 不存在返回 undefined', async () => {
    expect(await getGame('nope')).toBeUndefined()
  })

  it('deleteGame 删除指定记录', async () => {
    await saveGame(rec('a', 1000))
    await saveGame(rec('b', 2000))
    await deleteGame('a')
    const all = await listGames()
    expect(all.map((r) => r.id)).toEqual(['b'])
  })

  it('deleteGame 删除不存在的 id 不抛错（no-op）', async () => {
    await saveGame(rec('a', 1000))
    await deleteGame('ghost')
    expect((await listGames()).map((r) => r.id)).toEqual(['a'])
  })
})
```

同时把顶部 import 改为包含新方法：

```typescript
import { saveGame, listGames, getGame, deleteGame, clearAll } from './store'
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/history/store.test.ts`
Expected: FAIL —— `getGame` / `deleteGame` 不是导出函数（`is not a function`）。

- [ ] **Step 3: 在 `src/history/store.ts` 末尾追加实现（含一致的事务中断处理）**

```typescript
export async function getGame(id: string): Promise<GameRecord | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as GameRecord | undefined)
    req.onerror = () => reject(req.error ?? new Error('getGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('getGame aborted'))
  })
}

export async function deleteGame(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('deleteGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('deleteGame aborted'))
  })
}
```

- [ ] **Step 3b: 硬化既有 `listGames` / `clearAll` 的事务中断处理（来自 Task 2 代码审查的 Important 建议）**

在 `listGames` 的 `new Promise(...)` 内、`cursorReq.onerror` 之后补：
```typescript
    tx.onabort = () => reject(tx.error ?? new Error('listGames aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('listGames failed'))
```
在 `clearAll` 的 `new Promise(...)` 内、`tx.onerror` 之后补：
```typescript
    tx.onabort = () => reject(tx.error ?? new Error('clearAll aborted'))
```
（目的：所有事务在 abort 路径下都会 reject，避免 Promise 永不 settle；与 `saveGame` 的处理保持一致。`fake-indexeddb` 难以触发 abort，故不新增专门测试，但既有 9 个用例须仍全绿。）

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/history/store.test.ts`
Expected: PASS（9 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add src/history/store.ts src/history/store.test.ts
git commit -m "feat(history): store 增加 getGame/deleteGame + 单测"
```

## Task 4: `record.ts` —— 纯函数组装 `GameRecord`

把"从 `GameState` 组装记录"抽成纯函数，便于穷尽测字段、与 IndexedDB 副作用解耦。

**Files:**
- Create: `src/history/record.ts`
- Test: `src/history/record.test.ts`

- [ ] **Step 1: 写失败测试 `src/history/record.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildGameRecord, newId } from './record'
import { createGame, setSecret, submitGuess } from '../game/engine'
import type { GameState } from '../game/types'

// 构造一局已结束的对局：p1 猜中 p2 秘密(4 bulls)，p2 没中(0 bulls) → p1 胜
function finishedGame(): GameState {
  let s = createGame({ digits: 4 })
  s = setSecret(s, 'p1', '0123')
  s = setSecret(s, 'p2', '4567') // 双方设好 → playing
  s = submitGuess(s, '4567') // p1 → 命中 p2 秘密，轮到 p2
  s = submitGuess(s, '9999') // p2 → 对 '0123' 得 0 bulls，p1 胜，over
  return s
}

describe('buildGameRecord', () => {
  it('从已结束对局组装记录，字段正确', () => {
    const s = finishedGame()
    const r = buildGameRecord(s, { p1: 'Alice', p2: null }, { id: 'fixed', now: 123 })
    expect(r).toEqual({
      id: 'fixed',
      playedAt: 123,
      digits: 4,
      names: { p1: 'Alice', p2: null },
      secrets: { p1: '0123', p2: '4567' },
      history: {
        p1: [{ guess: '4567', feedback: 4 }],
        p2: [{ guess: '9999', feedback: 0 }],
      },
      outcome: { kind: 'win', winner: 'p1' },
      rounds: 1,
    })
  })

  it('history 为深拷贝，不与原 state 共享引用', () => {
    const s = finishedGame()
    const r = buildGameRecord(s, { p1: null, p2: null })
    expect(r.history.p1).not.toBe(s.history.p1)
    expect(r.history.p1[0]).not.toBe(s.history.p1[0])
  })

  it('非 over 阶段调用抛错', () => {
    const s = createGame({ digits: 4 })
    expect(() => buildGameRecord(s, { p1: null, p2: null })).toThrow()
  })

  it('newId 生成非空且两次不相等', () => {
    expect(newId()).not.toBe('')
    expect(newId()).not.toBe(newId())
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/history/record.test.ts`
Expected: FAIL —— 解析不到 `./record`。

- [ ] **Step 3: 创建 `src/history/record.ts`**

```typescript
import type { GameState } from '../game/types'
import type { GameRecord } from './types'

export interface RecordNames {
  p1: string | null
  p2: string | null
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function buildGameRecord(
  state: GameState,
  names: RecordNames,
  opts: { id?: string; now?: number } = {},
): GameRecord {
  if (state.phase !== 'over') {
    throw new Error('buildGameRecord 只能在 over 阶段调用')
  }
  return {
    id: opts.id ?? newId(),
    playedAt: opts.now ?? Date.now(),
    digits: state.config.digits,
    names: { p1: names.p1, p2: names.p2 },
    secrets: { p1: state.secrets.p1 as string, p2: state.secrets.p2 as string },
    history: {
      p1: state.history.p1.map((r) => ({ ...r })),
      p2: state.history.p2.map((r) => ({ ...r })),
    },
    outcome: state.outcome,
    rounds: state.round,
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/history/record.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/history/record.ts src/history/record.test.ts
git commit -m "feat(history): buildGameRecord 纯函数 + newId + 单测"
```

## Task 5: `useHistory` composable

**Files:**
- Create: `src/composables/useHistory.ts`
- Test: `src/composables/useHistory.test.ts`

- [ ] **Step 1: 写失败测试 `src/composables/useHistory.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as store from '../history/store'
import { useHistory } from './useHistory'
import type { GameRecord } from '../history/types'

vi.mock('../history/store')
const mockStore = vi.mocked(store)

function rec(id: string): GameRecord {
  return {
    id,
    playedAt: 0,
    digits: 4,
    names: { p1: null, p2: null },
    secrets: { p1: '0123', p2: '4567' },
    history: { p1: [], p2: [] },
    outcome: { kind: 'draw' },
    rounds: 1,
  }
}

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('load 填充 records 并清空 error', async () => {
    mockStore.listGames.mockResolvedValue([rec('a'), rec('b')])
    const h = useHistory()
    await h.load()
    expect(h.records.value.map((r) => r.id)).toEqual(['a', 'b'])
    expect(h.error.value).toBeNull()
  })

  it('load 失败时 error 置位、records 退化为空', async () => {
    mockStore.listGames.mockRejectedValue(new Error('boom'))
    const h = useHistory()
    await h.load()
    expect(h.records.value).toEqual([])
    expect(h.error.value).toBe('历史读取失败')
  })

  it('remove 调用 deleteGame 后重新 load', async () => {
    mockStore.deleteGame.mockResolvedValue(undefined)
    mockStore.listGames.mockResolvedValue([rec('b')])
    const h = useHistory()
    await h.remove('a')
    expect(mockStore.deleteGame).toHaveBeenCalledWith('a')
    expect(h.records.value.map((r) => r.id)).toEqual(['b'])
  })

  it('clear 调用 clearAll 后清空', async () => {
    mockStore.clearAll.mockResolvedValue(undefined)
    mockStore.listGames.mockResolvedValue([])
    const h = useHistory()
    await h.clear()
    expect(mockStore.clearAll).toHaveBeenCalled()
    expect(h.records.value).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useHistory.test.ts`
Expected: FAIL —— 解析不到 `./useHistory`。

- [ ] **Step 3: 创建 `src/composables/useHistory.ts`**

```typescript
import { ref } from 'vue'
import type { GameRecord } from '../history/types'
import { listGames, deleteGame, clearAll } from '../history/store'

export function useHistory() {
  const records = ref<GameRecord[]>([])
  const error = ref<string | null>(null)

  const load = async () => {
    try {
      records.value = await listGames()
      error.value = null
    } catch {
      error.value = '历史读取失败'
      records.value = []
    }
  }

  const remove = async (id: string) => {
    await deleteGame(id)
    await load()
  }

  const clear = async () => {
    await clearAll()
    await load()
  }

  return { records, error, load, remove, clear }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useHistory.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHistory.ts src/composables/useHistory.test.ts
git commit -m "feat(history): useHistory composable + 测试"
```

## Task 6: `playerLabels.sideName` 兼容扩展

**Files:**
- Modify: `src/playerLabels.ts`
- Test: `src/playerLabels.test.ts`（新建）

- [ ] **Step 1: 写失败测试 `src/playerLabels.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { sideName } from './playerLabels'

describe('sideName', () => {
  it('无 names 参数：回退红/蓝（向后兼容）', () => {
    expect(sideName('p1')).toBe('红方')
    expect(sideName('p2')).toBe('蓝方')
  })

  it('有昵称：返回昵称', () => {
    expect(sideName('p1', { p1: 'Alice', p2: 'Bob' })).toBe('Alice')
    expect(sideName('p2', { p1: 'Alice', p2: 'Bob' })).toBe('Bob')
  })

  it('昵称为 null 或纯空白：回退红/蓝', () => {
    expect(sideName('p1', { p1: null, p2: 'Bob' })).toBe('红方')
    expect(sideName('p2', { p1: 'Alice', p2: '   ' })).toBe('蓝方')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/playerLabels.test.ts`
Expected: FAIL —— 带昵称/空白用例不通过（当前 `sideName` 只接受一个参数）。

- [ ] **Step 3: 修改 `src/playerLabels.ts`**

整文件替换为：

```typescript
import type { PlayerId } from './game/types'

export const sideName = (
  player: PlayerId,
  names?: { p1: string | null; p2: string | null },
): string => names?.[player]?.trim() || (player === 'p1' ? '红方' : '蓝方')
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/playerLabels.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/playerLabels.ts src/playerLabels.test.ts
git commit -m "feat(history): sideName 支持可选昵称，回退红/蓝"
```

## Task 7: SetupView 可选昵称 + `setName` emit

**Files:**
- Modify: `src/components/SetupView.vue`
- Test: `src/components/SetupView.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试到 `src/components/SetupView.test.ts`**

在 `describe('SetupView', () => {` 内、已有用例之后追加：

```typescript
  it('两步分别填昵称后，依次 emit setName', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })

    await wrapper.find('.name-field input').setValue('Alice')
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()

    wrapper.findComponent(HandoffScreen).vm.$emit('continue')
    await wrapper.vm.$nextTick()

    await wrapper.find('.name-field input').setValue('Bob')
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '5678')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('setName')).toEqual([
      ['p1', 'Alice'],
      ['p2', 'Bob'],
    ])
  })

  it('昵称留空时 emit 空串（由上层归一为 null）', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('setName')![0]).toEqual(['p1', ''])
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/SetupView.test.ts`
Expected: FAIL —— `emitted('setName')` 为 `undefined`（尚未 emit），且找不到 `.name-field input`。

- [ ] **Step 3: 整文件替换 `src/components/SetupView.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { PlayerId, ValidationResult } from '../game/types'
import SecretInput from './SecretInput.vue'
import HandoffScreen from './HandoffScreen.vue'

defineProps<{
  digits: number
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{
  setSecret: [player: PlayerId, value: string]
  setName: [player: PlayerId, name: string]
}>()

type Step = 'p1' | 'handoff' | 'p2'
const step = ref<Step>('p1')
const p1Name = ref('')
const p2Name = ref('')

function confirmP1(value: string) {
  emit('setName', 'p1', p1Name.value)
  emit('setSecret', 'p1', value)
  step.value = 'handoff'
}
function confirmP2(value: string) {
  emit('setName', 'p2', p2Name.value)
  emit('setSecret', 'p2', value)
}
</script>

<template>
  <div v-if="step === 'p1'" class="setup-step">
    <label class="name-field">
      你的名字（可选，留空用红方）
      <input v-model="p1Name" type="text" maxlength="12" placeholder="红方" />
    </label>
    <SecretInput
      :digits="digits"
      :validate="validate"
      label="红方：秘密设置你的数字（蓝方请勿看屏幕）"
      @confirm="confirmP1"
    />
  </div>
  <HandoffScreen
    v-else-if="step === 'handoff'"
    message="请把电脑交给蓝方，准备好后点击开始"
    @continue="step = 'p2'"
  />
  <div v-else class="setup-step">
    <label class="name-field">
      你的名字（可选，留空用蓝方）
      <input v-model="p2Name" type="text" maxlength="12" placeholder="蓝方" />
    </label>
    <SecretInput
      :digits="digits"
      :validate="validate"
      label="蓝方：秘密设置你的数字（红方请勿看屏幕）"
      @confirm="confirmP2"
    />
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/SetupView.test.ts`
Expected: PASS（原有用例 + 2 个新用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/SetupView.vue src/components/SetupView.test.ts
git commit -m "feat(history): SetupView 增加可选昵称输入 + setName emit"
```

## Task 8: HistoryView 列表组件（纯展示）

设计为**纯展示组件**（props 进、事件出），不直接碰 store，便于测试；数据由 App 的 `useHistory` 提供。

**Files:**
- Create: `src/components/HistoryView.vue`
- Test: `src/components/HistoryView.test.ts`

- [ ] **Step 1: 写失败测试 `src/components/HistoryView.test.ts`**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryView from './HistoryView.vue'
import type { GameRecord } from '../history/types'

function rec(over: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'a',
    playedAt: 1700000000000,
    digits: 4,
    names: { p1: null, p2: null },
    secrets: { p1: '0123', p2: '4567' },
    history: { p1: [], p2: [] },
    outcome: { kind: 'win', winner: 'p1' },
    rounds: 3,
    ...over,
  }
}

describe('HistoryView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('渲染对局名/结果/元信息（带昵称）', () => {
    const w = mount(HistoryView, {
      props: { records: [rec({ names: { p1: 'Alice', p2: 'Bob' } })], error: null },
    })
    expect(w.text()).toContain('Alice vs Bob')
    expect(w.text()).toContain('Alice 胜')
    expect(w.text()).toContain('4位')
    expect(w.text()).toContain('3回合')
  })

  it('无昵称时对局名回退红/蓝', () => {
    const w = mount(HistoryView, { props: { records: [rec()], error: null } })
    expect(w.text()).toContain('红方 vs 蓝方')
  })

  it('空列表显示空态', () => {
    const w = mount(HistoryView, { props: { records: [], error: null } })
    expect(w.text()).toContain('还没有历史记录')
  })

  it('error 时显示错误信息', () => {
    const w = mount(HistoryView, { props: { records: [], error: '历史读取失败' } })
    expect(w.text()).toContain('历史读取失败')
  })

  it('点击行 emit open(record)', async () => {
    const r = rec({ id: 'x' })
    const w = mount(HistoryView, { props: { records: [r], error: null } })
    await w.find('.row-main').trigger('click')
    expect(w.emitted('open')![0]).toEqual([r])
  })

  it('删除按钮（确认后）emit remove(id)', async () => {
    vi.stubGlobal('confirm', () => true)
    const w = mount(HistoryView, { props: { records: [rec({ id: 'x' })], error: null } })
    await w.find('.row-del').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['x'])
  })

  it('清空按钮（确认后）emit clear', async () => {
    vi.stubGlobal('confirm', () => true)
    const w = mount(HistoryView, { props: { records: [rec()], error: null } })
    await w.find('.history-actions button').trigger('click') // 第一个按钮 = 清空
    expect(w.emitted('clear')).toHaveLength(1)
  })

  it('返回按钮 emit back', async () => {
    const w = mount(HistoryView, { props: { records: [], error: null } })
    const buttons = w.findAll('.history-actions button')
    await buttons[buttons.length - 1].trigger('click') // 最后一个 = 返回
    expect(w.emitted('back')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/HistoryView.test.ts`
Expected: FAIL —— 解析不到 `./HistoryView.vue`。

- [ ] **Step 3: 创建 `src/components/HistoryView.vue`**

```vue
<script setup lang="ts">
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'

defineProps<{
  records: GameRecord[]
  error: string | null
}>()
const emit = defineEmits<{
  open: [record: GameRecord]
  remove: [id: string]
  clear: []
  back: []
}>()

function matchTitle(r: GameRecord): string {
  return `${sideName('p1', r.names)} vs ${sideName('p2', r.names)}`
}
function outcomeText(r: GameRecord): string {
  if (r.outcome.kind === 'draw') return '平局'
  if (r.outcome.kind === 'win') return `${sideName(r.outcome.winner, r.names)} 胜`
  return ''
}
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString()
}
function confirmRemove(id: string) {
  if (confirm('删除这局历史？')) emit('remove', id)
}
function confirmClear() {
  if (confirm('清空所有历史？')) emit('clear')
}
</script>

<template>
  <div class="history-view">
    <header class="history-head">
      <h2>对局历史</h2>
      <div class="history-actions">
        <button type="button" :disabled="records.length === 0" @click="confirmClear">
          🗑 清空历史
        </button>
        <button type="button" @click="emit('back')">← 返回</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="records.length === 0" class="empty">还没有历史记录，玩一局试试吧</p>

    <ul v-else class="history-list">
      <li v-for="r in records" :key="r.id" class="history-row">
        <button type="button" class="row-main" @click="emit('open', r)">
          <span class="when">{{ fmtTime(r.playedAt) }}</span>
          <span class="match">{{ matchTitle(r) }}</span>
          <span class="result">{{ outcomeText(r) }}</span>
          <span class="meta">{{ r.digits }}位 · {{ r.rounds }}回合</span>
        </button>
        <button type="button" class="row-del" @click="confirmRemove(r.id)">删除</button>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/HistoryView.test.ts`
Expected: PASS（8 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/HistoryView.vue src/components/HistoryView.test.ts
git commit -m "feat(history): HistoryView 列表组件 + 测试"
```

## Task 9: HistoryDetail 详情组件（复用 HistoryList）

**Files:**
- Create: `src/components/HistoryDetail.vue`
- Test: `src/components/HistoryDetail.test.ts`

- [ ] **Step 1: 写失败测试 `src/components/HistoryDetail.test.ts`**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryDetail from './HistoryDetail.vue'
import HistoryList from './HistoryList.vue'
import type { GameRecord } from '../history/types'

function rec(over: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'a',
    playedAt: 1700000000000,
    digits: 4,
    names: { p1: 'Alice', p2: 'Bob' },
    secrets: { p1: '0123', p2: '4567' },
    history: {
      p1: [{ guess: '4567', feedback: 4 }],
      p2: [{ guess: '9999', feedback: 0 }],
    },
    outcome: { kind: 'win', winner: 'p1' },
    rounds: 1,
    ...over,
  }
}

describe('HistoryDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('展示双方数字与昵称', () => {
    const w = mount(HistoryDetail, { props: { record: rec() } })
    expect(w.text()).toContain('0123')
    expect(w.text()).toContain('4567')
    expect(w.text()).toContain('Alice')
    expect(w.text()).toContain('Bob')
  })

  it('渲染两个 HistoryList（双方猜测）', () => {
    const w = mount(HistoryDetail, { props: { record: rec() } })
    expect(w.findAllComponents(HistoryList)).toHaveLength(2)
  })

  it('无昵称时回退红/蓝', () => {
    const w = mount(HistoryDetail, { props: { record: rec({ names: { p1: null, p2: null } }) } })
    expect(w.text()).toContain('红方')
    expect(w.text()).toContain('蓝方')
  })

  it('返回按钮 emit back', async () => {
    const w = mount(HistoryDetail, { props: { record: rec() } })
    await w.find('.detail-head button').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('删除此局（确认后）emit delete(id)', async () => {
    vi.stubGlobal('confirm', () => true)
    const w = mount(HistoryDetail, { props: { record: rec({ id: 'z' }) } })
    await w.find('.detail-del').trigger('click')
    expect(w.emitted('delete')![0]).toEqual(['z'])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/HistoryDetail.test.ts`
Expected: FAIL —— 解析不到 `./HistoryDetail.vue`。

- [ ] **Step 3: 创建 `src/components/HistoryDetail.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'
import HistoryList from './HistoryList.vue'

const props = defineProps<{ record: GameRecord }>()
const emit = defineEmits<{ back: []; delete: [id: string] }>()

const p1Name = computed(() => sideName('p1', props.record.names))
const p2Name = computed(() => sideName('p2', props.record.names))

const outcomeText = computed(() => {
  const o = props.record.outcome
  if (o.kind === 'draw') return '平局'
  if (o.kind === 'win') return `${sideName(o.winner, props.record.names)} 胜`
  return ''
})
const fmtTime = computed(() => new Date(props.record.playedAt).toLocaleString())

function confirmDelete() {
  if (confirm('删除这局历史？')) emit('delete', props.record.id)
}
</script>

<template>
  <div class="history-detail">
    <header class="detail-head">
      <button type="button" @click="emit('back')">← 列表</button>
      <span class="when">{{ fmtTime }}</span>
      <span class="result">{{ outcomeText }} · {{ record.digits }}位 · {{ record.rounds }}回合</span>
    </header>

    <p class="reveal">
      {{ p1Name }} 的数字：{{ record.secrets.p1 }}　{{ p2Name }} 的数字：{{ record.secrets.p2 }}
    </p>

    <div class="histories">
      <HistoryList :records="record.history.p1" :title="p1Name" side="red" />
      <HistoryList :records="record.history.p2" :title="p2Name" side="blue" />
    </div>

    <button type="button" class="detail-del" @click="confirmDelete">删除此局</button>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/HistoryDetail.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/HistoryDetail.vue src/components/HistoryDetail.test.ts
git commit -m "feat(history): HistoryDetail 详情组件（复用 HistoryList）+ 测试"
```

## Task 10: ResultView 改造（昵称显示 + 保存提示 + 查看历史按钮）

**Files:**
- Modify: `src/components/ResultView.vue`
- Test: `src/components/ResultView.test.ts`（追加用例）

新增的 `names` / `saveError` 为**可选 prop**，既有测试不传也不破坏（回退红/蓝、显示已保存提示）。

- [ ] **Step 1: 追加失败测试到 `src/components/ResultView.test.ts`**

在 `describe('ResultView', () => {` 内已有用例之后追加：

```typescript
  it('使用昵称显示获胜方与揭晓', () => {
    const outcome: Outcome = { kind: 'win', winner: 'p1' }
    const w = mount(ResultView, {
      props: {
        outcome,
        secrets: { p1: '1234', p2: '5678' },
        history: emptyHistory,
        names: { p1: 'Alice', p2: 'Bob' },
        saveError: null,
      },
    })
    expect(w.text()).toContain('Alice获胜')
    expect(w.text()).toContain('Alice的数字：1234')
    expect(w.text()).toContain('Bob的数字：5678')
  })

  it('默认显示已保存提示；saveError 时显示错误', () => {
    const outcome: Outcome = { kind: 'draw' }
    const ok = mount(ResultView, {
      props: { outcome, secrets: { p1: '1', p2: '2' }, history: emptyHistory, saveError: null },
    })
    expect(ok.text()).toContain('已保存到历史')

    const fail = mount(ResultView, {
      props: {
        outcome,
        secrets: { p1: '1', p2: '2' },
        history: emptyHistory,
        saveError: '历史保存失败',
      },
    })
    expect(fail.text()).toContain('历史保存失败')
    expect(fail.text()).not.toContain('已保存到历史')
  })

  it('查看历史按钮 emit viewHistory', async () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1', p2: '2' }, history: emptyHistory },
    })
    const buttons = w.findAll('.result-actions button')
    await buttons[buttons.length - 1].trigger('click') // 最后一个 = 查看历史
    expect(w.emitted('viewHistory')).toHaveLength(1)
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/ResultView.test.ts`
Expected: FAIL —— 新用例失败（无昵称文案/无 `.result-actions`/无 viewHistory）。

- [ ] **Step 3: 整文件替换 `src/components/ResultView.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, Outcome } from '../game/types'
import { sideName } from '../playerLabels'
import HistoryList from './HistoryList.vue'

const props = defineProps<{
  outcome: Outcome
  secrets: { p1: string | null; p2: string | null }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  names?: { p1: string | null; p2: string | null }
  saveError?: string | null
}>()
const emit = defineEmits<{ playAgain: []; viewHistory: [] }>()

const p1Name = computed(() => sideName('p1', props.names))
const p2Name = computed(() => sideName('p2', props.names))

const resultText = computed(() => {
  if (props.outcome.kind === 'draw') return '平局！'
  if (props.outcome.kind === 'win') return `${sideName(props.outcome.winner, props.names)}获胜！`
  return ''
})
</script>

<template>
  <div class="result">
    <h2>{{ resultText }}</h2>
    <p class="reveal">{{ p1Name }}的数字：{{ secrets.p1 }}　{{ p2Name }}的数字：{{ secrets.p2 }}</p>
    <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
    <p v-else class="saved-hint">✅ 本局已保存到历史</p>
    <div class="histories">
      <HistoryList :records="history.p1" :title="p1Name" side="red" />
      <HistoryList :records="history.p2" :title="p2Name" side="blue" />
    </div>
    <div class="result-actions">
      <button type="button" @click="emit('playAgain')">再来一局</button>
      <button type="button" @click="emit('viewHistory')">📜 查看历史</button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/ResultView.test.ts`
Expected: PASS（原 4 个 + 新 3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultView.vue src/components/ResultView.test.ts
git commit -m "feat(history): ResultView 显示昵称/保存提示 + 查看历史按钮"
```

## Task 11: App 整合（录入 + 视图切换）

整文件重写 `App.vue`：提升 `names`、`watch(phase)` 自动保存、`view` 切换、挂 HistoryView/HistoryDetail、历史入口按钮。录入逻辑用独立测试文件（mock store）验证；视图切换在 `App.test.ts` 验证。

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.test.ts`（追加视图切换用例）、`src/App.recording.test.ts`（新建，mock store）

- [ ] **Step 1: 写录入集成测试 `src/App.recording.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as store from './history/store'
import App from './App.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

vi.mock('./history/store')
const mockStore = vi.mocked(store)

async function playToWin(w: ReturnType<typeof mount>) {
  w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
  w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '5678') // p1 命中 p2
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '0000') // p2 未中 → over
  await flushPromises()
}

describe('App 录入历史', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.saveGame.mockResolvedValue(undefined)
    mockStore.listGames.mockResolvedValue([])
  })

  it('一局结束恰好保存一条，字段正确', async () => {
    const w = mount(App)
    await playToWin(w)
    expect(mockStore.saveGame).toHaveBeenCalledTimes(1)
    const rec = mockStore.saveGame.mock.calls[0][0]
    expect(rec.secrets).toEqual({ p1: '1234', p2: '5678' })
    expect(rec.outcome).toEqual({ kind: 'win', winner: 'p1' })
    expect(rec.names).toEqual({ p1: null, p2: null })
    expect(rec.digits).toBe(4)
    expect(typeof rec.id).toBe('string')
  })

  it('再来一局后再次结束 → 共保存两次且 id 不同', async () => {
    const w = mount(App)
    await playToWin(w)
    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    await playToWin(w)
    expect(mockStore.saveGame).toHaveBeenCalledTimes(2)
    const id1 = mockStore.saveGame.mock.calls[0][0].id
    const id2 = mockStore.saveGame.mock.calls[1][0].id
    expect(id1).not.toBe(id2)
  })

  it('保存失败时显示 saveError，不崩', async () => {
    mockStore.saveGame.mockRejectedValueOnce(new Error('quota'))
    const w = mount(App)
    await playToWin(w)
    expect(w.findComponent(ResultView).text()).toContain('历史保存失败')
  })

  it('记录昵称：setName 后保存的 names 反映昵称（空串→null）', async () => {
    const w = mount(App)
    w.findComponent(SetupView).vm.$emit('setName', 'p1', 'Alice')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setName', 'p2', '')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000')
    await flushPromises()
    expect(mockStore.saveGame.mock.calls[0][0].names).toEqual({ p1: 'Alice', p2: null })
  })
})
```

- [ ] **Step 2: 追加视图切换测试到 `src/App.test.ts`**

在文件顶部 import 增加：

```typescript
import HistoryView from './components/HistoryView.vue'
```

在 `describe('App 整合', () => {` 内追加：

```typescript
  it('点击「历史」进入历史视图，返回回到游戏', async () => {
    const w = mount(App)
    expect(w.findComponent(SetupView).exists()).toBe(true)

    await w.find('.nav-history').trigger('click')
    await w.vm.$nextTick()
    expect(w.findComponent(HistoryView).exists()).toBe(true)
    expect(w.findComponent(SetupView).exists()).toBe(false)

    w.findComponent(HistoryView).vm.$emit('back')
    await w.vm.$nextTick()
    expect(w.findComponent(SetupView).exists()).toBe(true)
  })
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/App.recording.test.ts src/App.test.ts`
Expected: FAIL —— 录入文件因 `saveGame` 从未被调用而失败；`App.test.ts` 找不到 `.nav-history`。

- [ ] **Step 4: 整文件替换 `src/App.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from './composables/useGame'
import { useHistory } from './composables/useHistory'
import { buildGameRecord } from './history/record'
import { saveGame } from './history/store'
import type { PlayerId } from './game/types'
import type { GameRecord } from './history/types'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'
import SolverPanel from './components/SolverPanel.vue'
import HistoryView from './components/HistoryView.vue'
import HistoryDetail from './components/HistoryDetail.vue'

const {
  phase, current, outcome, config, state,
  applySecret, applyGuess, checkSecret, checkGuess, reset,
} = useGame()

const names = ref<{ p1: string | null; p2: string | null }>({ p1: null, p2: null })
const applyName = (p: PlayerId, n: string) => {
  names.value[p] = n.trim() || null
}

const saved = ref(false)
const saveError = ref<string | null>(null)

watch(phase, async (p) => {
  if (p === 'over' && !saved.value) {
    saved.value = true
    saveError.value = null
    try {
      await saveGame(buildGameRecord(state.value, names.value))
    } catch {
      saveError.value = '历史保存失败（可能是浏览器隐私模式）'
    }
  }
})

function playAgain() {
  reset()
  names.value = { p1: null, p2: null }
  saved.value = false
  saveError.value = null
}

const view = ref<'game' | 'history'>('game')
const detail = ref<GameRecord | null>(null)
const { records, error: historyError, load, remove, clear } = useHistory()

async function openHistory() {
  detail.value = null
  view.value = 'history'
  await load()
}

const activeSide = computed(() => {
  if (phase.value === 'playing') return current.value === 'p1' ? 'red' : 'blue'
  if (phase.value === 'setup') return state.value.secrets.p1 === null ? 'red' : 'blue'
  return 'neutral'
})
</script>

<template>
  <div class="stage" :class="`side-${activeSide}`">
    <div class="table">
      <template v-if="view === 'game'">
        <SolverPanel
          v-if="phase === 'playing'"
          class="solver-left"
          :digits="config.digits"
          :guesses="state.history.p1"
          side="red"
        />

        <main class="app">
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

          <SetupView
            v-if="phase === 'setup'"
            :digits="config.digits"
            :validate="checkSecret"
            @set-secret="applySecret"
            @set-name="applyName"
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
            :names="names"
            :save-error="saveError"
            @play-again="playAgain"
            @view-history="openHistory"
          />
        </main>

        <SolverPanel
          v-if="phase === 'playing'"
          class="solver-right"
          :digits="config.digits"
          :guesses="state.history.p2"
          side="blue"
        />
      </template>

      <main v-else class="app history-page">
        <HistoryDetail
          v-if="detail"
          :record="detail"
          @back="detail = null"
          @delete="async (id) => { await remove(id); detail = null }"
        />
        <HistoryView
          v-else
          :records="records"
          :error="historyError"
          @open="detail = $event"
          @remove="remove"
          @clear="clear"
          @back="view = 'game'"
        />
      </main>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/App.recording.test.ts src/App.test.ts`
Expected: PASS（录入 4 个 + App 原 5 个 + 视图切换 1 个）。

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/App.test.ts src/App.recording.test.ts
git commit -m "feat(history): App 整合录入历史 + 历史视图切换"
```

## Task 12: 样式（style.css）

纯视觉，无逻辑。复用现有 CSS 变量（`--card`/`--border`/`--radius`/`--accent`/`--text-muted`/`--danger` 等）。

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 在 `src/style.css` 末尾追加样式**

```css
/* ---------- 设置阶段：可选昵称 ---------- */
.setup-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.name-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: left;
}
.name-field input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-family: var(--font-sans);
}
.name-field input:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}

/* ---------- 顶部标题栏 + 历史入口 ---------- */
.app-head {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.nav-history {
  position: absolute;
  right: 0;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.85rem;
}
.nav-history:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ---------- 历史列表 ---------- */
.history-page {
  width: min(680px, 96vw);
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.history-actions {
  display: flex;
  gap: 8px;
}
.history-actions button {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  cursor: pointer;
}
.history-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.row-main {
  flex: 1;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 12px;
  align-items: center;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  cursor: pointer;
  font: inherit;
}
.row-main:hover {
  border-color: var(--accent);
}
.row-main .when {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.row-main .match {
  font-weight: 600;
}
.row-main .meta {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.row-del {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--danger);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  cursor: pointer;
}
.row-del:hover {
  border-color: var(--danger);
  background: var(--red-soft);
}

/* ---------- 历史详情 ---------- */
.history-detail .detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.history-detail .detail-head button {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  cursor: pointer;
}
.history-detail .detail-head .when {
  color: var(--text-muted);
  font-size: 0.85rem;
}
.detail-del {
  margin-top: 16px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--danger);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  cursor: pointer;
}
.detail-del:hover {
  border-color: var(--danger);
  background: var(--red-soft);
}

/* ---------- 结果页：保存提示 + 操作 ---------- */
.saved-hint {
  color: #16a34a;
  font-size: 0.9rem;
}
.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
```

- [ ] **Step 2: 运行全部测试，确认未破坏**

Run: `npm run test`
Expected: PASS（既有 135 + 本次新增全部通过）。

- [ ] **Step 3: 构建验证（含类型检查）**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 无错误 + `vite build` 成功产出 `dist/`。

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style(history): 昵称输入/历史列表/详情/保存提示样式"
```

## Task 13: 文档（L1–L4 + README）

边写代码边填充分层文档。

**Files:**
- Create: `docs/L2-components/history.md`、`docs/L3-details/history-storage.md`、`docs/L4-api/history.md`
- Modify: `docs/L1-overview.md`、`docs/L4-api/components.md`、`README.md`

- [ ] **Step 1: 创建 `docs/L2-components/history.md`**

````markdown
# L2 · 本地对局历史模块

纯前端的对局历史：每局结束自动存入浏览器 IndexedDB，可在历史视图浏览/删除，详情展示双方数字与完整猜测记录。与对局引擎完全解耦。

## 组成

| 单元 | 文件 | 职责 |
|------|------|------|
| 数据类型 | `src/history/types.ts` | `GameRecord` 结构 |
| 存储层 | `src/history/store.ts` | IndexedDB 封装：save/list/get/delete/clear |
| 记录组装 | `src/history/record.ts` | 纯函数 `buildGameRecord` + `newId` |
| 响应式封装 | `src/composables/useHistory.ts` | `records`/`error` + `load`/`remove`/`clear` |
| 列表视图 | `src/components/HistoryView.vue` | 展示列表（props 进、事件出） |
| 详情视图 | `src/components/HistoryDetail.vue` | 单局详情（复用 `HistoryList`×2） |

## 数据流

```
SetupView(昵称+秘密) → App(names) → useGame(state)
   phase→over ─watch─► buildGameRecord ─► saveGame ─► IndexedDB
App: 点击历史 → useHistory.load → listGames → HistoryView
     点某行 → HistoryDetail（双方数字 + 双方猜测）
```

## 降级

历史是增强功能：IndexedDB 不可用/失败时游戏照常，仅内联提示「历史保存失败 / 历史读取失败」。
````

- [ ] **Step 2: 创建 `docs/L3-details/history-storage.md`**

````markdown
# L3 · 历史存储细节（IndexedDB）

## Schema

- 库 `ngg`，版本 1；对象仓库 `games`，`keyPath: "id"`；索引 `playedAt`。
- `onupgradeneeded` 建仓库 + 索引；`openDB` 缓存连接 Promise，**打开失败不缓存被拒连接**（允许重试，且 jsdom 无 indexedDB 时不污染后续）。

## 倒序列出

```
index(playedAt).openCursor(null, "prev")  // playedAt 从大到小
→ 游标依次 push → 完成时 resolve（最新在前）
```

## 保存时机与防重复

- `App.vue` 的 `watch(phase)`：首次进入 `over` 时 `buildGameRecord` → `saveGame`。
- `saved` 标志保证一局只存一条；`playAgain()` 复位 `saved`/`saveError`/`names`，下一局再存（`id` 不同）。

## id 生成

`newId()`：优先 `crypto.randomUUID()`，不可用时回退 `${Date.now()}-${random}`。

## 错误降级

| 场景 | 处理 |
|------|------|
| IndexedDB 不可用/保存失败 | 结果页内联「历史保存失败」，游戏不受影响 |
| 列表读取失败 | 历史视图显示「历史读取失败」 |
| 删除不存在 id | no-op，不抛 |
````

- [ ] **Step 3: 创建 `docs/L4-api/history.md`**

````markdown
# L4 · 历史模块 API

## `src/history/types.ts`

```typescript
interface GameRecord {
  id: string
  playedAt: number
  digits: number
  names: { p1: string | null; p2: string | null }
  secrets: { p1: string; p2: string }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  outcome: Outcome
  rounds: number
}
```

## `src/history/store.ts`

```typescript
saveGame(record: GameRecord): Promise<void>      // put（同 id 覆盖）
listGames(): Promise<GameRecord[]>               // playedAt 倒序
getGame(id: string): Promise<GameRecord | undefined>
deleteGame(id: string): Promise<void>            // 删不存在 = no-op
clearAll(): Promise<void>
```

## `src/history/record.ts`

```typescript
newId(): string
buildGameRecord(
  state: GameState,
  names: { p1: string | null; p2: string | null },
  opts?: { id?: string; now?: number },
): GameRecord   // 仅 over 阶段，否则抛错；history 深拷贝
```

## `src/composables/useHistory.ts`

```typescript
useHistory(): {
  records: Ref<GameRecord[]>
  error: Ref<string | null>
  load(): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}
```
````

- [ ] **Step 4: 修改 `docs/L1-overview.md`（在模块列表/概述处增一段）**

在概述的模块小节追加：

```markdown
- **本地对局历史**：每局结束自动存入浏览器 IndexedDB（`src/history/`），支持可选昵称、历史列表与单局详情（双方数字 + 猜测记录）。纯前端、与引擎解耦，详见 [L2 history](./L2-components/history.md)。
```

- [ ] **Step 5: 修改 `docs/L4-api/components.md`（追加新组件）**

在文件末尾追加：

```markdown
## HistoryView

```typescript
props: { records: GameRecord[]; error: string | null }
emits: { open: [GameRecord]; remove: [string]; clear: []; back: [] }
```

## HistoryDetail

```typescript
props: { record: GameRecord }
emits: { back: []; delete: [string] }
```

## SetupView（新增）

```typescript
emits: { setSecret: [PlayerId, string]; setName: [PlayerId, string] }
```
```

- [ ] **Step 6: 修改 `README.md`（功能介绍 + 文档覆盖表）**

在功能列表合适处追加一行；在「当前文档覆盖」表追加 history 行：

```markdown
- **本地对局历史**：每局自动存浏览器（IndexedDB），可查看过往对局的双方数字与完整猜测记录，支持可选昵称。
```

- [ ] **Step 7: Commit**

```bash
git add docs/L1-overview.md docs/L2-components/history.md docs/L3-details/history-storage.md docs/L4-api/history.md docs/L4-api/components.md README.md
git commit -m "docs(history): L1-L4 + README 同步本地对局历史"
```

## Task 14: 全量验证 + 部署

**Files:** 无（验证与部署）

- [ ] **Step 1: 全量测试**

Run: `npm run test`
Expected: 全部测试通过——既有 135 + 新增（store 9、record 4、useHistory 4、sideName 3、SetupView +2、HistoryView 8、HistoryDetail 5、ResultView +3、App 录入 4、App 视图切换 1）。

- [ ] **Step 2: 构建（类型检查 + 打包）**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 0 错误；`vite build` 成功，`dist/` 产出。

- [ ] **Step 3: 本地预览自测（可选但推荐）**

Run: `npm run preview`，浏览器打开预览地址：
- 设置阶段填昵称、玩完一局 → 结果页出现「✅ 本局已保存到历史」。
- 点「📜 历史」→ 列表出现该局（Alice vs Bob / 结果 / 位数·回合）。
- 点该行 → 详情显示双方数字 + 两列猜测；删除/清空生效；刷新页面历史仍在（IndexedDB 持久化）。

- [ ] **Step 4: 推送触发部署**

```bash
git push
```
Expected: 推送到 `main`，GitHub Actions `Deploy to GitHub Pages` 自动运行（npm ci → test → build → 部署）。

- [ ] **Step 5: 验证线上**

- 等待 Actions 运行 `conclusion=success`。
- 访问 https://verdenmax.github.io/number-guessing-game/ ，确认 HTTP 200、可玩、历史功能正常（IndexedDB 在 HTTPS 下可用）。

---

## Self-Review 结论（计划自查）

- **Spec 覆盖**：存储介质(IndexedDB→T1-T3)、可选昵称(T6/T7)、自动保存+防重复(T4/T11)、列表+详情(T8/T9)、删除/清空(T8/T9/T11)、降级(T2 守卫/T5 catch/T11)、测试(各 task + T14)、文档(T13) 均有对应任务。
- **类型一致**：`GameRecord`/`RecordNames`/`sideName(player, names?)`/store 五方法签名在 T1-T13 保持一致。
- **不破坏既有**：ResultView 新增 prop 为可选、文案子串保持（`蓝方获胜`/`红方的数字`）；App 保留 SolverPanel 渲染契约与 `playAgain`；新增 `view` 默认 `game`。
- **无占位符**：每步含完整代码与命令。










