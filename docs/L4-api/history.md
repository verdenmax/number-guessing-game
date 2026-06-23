# L4 · API · 历史模块（`src/history/*` + `useHistory`）

> 上层：[L2 历史模块](../L2-components/history.md) · [L3 历史存储](../L3-details/history-storage.md) ｜ 源码：`src/history/types.ts` · `src/history/store.ts` · `src/history/record.ts` · `src/composables/useHistory.ts`
>
> 两个历史视图（`HistoryView` / `HistoryDetail`）的 props / emits 见 [components API](./components.md)。

## `src/history/types.ts`

```typescript
import type { GuessRecord, Outcome } from '../game/types'

interface GameRecord {
  id: string
  playedAt: number                                   // 存档时间戳 ms（索引字段）
  digits: number
  names: { p1: string | null; p2: string | null }    // 可选昵称
  secrets: { p1: string; p2: string }                // 双方秘密数（结束后必非 null）
  history: { p1: GuessRecord[]; p2: GuessRecord[] }   // 双方完整猜测记录（逐条浅拷贝，脱离原 state）
  outcome: Outcome                                    // 'win'(winner) | 'draw' | 'ongoing'；持久化记录恒为 win/draw
  rounds: number
}
```

## `src/history/store.ts`

纯 IndexedDB 封装，零 Vue 依赖；全部返回 `Promise`，失败时 reject（由上层降级处理）。

```typescript
saveGame(record: GameRecord): Promise<void>            // put（同 id 覆盖）
listGames(): Promise<GameRecord[]>                     // 按 playedAt 倒序（最新在前）
getGame(id: string): Promise<GameRecord | undefined>   // 查无返回 undefined
deleteGame(id: string): Promise<void>                  // 删不存在的 id = no-op
clearAll(): Promise<void>                              // 清空整个 games 仓库
```

> 库 `ngg` / 仓库 `games` / `keyPath:"id"` / 索引 `playedAt`，细节见 [L3 历史存储](../L3-details/history-storage.md)。

## `src/history/record.ts`

```typescript
newId(): string
// 优先 crypto.randomUUID()，不可用时回退 `${Date.now()}-${random}`

buildGameRecord(
  state: GameState,
  names: { p1: string | null; p2: string | null },
  opts?: { id?: string; now?: number },
): GameRecord
// 仅 over 阶段可调用，否则抛错；null 秘密守卫（防腐）；history 逐条浅拷贝（GuessRecord 扁平，完全脱离原 state）。
// opts.id / opts.now 可注入（便于测试 / 复现），缺省用 newId() / Date.now()。
```

## `src/composables/useHistory.ts`

```typescript
useHistory(): {
  records: Ref<GameRecord[]>
  error: Ref<string | null>
  load(): Promise<void>               // 读失败 → error='历史读取失败'、records=[]
  remove(id: string): Promise<void>   // 成功后自动 load()；失败 → error='历史删除失败'（不抛、不重载）
  clear(): Promise<void>              // 成功后自动 load()；失败 → error='历史清空失败'（不抛、不重载）
}
```

`load` / `remove` / `clear` 均把失败降级到 `error`，**对外不抛出**；`remove` / `clear` 成功后会 `load()` 刷新列表，只有失败路径才保留原列表并设 `error`。错误降级对照表见 [L3 历史存储](../L3-details/history-storage.md)。
