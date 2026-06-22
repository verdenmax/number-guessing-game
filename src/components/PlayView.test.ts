import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayView from './PlayView.vue'
import HandoffScreen from './HandoffScreen.vue'
import GuessInput from './GuessInput.vue'
import type { ValidationResult } from '../game/types'

const okValidate = (): ValidationResult => ({ ok: true })
const baseProps = {
  digits: 4,
  current: 'p1' as const,
  round: 1,
  validate: okValidate,
  history: { p1: [], p2: [] },
}

describe('PlayView', () => {
  it('先显示交接屏，确认后显示猜测输入', async () => {
    const w = mount(PlayView, { props: baseProps })
    expect(w.findComponent(HandoffScreen).exists()).toBe(true)
    expect(w.findComponent(GuessInput).exists()).toBe(false)
    w.findComponent(HandoffScreen).vm.$emit('continue')
    await w.vm.$nextTick()
    expect(w.findComponent(GuessInput).exists()).toBe(true)
  })

  it('提交猜测后 emit guess 并回到交接屏', async () => {
    const w = mount(PlayView, { props: baseProps })
    w.findComponent(HandoffScreen).vm.$emit('continue')
    await w.vm.$nextTick()
    w.findComponent(GuessInput).vm.$emit('confirm', '5678')
    await w.vm.$nextTick()
    expect(w.emitted('guess')).toEqual([['5678']])
    expect(w.findComponent(HandoffScreen).exists()).toBe(true)
  })
})
