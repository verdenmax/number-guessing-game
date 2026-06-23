import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SolverPanel from './SolverPanel.vue'
import type { GuessRecord } from '../game/types'

const noGuesses: GuessRecord[] = []

async function open(w: ReturnType<typeof mount>, cellIdx: number) {
  await w.findAll('.solver-cell')[cellIdx].trigger('click')
}
async function act(w: ReturnType<typeof mount>, action: 'assume' | 'cross' | 'clear') {
  await w.find(`.solver-menu [data-act="${action}"]`).trigger('click')
}
async function assume(w: ReturnType<typeof mount>, cellIdx: number) {
  await open(w, cellIdx); await act(w, 'assume')
}
async function cross(w: ReturnType<typeof mount>, cellIdx: number) {
  await open(w, cellIdx); await act(w, 'cross')
}

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

  it('点击 ? 按钮切换图例显示', async () => {
    const w = expand()
    await w.vm.$nextTick()
    expect(w.find('.solver-legend').exists()).toBe(false)
    await w.find('.solver-help-btn').trigger('click')
    expect(w.find('.solver-legend').exists()).toBe(true)
    await w.find('.solver-help-btn').trigger('click')
    expect(w.find('.solver-legend').exists()).toBe(false)
  })

  it('点格弹出菜单，含 假设/划除/清除 三项', async () => {
    const w = expand()
    await w.vm.$nextTick()
    expect(w.find('.solver-menu').exists()).toBe(false)
    await open(w, 5 * 4 + 0)
    const menu = w.find('.solver-menu')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('role')).toBe('menu')
    expect(menu.find('[data-act="assume"]').exists()).toBe(true)
    expect(menu.find('[data-act="cross"]').exists()).toBe(true)
    expect(menu.find('[data-act="clear"]').exists()).toBe(true)
  })

  it('菜单「假设此位」→ 该格 assumed', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('菜单「划除」→ 该格 crossed，且 aria-label 用中文状态名', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 7 * 4 + 1
    await cross(w, idx)
    const cell = w.findAll('.solver-cell')[idx]
    expect(cell.classes()).toContain('crossed')
    const label = cell.attributes('aria-label') ?? ''
    expect(label).toContain('已划除')
    expect(label).not.toContain('crossed')
  })

  it('菜单「清除」→ 撤销假设回 available（清除项在无标记时禁用）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 5 * 4 + 0
    await open(w, idx)
    expect(w.find('.solver-menu [data-act="clear"]').attributes('disabled')).toBeDefined()
    await act(w, 'assume')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('assumed')
    await open(w, idx)
    await act(w, 'clear')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('available')
  })

  it('同列另一格假设 → 替换（一列最多一个）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx5 = 5 * 4 + 0
    const idx3 = 3 * 4 + 0
    await assume(w, idx5)
    await assume(w, idx3)
    const cells = w.findAll('.solver-cell')
    expect(cells[idx3].classes()).toContain('assumed')
    expect(cells[idx5].classes()).not.toContain('assumed')
  })

  it('重置 → 清空假设与划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    await cross(w, 7 * 4 + 1)
    await w.find('.solver-reset').trigger('click')
    await w.vm.$nextTick()
    const after = w.findAll('.solver-cell')
    expect(after.filter((c) => c.classes().includes('assumed'))).toHaveLength(0)
    expect(after[7 * 4 + 1].classes()).toContain('available')
  })

  it('假设格 aria-pressed=true；格子有 aria-haspopup=menu', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 5 * 4 + 0
    expect(w.findAll('.solver-cell')[idx].attributes('aria-haspopup')).toBe('menu')
    await assume(w, idx)
    expect(w.findAll('.solver-cell')[idx].attributes('aria-pressed')).toBe('true')
  })

  it('Esc 关闭菜单；点背板关闭菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await open(w, 5 * 4 + 0)
    await w.find('.solver-menu').trigger('keydown', { key: 'Escape' })
    expect(w.find('.solver-menu').exists()).toBe(false)
    await open(w, 5 * 4 + 0)
    await w.find('.solver-menu-backdrop').trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(false)
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
    await assume(w, 9 * 4 + 0)
    expect(w.findAll('.solver-cell')[9 * 4 + 0].classes()).toContain('conflict')
  })

  it('假设某位 → 同数字在其它列联动 eliminated', async () => {
    const w = mount(SolverPanel, {
      props: { digits: 4, guesses: [], side: 'red' },
    })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    // pos1 的数字 5 应联动 eliminated（互不相同）
    expect(w.findAll('.solver-cell')[5 * 4 + 1].classes()).toContain('eliminated')
  })
})

