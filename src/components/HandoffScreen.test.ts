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
})
