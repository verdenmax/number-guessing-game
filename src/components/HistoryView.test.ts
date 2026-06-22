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