describe('SolverPanel 智能/基础开关', () => {
  it('默认智能模式（solve）：构造 fixed 场景该格为 fixed', async () => {
    const guesses = Array.from({ length: 9 }, (_, d) => ({ guess: `${d}999`, feedback: 0 }))
    const w = mount(SolverPanel, { props: { digits: 4, guesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const idx = 9 * 4 + 0 // 行优先：digit=9 行、pos0
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('fixed')
  })

  it('切到基础模式（basicSolve）：同场景该格变 available（不自动判 fixed）', async () => {
    const guesses = Array.from({ length: 9 }, (_, d) => ({ guess: `${d}999`, feedback: 0 }))
    const w = mount(SolverPanel, { props: { digits: 4, guesses, side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const idx = 9 * 4 + 0
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('fixed')

    await w.find('.solver-mode input').setValue(false) // 关闭智能
    await w.vm.$nextTick()
    const cell = w.findAll('.solver-cell')[idx]
    expect(cell.classes()).toContain('available')
    expect(cell.classes()).not.toContain('fixed')
  })

  it('切换模式保留已有假设与划除', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    await assume(w, 5 * 4 + 0)
    await cross(w, 7 * 4 + 1)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')

    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed') // 假设保留
    expect(w.findAll('.solver-cell')[7 * 4 + 1].classes()).toContain('crossed') // 划除保留
  })

  it('图例随模式自适应：基础模式隐藏「确定」色块、说明文案随之变化', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    await w.find('.solver-help-btn').trigger('click') // 展开图例
    await w.vm.$nextTick()

    // 智能模式：图例含 fixed 色块 + 含「枚举」说明
    expect(w.find('.solver-legend .solver-cell.fixed').exists()).toBe(true)
    expect(w.find('.solver-legend').text()).toContain('枚举')

    // 切基础模式
    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    expect(w.find('.solver-legend .solver-cell.fixed').exists()).toBe(false)
    expect(w.find('.solver-legend').text()).toContain('只标排除')
    expect(w.find('.solver-legend').text()).not.toContain('枚举')
  })
})

describe('SolverPanel 菜单 corner', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }

  it('清除可移除划除（仅划除时清除可用）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const idx = 6 * 4 + 2
    await cross(w, idx)
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('crossed')
    await open(w, idx)
    // 仅划除也应可清除（canClear 对划除为真）
    expect(w.find('.solver-menu [data-act="clear"]').attributes('disabled')).toBeUndefined()
    await act(w, 'clear')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('available')
  })

  it('A 菜单开着点 B → 锚点切到 B，对 B 操作生效', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await open(w, 5 * 4 + 0)
    expect(w.find('.solver-menu').exists()).toBe(true)
    await open(w, 3 * 4 + 0) // 点另一格
    expect(w.find('.solver-menu').exists()).toBe(true)
    await act(w, 'assume')
    expect(w.findAll('.solver-cell')[3 * 4 + 0].classes()).toContain('assumed')
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).not.toContain('assumed')
  })

  it('右键(contextmenu)也打开菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('contextmenu')
    expect(w.find('.solver-menu').exists()).toBe(true)
  })

  it('同格再点关闭菜单（toggle）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await open(w, 5 * 4 + 0)
    expect(w.find('.solver-menu').exists()).toBe(true)
    await open(w, 5 * 4 + 0)
    expect(w.find('.solver-menu').exists()).toBe(false)
  })
})

describe('SolverPanel 剩 N 个可能', () => {
  it('智能模式显示剩余候选数，≤8 时列出', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [{ guess: '1234', feedback: 4 }], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const txt = w.find('.solver-count').text()
    expect(txt).toContain('剩 1 个可能')
    expect(txt).toContain('1234')
  })

  it('基础模式不显示剩余计数', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.find('.solver-mode input').setValue(false)
    await w.vm.$nextTick()
    expect(w.find('.solver-count').exists()).toBe(false)
  })

  it('剩 N 个可能随假设实时更新', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.solver-count').text()).toContain('剩 5040 个可能')
    await assume(w, 5 * 4 + 0) // 经菜单假设 pos0=5
    await w.vm.$nextTick()
    expect(w.find('.solver-count').text()).toContain('剩 504 个可能')
  })
})
