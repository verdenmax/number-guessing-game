import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

describe('useInteractionMode', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules() // 让模块级单例随每个用例重新初始化
  })

  it('默认 menu（localStorage 空时）', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('menu')
  })

  it('启动时从 localStorage 读取已存偏好', async () => {
    localStorage.setItem('ngg:solver-interaction', 'gesture')
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('gesture')
  })

  it('非法存值回退 menu', async () => {
    localStorage.setItem('ngg:solver-interaction', 'xyz')
    const { useInteractionMode } = await import('./useInteractionMode')
    expect(useInteractionMode().value).toBe('menu')
  })

  it('切换后写入 localStorage', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    const mode = useInteractionMode()
    mode.value = 'gesture'
    await nextTick()
    expect(localStorage.getItem('ngg:solver-interaction')).toBe('gesture')
  })

  it('两次调用返回同一共享 ref（全局同步）', async () => {
    const { useInteractionMode } = await import('./useInteractionMode')
    const a = useInteractionMode()
    const b = useInteractionMode()
    a.value = 'gesture'
    expect(b.value).toBe('gesture')
    expect(a).toBe(b)
  })

  it('localStorage 抛错时不崩（隐私模式降级）', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { useInteractionMode } = await import('./useInteractionMode')
    const mode = useInteractionMode()
    expect(() => {
      mode.value = 'gesture'
    }).not.toThrow()
    await nextTick()
    expect(mode.value).toBe('gesture') // 内存仍生效
    spy.mockRestore()
  })
})
