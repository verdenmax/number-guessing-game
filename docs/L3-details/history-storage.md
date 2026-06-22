# L3 · 历史存储细节（IndexedDB）

> 上层：[L1 概览](../L1-overview.md) · [L2 历史模块](../L2-components/history.md) ｜ 下钻：[L4 history API](../L4-api/history.md) ｜ 源码：`src/history/store.ts` · `src/history/record.ts` · `src/App.vue`

每局结束把一条 `GameRecord` 存进浏览器 IndexedDB，列表按时间倒序展示。本页讲存储 schema、倒序列出、保存时机与防重复、id 生成与错误降级。

## Schema

- 库 `ngg`，版本 `1`；对象仓库 `games`，`keyPath: "id"`；索引 `playedAt`（用于倒序列出）。
- `onupgradeneeded` 时建仓库 + 索引（带 `contains` 守卫，幂等）。
- `openDB()` 缓存连接 Promise（`dbPromise`），但**打开失败不缓存被拒连接**——`p.catch` 里把 `dbPromise` 复位为 `null`，允许后续重试（也避免 jsdom 无 `indexedDB` 时污染后续用例）。
- `typeof indexedDB === 'undefined'` 时直接 reject「IndexedDB 不可用」；另处理 `onerror` / `onblocked`。

```text
indexedDB.open("ngg", 1)
  ├─ onupgradeneeded → createObjectStore("games", {keyPath:"id"}) + createIndex("playedAt")
  ├─ onsuccess       → resolve(db)（缓存到 dbPromise）
  ├─ onerror         → reject（且清空 dbPromise，允许重试）
  └─ onblocked       → reject
```

每个事务都成对处理结束与失败回调（`oncomplete`/`onsuccess` 对 `onerror`/`onabort`），保证 Promise 始终会 settle、不会永不兑现。

## 倒序列出

```text
index("playedAt").openCursor(null, "prev")   // playedAt 从大到小
  → 游标依次 out.push(cursor.value) → cursor.continue()
  → 游标耗尽（cursor === null）时 resolve(out)   // 最新在前
```

## 保存时机与防重复

- `App.vue` 的 `watch(phase)`：**首次**进入 `over` 时 `buildGameRecord(state, names)` → `saveGame`。
- `saved` 标志保证**一局只存一条**（`if (p === 'over' && !saved.value) { saved.value = true … }`）。
- `playAgain()` 调 `reset()` 并复位 `saved` / `saveError` / `names`，下一局再存一条（`id` 不同，互不覆盖）。
- 保存失败只设 `saveError`（结果页提示），不影响对局展示。

```text
phase ──► over ──┬─ saved? 是 ─► 跳过（已存）
                 └─ saved? 否 ─► saved=true ─► buildGameRecord ─► saveGame
                                                  │捕获异常
                                                  └─► saveError='历史保存失败（可能是浏览器隐私模式）'
```

## 记录组装（`buildGameRecord`）

- 仅在 `over` 阶段调用，否则**抛错**（`'buildGameRecord 只能在 over 阶段调用'`）。
- 对 `null` 秘密有守卫（`over` 阶段双方秘密理论上不可能为 `null`，作持久化防腐，命中即抛错）。
- `history.p1` / `history.p2` 做**浅拷贝每条记录**（`map(r => ({ ...r }))`），与对局 state 解耦，避免后续复用 state 被改动牵连。
- `names` 透传可选昵称（`string | null`）；列表 / 详情用 `sideName` 兜底为「红方 / 蓝方」。

## id 生成（`newId`）

优先 `crypto.randomUUID()`；不可用时回退 `` `${Date.now()}-${Math.random().toString(36).slice(2)}` ``。

## 错误降级（读 / 写对称）

`useHistory` 的 `load` / `remove` / `clear` 都把失败降级到 `error`，**对外不抛出**；`remove` / `clear` **成功后会 `load()` 重载**，**失败才**设 `error` 并跳过重载（保留原列表）。

| 场景 | error 文案 | 列表表现 |
|------|-----------|----------|
| 读取失败（`load`） | `历史读取失败` | 退化为空 + 横幅 |
| 保存失败（`save`，结果页） | `历史保存失败（可能是浏览器隐私模式）` | 不影响列表 |
| 删除失败（`remove`） | `历史删除失败` | 保留原列表 + 横幅（不重载） |
| 清空失败（`clear`） | `历史清空失败` | 保留原列表 + 横幅（不重载） |
| 删除不存在的 id | —（IndexedDB `delete` 视作 no-op） | 不变 |

> 删除 / 清空成功后 `remove` / `clear` 会自动 `load()` 刷新；只有失败路径才停在「原列表 + 横幅」。
