import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SolverPanel from './SolverPanel.vue'
import type { GuessRecord } from '../game/types'
import { useInteractionMode } from '../composables/useInteractionMode'

const noGuesses: GuessRecord[] = []

beforeEach(() => {
  localStorage.clear()
  useInteractionMode().value = 'menu' // 单例：每个用例从默认菜单模式开始
})

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

  it('键盘焦点移出菜单（Tab 出）自动关闭', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await open(w, 5 * 4 + 0)
    expect(w.find('.solver-menu').exists()).toBe(true)
    // 焦点移到菜单外（如「重置假设」按钮）→ 菜单自动关闭
    await w.find('.solver-menu').trigger('focusout', { relatedTarget: w.find('.solver-reset').element })
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

describe('SolverPanel 图例与语义（事实/假设确定、地标、aria）', () => {
  it('智能模式图例区分 事实确定 / 假设下确定', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.find('.solver-help-btn').trigger('click')
    await w.vm.$nextTick()
    const legend = w.find('.solver-legend')
    expect(legend.find('.solver-cell.fixed').exists()).toBe(true)
    expect(legend.find('.solver-cell.fixedAssumed').exists()).toBe(true)
    expect(legend.text()).toContain('事实确定')
    expect(legend.text()).toContain('假设下确定')
  })

  it('solver-toggle 反映 aria-expanded', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    const toggle = w.find('.solver-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(w.find('.solver-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('面板是具名 aside 互补地标', () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'blue' } })
    const aside = w.find('aside.solver')
    expect(aside.exists()).toBe(true)
    expect(aside.attributes('aria-label')).toContain('蓝方')
  })

  it('图例不再提及左键/右键/Shift/Delete（统一菜单交互）', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.find('.solver-help-btn').trigger('click')
    await w.vm.$nextTick()
    const txt = w.find('.solver-legend').text()
    expect(txt).not.toContain('左键')
    expect(txt).not.toContain('右键')
    expect(txt).not.toContain('Shift')
    expect(txt).not.toContain('Delete')
    expect(txt).toContain('菜单')
  })
})

describe('SolverPanel 交互方式开关（菜单/右键快捷）', () => {
  function expand() {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    w.find('.solver-toggle').trigger('click')
    return w
  }
  async function setGesture(w: ReturnType<typeof mount>, on: boolean) {
    await w.find('.solver-imode input').setValue(on)
    await w.vm.$nextTick()
  }

  it('勾选「右键快捷」→ 左键点格直接假设（不弹菜单）', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(false)
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).toContain('assumed')
  })

  it('快捷模式：右键划除 + 再次取消 + Shift+左键划除 + Delete 划除', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    const idx = 7 * 4 + 1
    await w.findAll('.solver-cell')[idx].trigger('contextmenu')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('crossed')
    await w.findAll('.solver-cell')[idx].trigger('contextmenu')
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('available')
    await w.findAll('.solver-cell')[idx].trigger('click', { shiftKey: true })
    expect(w.findAll('.solver-cell')[idx].classes()).toContain('crossed')
    const idx2 = 4 * 4 + 2
    await w.findAll('.solver-cell')[idx2].trigger('keydown', { key: 'Delete' })
    expect(w.findAll('.solver-cell')[idx2].classes()).toContain('crossed')
  })

  it('快捷模式：同列替换假设、再点同格取消', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await setGesture(w, true)
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    await w.findAll('.solver-cell')[3 * 4 + 0].trigger('click')
    expect(w.findAll('.solver-cell')[3 * 4 + 0].classes()).toContain('assumed')
    expect(w.findAll('.solver-cell')[5 * 4 + 0].classes()).not.toContain('assumed')
    await w.findAll('.solver-cell')[3 * 4 + 0].trigger('click')
    expect(w.findAll('.solver-cell')[3 * 4 + 0].classes()).toContain('available')
  })

  it('默认菜单模式不变：点格弹菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(true)
  })

  it('全局共享：一侧勾选，另一侧勾选框也变 checked', async () => {
    const red = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    const blue = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'blue' } })
    await red.find('.solver-toggle').trigger('click')
    await blue.find('.solver-toggle').trigger('click')
    await red.vm.$nextTick()
    await blue.vm.$nextTick()
    await red.find('.solver-imode input').setValue(true)
    await blue.vm.$nextTick()
    expect((blue.find('.solver-imode input').element as HTMLInputElement).checked).toBe(true)
  })

  it('切到快捷模式时关闭已打开的菜单', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.findAll('.solver-cell')[5 * 4 + 0].trigger('click')
    expect(w.find('.solver-menu').exists()).toBe(true)
    await setGesture(w, true)
    expect(w.find('.solver-menu').exists()).toBe(false)
  })

  it('legend-ops 文案随模式变化', async () => {
    const w = expand()
    await w.vm.$nextTick()
    await w.find('.solver-help-btn').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.legend-ops').text()).toContain('菜单')
    await setGesture(w, true)
    expect(w.find('.legend-ops').text()).toContain('右键')
  })

  it('格子 aria 随模式自适应：菜单有 haspopup，快捷无并加动作提示', async () => {
    const w = expand()
    await w.vm.$nextTick()
    const cell = () => w.findAll('.solver-cell')[5 * 4 + 0]
    expect(cell().attributes('aria-haspopup')).toBe('menu')
    await setGesture(w, true)
    expect(cell().attributes('aria-haspopup')).toBeUndefined()
    expect(cell().attributes('aria-label')).toContain('左键假设')
  })

  it('B2 菜单视口夹取：靠右靠下单元格不溢出', async () => {
    const w = mount(SolverPanel, { props: { digits: 4, guesses: [], side: 'red' } })
    await w.find('.solver-toggle').trigger('click')
    await w.vm.$nextTick()
    const cell = w.findAll('.solver-cell')[5 * 4 + 3] // 最右列
    vi.spyOn(cell.element, 'getBoundingClientRect').mockReturnValue({
      left: 1000, right: 1040, top: 700, bottom: 740, width: 40, height: 40, x: 1000, y: 700,
      toJSON: () => ({}),
    } as DOMRect)
    await cell.trigger('click')
    const style = (w.find('.solver-menu').element as HTMLElement).style
    const left = parseFloat(style.left)
    const top = parseFloat(style.top)
    expect(left).toBeLessThanOrEqual(window.innerWidth - 120 - 8 + 0.5) // 不溢出右
    expect(top + 132).toBeLessThanOrEqual(window.innerHeight + 0.5) // 不溢出下（必要时上弹）
    expect(left).toBeGreaterThanOrEqual(8)
    expect(top).toBeGreaterThanOrEqual(8)
  })
})
