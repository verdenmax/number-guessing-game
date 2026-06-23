import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, listGames, deleteGame, clearAll } from './store'
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

describe('history store: delete', () => {
  beforeEach(async () => {
    await clearAll()
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
