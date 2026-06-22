import { describe, it, expect } from 'vitest'
import { enumerateCandidates } from './solver'

describe('enumerateCandidates', () => {
  it('digits=1 返回 0-9 共 10 个', () => {
    expect(enumerateCandidates(1)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('digits=4 返回 5040 个（10*9*8*7）', () => {
    expect(enumerateCandidates(4)).toHaveLength(5040)
  })

  it('每个候选长度为 digits 且各位互不相同', () => {
    for (const c of enumerateCandidates(4)) {
      expect(c).toHaveLength(4)
      expect(new Set(c).size).toBe(4)
    }
  })

  it('全部候选唯一且只含数字字符', () => {
    const all = enumerateCandidates(3)
    expect(new Set(all).size).toBe(all.length)
    expect(all.every((c) => /^[0-9]+$/.test(c))).toBe(true)
  })

  it('digits=2 返回 90 个（10*9）', () => {
    expect(enumerateCandidates(2)).toHaveLength(90)
  })
})
