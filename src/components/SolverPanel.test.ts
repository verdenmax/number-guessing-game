import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SolverPanel from './SolverPanel.vue'
import type { GuessRecord } from '../game/types'

const noGuesses: GuessRecord[] = []

describe('SolverPanel 渲染与折叠', () => {
  it('默认收起：不显示网格', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    expect(w.find('.solver-grid').exists()).toBe(false)
  })

  it('点击标题展开后显示 4 列 × 10 格 = 40 个格子', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(true)
    expect(w.findAll('.solver-cell')).toHaveLength(40)
  })

  it('再次点击标题收起', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(true)
    await w.find('.solver-toggle').trigger('click')
    expect(w.find('.solver-grid').exists()).toBe(false)
  })

  it('side 主题 class', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'blue' } })
    expect(w.find('.solver').classes()).toContain('side-blue')
  })

  it('展开后每格带状态 class（初始 available）', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: noGuesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    expect(w.findAll('.solver-cell.available')).toHaveLength(40)
  })
})
