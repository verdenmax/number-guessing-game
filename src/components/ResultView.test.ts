import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultView from './ResultView.vue'
import type { GuessRecord, Outcome } from '../game/types'

const emptyHistory: { p1: GuessRecord[]; p2: GuessRecord[] } = { p1: [], p2: [] }

describe('ResultView', () => {
  it('平局文案', () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    expect(w.text()).toContain('平局')
  })

  it('胜利文案：蓝方获胜', () => {
    const outcome: Outcome = { kind: 'win', winner: 'p2' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    expect(w.text()).toContain('蓝方获胜')
  })

  it('公开双方秘密', () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    expect(w.text()).toContain('1234')
    expect(w.text()).toContain('5678')
  })

  it('换数字再战 emit playAgain', async () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    await w.find('button').trigger('click')
    expect(w.emitted('playAgain')).toHaveLength(1)
  })

  it('使用昵称显示获胜方与揭晓', () => {
    const outcome: Outcome = { kind: 'win', winner: 'p1' }
    const w = mount(ResultView, {
      props: {
        outcome,
        secrets: { p1: '1234', p2: '5678' },
        history: emptyHistory,
        names: { p1: 'Alice', p2: 'Bob' },
      },
    })
    expect(w.text()).toContain('Alice获胜')
    expect(w.text()).toContain('Alice的数字：1234')
    expect(w.text()).toContain('Bob的数字：5678')
  })

  it('保存状态：saving→保存中、saved→已保存、error→失败', () => {
    const outcome: Outcome = { kind: 'draw' }
    const base = { outcome, secrets: { p1: '1', p2: '2' }, history: emptyHistory }

    const saving = mount(ResultView, { props: { ...base, saveStatus: 'saving' as const } })
    expect(saving.text()).toContain('正在保存')

    const saved = mount(ResultView, { props: { ...base, saveStatus: 'saved' as const } })
    expect(saved.text()).toContain('已保存到历史')

    const fail = mount(ResultView, { props: { ...base, saveStatus: 'error' as const } })
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

  it('挂载时把焦点移到结果标题', () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      attachTo: document.body,
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory, saveStatus: 'saved' as const },
    })
    expect(document.activeElement).toBe(w.find('h2').element)
    w.unmount()
  })

  it('保存状态在 polite live region 内', () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory, saveStatus: 'saved' as const },
    })
    const region = w.find('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toContain('已保存')
  })

  it('再战按钮文案为「换数字再战」', () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    expect(w.find('.result-actions').text()).toContain('换数字再战')
  })
})
