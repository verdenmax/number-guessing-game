import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import ModeSelect from './components/ModeSelect.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'
import SolverPanel from './components/SolverPanel.vue'
import HistoryView from './components/HistoryView.vue'

describe('App 整合', () => {
  async function selectPvp(w: ReturnType<typeof mount>) {
    w.findComponent(ModeSelect).vm.$emit('select', 'pvp')
    await w.vm.$nextTick()
  }

  it('首屏显示模式选择；选双人进入红方设置', async () => {
    const w = mount(App)
    expect(w.findComponent(ModeSelect).exists()).toBe(true)
    expect(w.findComponent(SetupView).exists()).toBe(false)
    w.findComponent(ModeSelect).vm.$emit('select', 'pvp')
    await w.vm.$nextTick()
    expect(w.findComponent(SetupView).exists()).toBe(true)
  })

  it('完整一局：双方设置 → 猜测 → 红方获胜', async () => {
    const w = mount(App)
    await selectPvp(w)
    expect(w.findComponent(SetupView).exists()).toBe(true)

    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).exists()).toBe(true)

    w.findComponent(PlayView).vm.$emit('guess', '5678') // P1 猜中 P2
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000') // P2 未中 → 结算
    await w.vm.$nextTick()

    expect(w.findComponent(ResultView).exists()).toBe(true)
    expect(w.findComponent(ResultView).text()).toContain('红方获胜')
  })

  it('再来一局回到模式选择', async () => {
    const w = mount(App)
    await selectPvp(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '1234') // 双中 → 平局结束
    await w.vm.$nextTick()
    expect(w.findComponent(ResultView).exists()).toBe(true)

    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    expect(w.findComponent(ModeSelect).exists()).toBe(true) // 回到模式选择
  })

  it('换数字再战回模式选择，选双人后昵称仍预填', async () => {
    const w = mount(App)
    await selectPvp(w)
    const sv = w.findComponent(SetupView)
    sv.vm.$emit('setName', 'p1', '红哥')
    sv.vm.$emit('setName', 'p2', '蓝妹')
    sv.vm.$emit('setSecret', 'p1', '1234')
    sv.vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000')
    await w.vm.$nextTick()
    expect(w.findComponent(ResultView).text()).toContain('红哥')
    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    expect(w.findComponent(ModeSelect).exists()).toBe(true)
    await selectPvp(w) // 再选双人回到设置
    expect(w.findComponent(SetupView).exists()).toBe(true)
    expect((w.find('.name-field input').element as HTMLInputElement).value).toBe('红哥')
  })

  it('playing 阶段渲染左右两个 SolverPanel', async () => {
    const w = mount(App)
    await selectPvp(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    const panels = w.findAllComponents(SolverPanel)
    expect(panels).toHaveLength(2)
    expect(panels[0].props('side')).toBe('red')
    expect(panels[1].props('side')).toBe('blue')
  })

  it('setup 阶段不渲染 SolverPanel', async () => {
    const w = mount(App)
    await selectPvp(w)
    expect(w.findAllComponents(SolverPanel)).toHaveLength(0)
  })

  it('结束阶段不渲染 SolverPanel', async () => {
    const w = mount(App)
    await selectPvp(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '1234') // 双中 → 平局结束
    await w.vm.$nextTick()
    expect(w.findAllComponents(SolverPanel)).toHaveLength(0)
  })

  it('选模式后点历史进入历史视图，返回回到游戏设置', async () => {
    const w = mount(App)
    await selectPvp(w)
    expect(w.findComponent(SetupView).exists()).toBe(true)
    await w.find('.nav-history').trigger('click')
    await w.vm.$nextTick()
    expect(w.findComponent(HistoryView).exists()).toBe(true)
    expect(w.findComponent(SetupView).exists()).toBe(false)
    w.findComponent(HistoryView).vm.$emit('back')
    await w.vm.$nextTick()
    expect(w.findComponent(SetupView).exists()).toBe(true)
  })

  it('App 透传 names 到 PlayView（对局中可用昵称）', async () => {
    const w = mount(App)
    await selectPvp(w)
    const sv = w.findComponent(SetupView)
    sv.vm.$emit('setName', 'p1', '红哥')
    sv.vm.$emit('setName', 'p2', '蓝妹')
    sv.vm.$emit('setSecret', 'p1', '1234')
    sv.vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).props('names')).toEqual({ p1: '红哥', p2: '蓝妹' })
  })
})

describe('App 顶层标题与导航', () => {
  it('主标题为中文 h1，位于 main 内', () => {
    const w = mount(App)
    const h1 = w.find('main h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toBe('猜数字')
  })

  it('历史入口在具名 nav 内', () => {
    const w = mount(App)
    const nav = w.find('nav[aria-label]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('历史')
  })
})
