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

  it('再来一局 emit', async () => {
    const outcome: Outcome = { kind: 'draw' }
    const w = mount(ResultView, {
      props: { outcome, secrets: { p1: '1234', p2: '5678' }, history: emptyHistory },
    })
    await w.find('button').trigger('click')
    expect(w.emitted('playAgain')).toHaveLength(1)
  })
})
