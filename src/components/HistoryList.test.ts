import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryList from './HistoryList.vue'

describe('HistoryList', () => {
  it('猜测记录渲染为带表头的 table', () => {
    const records = [
      { guess: '1234', feedback: 2 },
      { guess: '5678', feedback: 0 },
    ]
    const w = mount(HistoryList, { props: { records, title: '红方', side: 'red' } })
    expect(w.find('table.guess-table').exists()).toBe(true)
    const headers = w.findAll('th[scope="col"]').map((h) => h.text())
    expect(headers).toEqual(['猜测', '正确数目'])
    const firstRow = w.findAll('tbody tr')[0].findAll('td').map((c) => c.text())
    expect(firstRow).toEqual(['1234', '2'])
  })

  it('空记录显示提示、无 table', () => {
    const w = mount(HistoryList, { props: { records: [], title: '红方' } })
    expect(w.find('table').exists()).toBe(false)
    expect(w.find('.empty').text()).toContain('还没有猜测')
  })

  it('table 有可访问 caption（含方名）+ 应用 side 主题', () => {
    const w = mount(HistoryList, {
      props: { records: [{ guess: '1234', feedback: 2 }], title: '蓝方', side: 'blue' },
    })
    const cap = w.find('caption')
    expect(cap.exists()).toBe(true)
    expect(cap.text()).toContain('蓝方')
    expect(cap.classes()).toContain('visually-hidden')
    expect(w.find('.history').classes()).toContain('side-blue')
  })
})
