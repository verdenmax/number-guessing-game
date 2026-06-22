import { describe, it, expect } from 'vitest'
import { enumerateCandidates, filterByFacts } from './solver'
import type { GuessRecord } from './types'

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

describe('filterByFacts', () => {
  it('无猜测时返回全部候选', () => {
    const all = enumerateCandidates(4)
    expect(filterByFacts(all, [])).toHaveLength(5040)
  })

  it('猜测 0000 正确数目 0 → 排除任何含 0 的候选', () => {
    const all = enumerateCandidates(4)
    const facts: GuessRecord[] = [{ guess: '0000', feedback: 0 }]
    const filtered = filterByFacts(all, facts)
    expect(filtered.every((c) => !c.includes('0'))).toBe(true)
    expect(filtered.length).toBeGreaterThan(0)
  })

  it('真实秘密数始终保留在候选集中', () => {
    const secret = '1234'
    const all = enumerateCandidates(4)
    const facts: GuessRecord[] = [
      { guess: '1200', feedback: 2 },
      { guess: '5634', feedback: 2 },
      { guess: '1239', feedback: 3 },
    ]
    const filtered = filterByFacts(all, facts)
    expect(filtered).toContain(secret)
  })

  it('与正确数目矛盾的候选被滤除', () => {
    const all = enumerateCandidates(4)
    // 猜 1234 得 4（完全猜中）→ 候选集只剩 1234
    const filtered = filterByFacts(all, [{ guess: '1234', feedback: 4 }])
    expect(filtered).toEqual(['1234'])
  })

  it('多条事实取交集', () => {
    const all = enumerateCandidates(4)
    const filtered = filterByFacts(all, [
      { guess: '1234', feedback: 2 },
      { guess: '1256', feedback: 2 },
    ])
    // 所有保留候选必须同时满足两条
    for (const c of filtered) {
      let m1 = 0
      for (let i = 0; i < 4; i++) if (c[i] === '1234'[i]) m1++
      let m2 = 0
      for (let i = 0; i < 4; i++) if (c[i] === '1256'[i]) m2++
      expect(m1).toBe(2)
      expect(m2).toBe(2)
    }
  })
})
