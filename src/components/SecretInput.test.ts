import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SecretInput from './SecretInput.vue'
import type { ValidationResult } from '../game/types'

const len4 = (v: string): ValidationResult =>
  v.length === 4 ? { ok: true } : { ok: false, error: '请输入 4 位数字' }

describe('SecretInput', () => {
  it('过滤非数字字符并同步回 DOM', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    await input.setValue('1a2b')
    expect((input.element as HTMLInputElement).value).toBe('12')
  })

  it('截断到 digits 长度', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    await input.setValue('123456')
    expect((input.element as HTMLInputElement).value).toBe('1234')
  })

  it('非法时确认按钮禁用、合法时启用', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    const btn = w.find('button.confirm')
    await input.setValue('12')
    expect(btn.attributes('disabled')).toBeDefined()
    await input.setValue('1234')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('确认后 emit confirm 并清空输入', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    await input.setValue('1234')
    await w.find('button.confirm').trigger('click')
    expect(w.emitted('confirm')).toEqual([['1234']])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('非法时按 Enter 不提交', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    await input.setValue('12')
    await input.trigger('keyup.enter')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('显示/隐藏切换 input type', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    expect(input.attributes('type')).toBe('password')
    await w.find('button.toggle').trigger('click')
    expect(input.attributes('type')).toBe('text')
  })

  it('连续输入时第二次非法字符也被擦除（ref 未变化的回归场景）', async () => {
    const w = mount(SecretInput, { props: { digits: 4, label: '设置', validate: len4 } })
    const input = w.find('input')
    await input.setValue('12')
    await input.setValue('12a') // 清理后为 '12'，等于当前 ref，不会触发响应式 patch
    expect((input.element as HTMLInputElement).value).toBe('12')
  })
})
