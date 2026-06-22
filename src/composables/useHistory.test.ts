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
