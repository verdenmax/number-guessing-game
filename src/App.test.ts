import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

describe('App 整合', () => {
  it('完整一局：双方设置 → 猜测 → 红方获胜', async () => {
    const w = mount(App)
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

  it('再来一局回到设置阶段', async () => {
    const w = mount(App)
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
    expect(w.findComponent(SetupView).exists()).toBe(true)
  })
})
