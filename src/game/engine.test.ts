import { describe, it, expect } from 'vitest'
import { feedback, createGame } from './engine'

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

describe('createGame', () => {
  it('默认位数为 4', () => {
    expect(createGame().config.digits).toBe(4)
  })
  it('可自定义位数', () => {
    expect(createGame({ digits: 6 }).config.digits).toBe(6)
  })
  it('初始状态正确', () => {
    const s = createGame()
    expect(s.phase).toBe('setup')
    expect(s.current).toBe('p1')
    expect(s.round).toBe(1)
    expect(s.secrets).toEqual({ p1: null, p2: null })
    expect(s.history).toEqual({ p1: [], p2: [] })
    expect(s.pendingHits).toEqual({ p1: false, p2: false })
    expect(s.outcome).toEqual({ kind: 'ongoing' })
  })
  it('位数为 0 抛错', () => {
    expect(() => createGame({ digits: 0 })).toThrow()
  })
  it('位数为 11 抛错', () => {
    expect(() => createGame({ digits: 11 })).toThrow()
  })
  it('位数非整数抛错', () => {
    expect(() => createGame({ digits: 3.5 })).toThrow()
  })
})
