import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayView from './PlayView.vue'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import type { GuessRecord, ValidationResult } from '../game/types'

const okValidate = (): ValidationResult => ({ ok: true })
const baseProps = {
  digits: 4,
  current: 'p1' as const,
  validate: okValidate,
  history: {
    p1: [{ guess: '1234', feedback: 1 }] as GuessRecord[],
    p2: [] as GuessRecord[],
  },
}

describe('PlayView', () => {
  it('直接显示猜测输入，无交接屏', () => {
    const w = mount(PlayView, { props: baseProps })
    expect(w.findComponent(GuessInput).exists()).toBe(true)
  })

  it('常驻显示红、蓝两个历史列表', () => {
    const w = mount(PlayView, { props: baseProps })
    const lists = w.findAllComponents(HistoryList)
    expect(lists).toHaveLength(2)
    expect(lists[0].props('title')).toBe('红方')
    expect(lists[1].props('title')).toBe('蓝方')
  })

  it('红方回合：GuessInput 的 label 含红方', () => {
    const w = mount(PlayView, { props: baseProps })
    expect(w.findComponent(GuessInput).props('label')).toContain('红方')
  })

  it('蓝方回合：GuessInput 的 label 含蓝方', () => {
    const w = mount(PlayView, { props: { ...baseProps, current: 'p2' as const } })
    expect(w.findComponent(GuessInput).props('label')).toContain('蓝方')
  })

  it('提交猜测后 emit guess', async () => {
    const w = mount(PlayView, { props: baseProps })
    w.findComponent(GuessInput).vm.$emit('confirm', '5678')
    await w.vm.$nextTick()
    expect(w.emitted('guess')).toEqual([['5678']])
  })

  it('显示双方已有猜测记录', () => {
    const w = mount(PlayView, { props: baseProps })
    expect(w.text()).toContain('1234')
  })

  it('最新猜测进入 aria-live 状态区（读屏可闻）', () => {
    const history = { p1: [{ guess: '1234', feedback: 2 }], p2: [] }
    const w = mount(PlayView, { props: { digits: 4, current: 'p2', validate: okValidate, history } })
    const status = w.find('[role="status"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toContain('1234')
    expect(status.text()).toContain('正确数目 2')
  })

  it('猜测记录区有可访问标题 h2', () => {
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history: { p1: [], p2: [] } } })
    expect(w.find('.histories h2').exists()).toBe(true)
  })

  it('双方等长时播报后手(蓝方)的最新一手', () => {
    const history = { p1: [{ guess: '1111', feedback: 1 }], p2: [{ guess: '2222', feedback: 3 }] }
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history } })
    const status = w.find('[role="status"]').text()
    expect(status).toContain('蓝方')
    expect(status).toContain('2222')
    expect(status).toContain('正确数目 3')
    expect(status).not.toContain('1111')
  })

  it('对局中显示昵称（轮次标签/历史标题/播报）', () => {
    const history = { p1: [{ guess: '1234', feedback: 2 }], p2: [] }
    const names = { p1: 'Alice', p2: 'Bob' }
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history, names } })
    expect(w.text()).toContain('Alice') // 轮次标签 + p1 历史标题
    expect(w.text()).toContain('Bob') // p2 历史标题
    expect(w.text()).not.toContain('红方') // 已被昵称替代
    expect(w.text()).not.toContain('蓝方')
    // 读屏播报区单独断言用昵称
    expect(w.find('[role="status"]').text()).toContain('Alice 猜 1234')
  })

  it('不传 names 时回退红/蓝方', () => {
    const w = mount(PlayView, { props: { digits: 4, current: 'p1', validate: okValidate, history: { p1: [], p2: [] } } })
    expect(w.text()).toContain('红方')
    expect(w.text()).toContain('蓝方')
  })

  it('botTurn：隐藏玩家输入，显示「电脑思考中」', () => {
    const w = mount(PlayView, { props: { ...baseProps, current: 'p2' as const, botTurn: true } })
    expect(w.findComponent(GuessInput).exists()).toBe(false)
    expect(w.find('.bot-thinking').exists()).toBe(true)
    expect(w.find('.bot-thinking').text()).toContain('电脑思考中')
  })

  it('非 botTurn：照常显示玩家输入', () => {
    const w = mount(PlayView, { props: { ...baseProps, botTurn: false } })
    expect(w.findComponent(GuessInput).exists()).toBe(true)
    expect(w.find('.bot-thinking').exists()).toBe(false)
  })

  it('botTurn：思考提示的 emoji 对读屏隐藏（纯视觉，不读出表情符号）', () => {
    const w = mount(PlayView, { props: { ...baseProps, current: 'p2' as const, botTurn: true } })
    expect(w.find('.bot-thinking [aria-hidden="true"]').exists()).toBe(true)
  })
})
