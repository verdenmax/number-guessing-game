import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModeSelect from './ModeSelect.vue'

describe('ModeSelect', () => {
  it('初始渲染双人 / 人机两个模式按钮', () => {
    const w = mount(ModeSelect)
    expect(w.find('.mode-pvp').exists()).toBe(true)
    expect(w.find('.mode-pve').exists()).toBe(true)
    expect(w.text()).toContain('双人')
    expect(w.text()).toContain('人机')
  })

  it('点「双人」立即 emit select=pvp（无难度）', async () => {
    const w = mount(ModeSelect)
    await w.find('.mode-pvp').trigger('click')
    expect(w.emitted('select')).toEqual([['pvp']])
  })

  it('点「人机」展开难度，不立即 emit', async () => {
    const w = mount(ModeSelect)
    await w.find('.mode-pve').trigger('click')
    expect(w.find('.difficulty-options').exists()).toBe(true)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('选困难并开始 → emit select=pve,hard', async () => {
    const w = mount(ModeSelect)
    await w.find('.mode-pve').trigger('click')
    const hard = w.findAll('input[type="radio"]').find((r) => (r.element as HTMLInputElement).value === 'hard')!
    await hard.setValue()
    await w.find('.start-pve').trigger('click')
    expect(w.emitted('select')).toEqual([['pve', 'hard']])
  })

  it('默认难度为普通（直接开始 → emit pve,normal）', async () => {
    const w = mount(ModeSelect)
    await w.find('.mode-pve').trigger('click')
    await w.find('.start-pve').trigger('click')
    expect(w.emitted('select')).toEqual([['pve', 'normal']])
  })
})
