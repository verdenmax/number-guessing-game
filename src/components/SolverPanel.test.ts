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

describe('SolverPanel 交互', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }

  it('左键点格 → 该格变 assumed', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    // 行优先排列：行=digit、列=pos；digit=5 行起始索引 = 5*4，pos0 偏移 0
    await cells[5 * 4 + 0].trigger('click')
    expect(cells[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('再次点同格 → 取消假设（回 available）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 5 * 4 + 0
    await cells[idx].trigger('click')
    expect(cells[idx].classes()).toContain('assumed')
    await cells[idx].trigger('click')
    expect(cells[idx].classes()).toContain('available')
  })

  it('点同列另一格 → 替换假设（一列最多一个）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx5 = 5 * 4 + 0 // pos0 digit5
    const idx3 = 3 * 4 + 0 // pos0 digit3
    await cells[idx5].trigger('click')
    await cells[idx3].trigger('click')
    expect(cells[idx3].classes()).toContain('assumed')
    expect(cells[idx5].classes()).not.toContain('assumed')
  })

  it('右键格 → 切换 crossed（手动划除）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 7 * 4 + 1 // pos1 digit7
    await cells[idx].trigger('contextmenu')
    expect(cells[idx].classes()).toContain('crossed')
  })

  it('重置 → 清空假设与划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    await cells[5 * 4 + 0].trigger('click') // 假设
    await cells[7 * 4 + 1].trigger('contextmenu') // 划除
    await w.find('.solver-reset').trigger('click')
    await w.vm.$nextTick()
    const after = w.findAll('.solver-cell')
    expect(after.filter((c) => c.classes().includes('assumed'))).toHaveLength(0)
    // 之前划除的格恢复 available
    expect(after[7 * 4 + 1].classes()).toContain('available')
  })

  it('Shift+左键 → 划除（crossed）而非假设', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 5 * 4 + 0
    await cells[idx].trigger('click', { shiftKey: true })
    expect(cells[idx].classes()).toContain('crossed')
    expect(cells[idx].classes()).not.toContain('assumed')
  })

  it('键盘 Delete → 划除（无障碍路径）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 4 * 4 + 2
    await cells[idx].trigger('keydown', { key: 'Delete' })
    expect(cells[idx].classes()).toContain('crossed')
  })

  it('假设格 aria-pressed=true', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 5 * 4 + 0
    await cells[idx].trigger('click')
    expect(cells[idx].attributes('aria-pressed')).toBe('true')
  })
})

describe('SolverPanel what-if 集成', () => {
  it('强行假设一个被事实排除的数字 → conflict（联动 solve 实时反映）', async () => {
    // 事实：猜 1234 得 4 → 秘密就是 1234；强行假设 pos0=9 应标红 conflict
    const w = mount(SolverPanel, {
      props: { digits: 4, guesses: [{ guess: '1234', feedback: 4 }], side: 'red' },
    })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    const idx = 9 * 4 + 0 // pos0 digit9
    await cells[idx].trigger('click')
    expect(cells[idx].classes()).toContain('conflict')
  })

  it('假设某位 → 同数字在其它列联动 eliminated', async () => {
    const w = mount(SolverPanel, {
      props: { digits: 4, guesses: [], side: 'red' },
    })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const cells = w.findAll('.solver-cell')
    await cells[5 * 4 + 0].trigger('click') // 假设 pos0=5
    // pos1 的数字 5 应联动 eliminated（互不相同）
    expect(cells[5 * 4 + 1].classes()).toContain('eliminated')
  })
})
