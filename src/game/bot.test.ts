import { describe, it, expect } from 'vitest'
import { botGuess, randomSecret } from './bot'
import { enumerateCandidates, filterByFacts } from './solver'

// 返回固定序列的确定性 rnd（循环复用）
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('randomSecret', () => {
  it('长度=digits、每位 0-9、互不相同', () => {
    for (let t = 0; t < 50; t++) {
      const s = randomSecret(4)
      expect(s).toHaveLength(4)
      expect(new Set(s).size).toBe(4)
      expect(/^[0-9]{4}$/.test(s)).toBe(true)
    }
  })

  it('digits=10 时是 0-9 的一个排列', () => {
    const s = randomSecret(10)
    expect(s).toHaveLength(10)
    expect([...s].sort().join('')).toBe('0123456789')
  })

  it('确定性：相同 rnd 序列 → 相同输出', () => {
    const r = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    expect(randomSecret(4, seq(r))).toBe(randomSecret(4, seq(r)))
  })

  it('固定 rnd 序列 → 固定输出（证明输出确由 rnd 决定）', () => {
    const r = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    expect(randomSecret(4, seq(r))).toBe('0846')
  })

  it('多次调用产生多种结果（确实随机，能杀死常量实现）', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomSecret(4)))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('botGuess 简单档', () => {
  it('easy：digits 位、字符合法（允许重复），忽略候选', () => {
    const g = botGuess([], 4, 'easy', seq([0.05, 0.15, 0.25, 0.35]))
    expect(g).toBe('0123') // floor([0.05,0.15,0.25,0.35]*10) = 0,1,2,3
    expect(/^[0-9]{4}$/.test(g)).toBe(true)
  })

  it('easy：确定性，相同 rnd → 相同输出', () => {
    const r = [0.1, 0.2, 0.3, 0.4]
    expect(botGuess([], 4, 'easy', seq(r))).toBe(botGuess([], 4, 'easy', seq(r)))
  })

  it('easy：即使存在候选约束也忽略它（可产出重复数字的非候选）', () => {
    const guesses = [{ guess: '0123', feedback: 1 }] // 存在约束
    const g = botGuess(guesses, 4, 'easy', seq([0, 0, 0, 0]))
    expect(g).toBe('0000')
    // '0000' 含重复数字，绝不在 distinct 候选集中 → 证明 easy 绕过候选过滤
    expect(filterByFacts(enumerateCandidates(4), guesses)).not.toContain('0000')
  })
})

describe('botGuess 普通档', () => {
  it('normal：从候选集中选（rnd=0 取候选首个）', () => {
    const guesses = [{ guess: '0123', feedback: 1 }]
    const cands = filterByFacts(enumerateCandidates(4), guesses)
    const g = botGuess(guesses, 4, 'normal', () => 0)
    expect(g).toBe(cands[0])
    expect(cands).toContain(g)
  })

  it('normal：所选猜测一定与历史反馈自洽（属于候选集）', () => {
    const guesses = [{ guess: '0123', feedback: 0 }] // 0,1,2,3 不在各自位置
    const cands = filterByFacts(enumerateCandidates(4), guesses)
    const g = botGuess(guesses, 4, 'normal', () => 0.999)
    expect(cands).toContain(g)
  })

  it('normal：候选为空（历史自相矛盾）时回退合法随机猜', () => {
    const guesses = [
      { guess: '0123', feedback: 4 }, // 秘密必为 0123
      { guess: '0123', feedback: 0 }, // 又说全不对 → 矛盾，候选空
    ]
    expect(filterByFacts(enumerateCandidates(4), guesses)).toHaveLength(0) // 前置：确实矛盾
    const g = botGuess(guesses, 4, 'normal', seq([0, 0, 0, 0]))
    expect(g).toBe('0000') // 固定回退输出（重复数字，绝不可能来自 distinct 候选路径）
    expect(/^[0-9]{4}$/.test(g)).toBe(true)
  })
})
