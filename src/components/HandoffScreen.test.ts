import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HandoffScreen from './HandoffScreen.vue'

describe('HandoffScreen', () => {
  it('挂载时聚焦继续按钮', () => {
    const w = mount(HandoffScreen, { attachTo: document.body, props: { message: '交给蓝方' } })
    expect(document.activeElement).toBe(w.find('button').element)
    w.unmount()
  })

  it('点击继续 emit continue', async () => {
    const w = mount(HandoffScreen, { props: { message: '交给蓝方' } })
    await w.find('button').trigger('click')
    expect(w.emitted('continue')).toBeTruthy()
  })

  it('继续按钮 aria-describedby 关联提示信息（聚焦时一并播报）', () => {
    const w = mount(HandoffScreen, { props: { message: '请把电脑交给蓝方' } })
    const id = w.find('button').attributes('aria-describedby')
    expect(id).toBeTruthy()
    expect(w.find('p.message').attributes('id')).toBe(id)
  })
})
