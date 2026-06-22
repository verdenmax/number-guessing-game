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
