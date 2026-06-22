import { describe, it, expect } from 'vitest'
import { sideName } from './playerLabels'

describe('sideName', () => {
  it('无 names 参数：回退红/蓝（向后兼容）', () => {
    expect(sideName('p1')).toBe('红方')
    expect(sideName('p2')).toBe('蓝方')
  })

  it('有昵称：返回昵称', () => {
    expect(sideName('p1', { p1: 'Alice', p2: 'Bob' })).toBe('Alice')
    expect(sideName('p2', { p1: 'Alice', p2: 'Bob' })).toBe('Bob')
  })

  it('昵称为 null 或纯空白：回退红/蓝', () => {
    expect(sideName('p1', { p1: null, p2: 'Bob' })).toBe('红方')
    expect(sideName('p2', { p1: 'Alice', p2: '   ' })).toBe('蓝方')
  })
})
