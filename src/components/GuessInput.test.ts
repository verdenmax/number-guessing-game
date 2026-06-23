import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GuessInput from './GuessInput.vue'
import type { ValidationResult } from '../game/types'

const len4 = (v: string): ValidationResult =>
  v.length === 4 ? { ok: true } : { ok: false, error: '请输入 4 位数字' }

describe('GuessInput', () => {
  it('过滤非数字字符并同步回 DOM', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('1a2b')
    expect((input.element as HTMLInputElement).value).toBe('12')
  })

  it('连续输入时第二次非法字符也被擦除（ref 未变化的回归场景）', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('12')
    await input.setValue('12a')
    expect((input.element as HTMLInputElement).value).toBe('12')
  })

  it('截断到 digits 长度', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('123456')
    expect((input.element as HTMLInputElement).value).toBe('1234')
  })

  it('允许重复数字并可提交', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('0011')
    await w.find('form.guess-input').trigger('submit')
    expect(w.emitted('confirm')).toEqual([['0011']])
  })

  it('非法时按钮禁用且 Enter 不提交', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('12')
    expect(w.find('button.confirm').attributes('disabled')).toBeDefined()
    await w.find('form.guess-input').trigger('submit')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('确认后 emit 并清空', async () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '猜', validate: len4 } })
    const input = w.find('input')
    await input.setValue('1234')
    await w.find('form.guess-input').trigger('submit')
    expect(w.emitted('confirm')).toEqual([['1234']])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('label 与 input 关联（for/id）', () => {
    const w = mount(GuessInput, { props: { digits: 4, label: '红方输入', validate: len4 } })
    const id = w.find('input').attributes('id')
    expect(id).toBeTruthy()
    expect(w.find('label.label').attributes('for')).toBe(id)
    expect(w.find('form.guess-input').exists()).toBe(true)
  })
})
