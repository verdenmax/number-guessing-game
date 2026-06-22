import { describe, it, expect } from 'vitest'
import { feedback } from './engine'

describe('feedback', () => {
  it('全部位置正确返回位数', () => {
    expect(feedback('1234', '1234')).toBe(4)
  })

  it('全部位置错误返回 0（数字相同但顺序全乱）', () => {
    expect(feedback('1234', '4321')).toBe(0)
  })

  it('部分位置正确：0891 vs 0290 → 2', () => {
    expect(feedback('0891', '0290')).toBe(2)
  })

  it('猜测含重复数字时仅按位置计数：1234 vs 1111 → 1', () => {
    expect(feedback('1234', '1111')).toBe(1)
  })

  it('前导 0 正确处理：0123 vs 0999 → 1', () => {
    expect(feedback('0123', '0999')).toBe(1)
  })

  it('单位数 N=1', () => {
    expect(feedback('5', '5')).toBe(1)
    expect(feedback('5', '3')).toBe(0)
  })

  it('十位数 N=10 全对', () => {
    expect(feedback('0123456789', '0123456789')).toBe(10)
  })
})
