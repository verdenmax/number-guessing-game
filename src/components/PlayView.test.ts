import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import PlayView from './PlayView.vue'
import HandoffScreen from './HandoffScreen.vue'
import GuessInput from './GuessInput.vue'
import type { GuessRecord, ValidationResult } from '../game/types'

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

  it('猜测后交接屏命名下一个玩家（current 同步翻转，无闪烁）', async () => {
    const Parent = defineComponent({
      components: { PlayView },
      setup() {
        const current = ref<'p1' | 'p2'>('p1')
        const history: { p1: GuessRecord[]; p2: GuessRecord[] } = { p1: [], p2: [] }
        const validate: (v: string) => ValidationResult = () => ({ ok: true })
        const onGuess = () => {
          current.value = current.value === 'p1' ? 'p2' : 'p1'
        }
        return { current, history, validate, onGuess }
      },
      template: `<PlayView :digits="4" :current="current" :round="1" :validate="validate" :history="history" @guess="onGuess" />`,
    })

    const w = mount(Parent)
    // 初始交接屏命名玩家1
    expect(w.findComponent(HandoffScreen).props('message')).toContain('玩家1')
    w.findComponent(HandoffScreen).vm.$emit('continue')
    await nextTick()
    // 玩家1 猜测 → 父翻转 current 到 p2
    w.findComponent(GuessInput).vm.$emit('confirm', '5678')
    await nextTick()
    // 交接屏重新出现，且命名玩家2；不应闪现玩家2 的 GuessInput
    expect(w.findComponent(HandoffScreen).exists()).toBe(true)
    expect(w.findComponent(HandoffScreen).props('message')).toContain('玩家2')
    expect(w.findComponent(GuessInput).exists()).toBe(false)
  })
})
