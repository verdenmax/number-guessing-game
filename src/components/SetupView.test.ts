import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupView from './SetupView.vue'
import HandoffScreen from './HandoffScreen.vue'
import SecretInput from './SecretInput.vue'
import type { ValidationResult } from '../game/types'

const okValidate = (): ValidationResult => ({ ok: true })

describe('SetupView', () => {
  it('P1 确认后进入交接屏，再进入 P2 输入；依次 emit setSecret', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })

    // 初始：P1 输入
    expect(wrapper.findComponent(SecretInput).exists()).toBe(true)
    expect(wrapper.findComponent(HandoffScreen).exists()).toBe(false)

    // P1 确认
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(HandoffScreen).exists()).toBe(true)

    // 交接 → P2 输入
    wrapper.findComponent(HandoffScreen).vm.$emit('continue')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(SecretInput).exists()).toBe(true)

    // P2 确认
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '5678')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('setSecret')
    expect(events).toEqual([['p1', '1234'], ['p2', '5678']])
  })

  it('两步分别填昵称后，依次 emit setName', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })

    await wrapper.find('.name-field input').setValue('Alice')
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()

    wrapper.findComponent(HandoffScreen).vm.$emit('continue')
    await wrapper.vm.$nextTick()

    await wrapper.find('.name-field input').setValue('Bob')
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '5678')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('setName')).toEqual([
      ['p1', 'Alice'],
      ['p2', 'Bob'],
    ])
  })

  it('昵称留空时 emit 空串（由上层归一为 null）', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('setName')![0]).toEqual(['p1', ''])
  })
})
