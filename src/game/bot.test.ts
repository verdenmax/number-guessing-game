import { describe, it, expect } from 'vitest'
import { botGuess, randomSecret } from './bot'
import { enumerateCandidates, filterByFacts } from './solver'
import { feedback } from './engine'

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

describe('botGuess 困难档', () => {
  // 给定候选集 C，返回猜 x 时的最坏剩余桶大小
  function worstBucket(C: string[], x: string): number {
    const m = new Map<number, number>()
    let w = 0
    for (const s of C) {
      const f = feedback(s, x)
      const n = (m.get(f) ?? 0) + 1
      m.set(f, n)
      if (n > w) w = n
    }
    return w
  }

  // 候选集 C 中所有「最坏剩余最小」的等优猜测（minimax 的全部合法解）
  function optimalGuesses(C: string[]): string[] {
    let best = Infinity
    for (const g of C) best = Math.min(best, worstBucket(C, g))
    return C.filter((g) => worstBucket(C, g) === best)
  }

  it('hard：返回「最坏剩余最小」的等优猜测之一（rnd=0 取等优集首个）', () => {
    const guesses = [
      { guess: '0123', feedback: 2 },
      { guess: '4567', feedback: 1 },
    ]
    const C = filterByFacts(enumerateCandidates(4), guesses)
    expect(C.length).toBeLessThanOrEqual(150) // |C|=60，走 minimax
    const opt = optimalGuesses(C)
    const g = botGuess(guesses, 4, 'hard', () => 0)
    expect(opt).toContain(g) // 必是最优解之一（不损推理强度）
    expect(g).toBe(opt[0]) // rnd=0 → 等优集首个（确定锚点）
    const gw = worstBucket(C, g)
    for (const c of C) expect(gw).toBeLessThanOrEqual(worstBucket(C, c)) // 确属 argmin
  })

  it('hard：minimax 在多个等优解间随机（不再恒取字典序最小 → 消除残局小数偏置）', () => {
    const guesses = [
      { guess: '0123', feedback: 2 },
      { guess: '4567', feedback: 1 },
    ]
    const C = filterByFacts(enumerateCandidates(4), guesses)
    const opt = optimalGuesses(C)
    expect(opt.length).toBeGreaterThan(1) // 前置：确实存在平局（本例 24 个）
    // 注入多个确定性 rnd 值跨等优集采样（不依赖真实随机，单测无抖动）
    const picks = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((v) => botGuess(guesses, 4, 'hard', () => v)))
    expect(picks.size).toBeGreaterThan(1) // 不再恒为同一手（旧实现恒取 opt[0]）
    for (const g of picks) expect(opt).toContain(g) // 但每一手都最优
    expect([...picks].some((g) => g !== opt[0])).toBe(true) // 确实会选非字典序最小的最优解
  })

  it('hard：随机性仅经 rnd 注入 → 固定 rnd 可复现', () => {
    const guesses = [
      { guess: '0123', feedback: 2 },
      { guess: '4567', feedback: 1 },
    ]
    expect(botGuess(guesses, 4, 'hard', () => 0.5)).toBe(botGuess(guesses, 4, 'hard', () => 0.5))
  })

  it('hard：大数与小数秘密的平均猜中次数相近（修复「大数很晚才被猜中」的偏置）', () => {
    // 确定性 RNG（mulberry32）→ 平均值可复现、不抖动
    function mulberry32(seed: number): () => number {
      let a = seed
      return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    // 模拟一整局困难档 bot：直到 4 bulls，返回猜测次数
    function playHard(secret: string, rnd: () => number): number {
      const h: { guess: string; feedback: number }[] = []
      for (let n = 1; n <= 50; n++) {
        const g = botGuess(h, 4, 'hard', rnd)
        const fb = feedback(secret, g)
        h.push({ guess: g, feedback: fb })
        if (fb === 4) return n
      }
      return 99
    }
    function avgGuesses(secrets: string[]): number {
      let total = 0
      let runs = 0
      for (let seed = 1; seed <= 30; seed++) {
        for (const s of secrets) {
          total += playHard(s, mulberry32(seed * 7919 + Number(s)))
          runs++
        }
      }
      return total / runs
    }
    const low = avgGuesses(['0123', '0142', '0231', '1024', '1203'])
    const high = avgGuesses(['9876', '9857', '9768', '8975', '8796'])
    // 修复前确定性偏置：小数约 3.8、大数约 10.2（差距约 6.4）；公平后残差约 0.02（有限样本噪声）。
    // 阈值 1.0 取在两者之间——远大于残差、远小于旧差距，既稳健不抖动又能抓住偏置回归。
    expect(Math.abs(low - high)).toBeLessThan(1.0)
  })

  it('hard：候选过多(>150)时按 rnd 从候选随机取（与 normal 同款无偏选择，避免卡顿）', () => {
    const cands = enumerateCandidates(4) // 空历史 → C = 全部 5040
    expect(botGuess([], 4, 'hard', () => 0)).toBe(cands[0]) // rnd=0 → 候选首个
    // rnd 偏大 → 取候选末段，证明不再恒取 C[0]（消除小数偏置）
    expect(botGuess([], 4, 'hard', () => 0.999)).toBe(cands[Math.floor(0.999 * cands.length)])
  })

  it('hard：开局不再永远是 0123（消除小数偏置，避免大数总是很晚才被猜中）', () => {
    // 注入多个确定性 rnd 值开局：旧实现恒取 C[0] 只会得到 '0123' 一种
    const cands = enumerateCandidates(4)
    const picks = new Set([0, 0.3, 0.6, 0.9, 0.999].map((v) => botGuess([], 4, 'hard', () => v)))
    expect(picks.size).toBeGreaterThan(1) // 开局会变化，不再恒为 '0123'
    expect(picks.has('0123')).toBe(true) // rnd=0 → '0123'：仍可取到最小，只是不再唯一
    expect([...picks].some((g) => g !== '0123')).toBe(true) // 确实存在非 0123 开局
    for (const g of picks) expect(cands).toContain(g) // 每个开局都是合法互异候选（保持推理强度）
  })

  it('hard：候选仍多(>150)的非开局回合同样无小数偏置（不恒取最小候选）', () => {
    const guesses = [{ guess: '0123', feedback: 1 }] // 收窄后 |C| 仍 > 150
    const cands = filterByFacts(enumerateCandidates(4), guesses)
    expect(cands.length).toBeGreaterThan(150) // 前置：确实走 >150 回退分支
    expect(botGuess(guesses, 4, 'hard', () => 0)).toBe(cands[0])
    expect(botGuess(guesses, 4, 'hard', () => 0.999)).toBe(cands[Math.floor(0.999 * cands.length)])
  })

  it('hard：候选为空时回退合法随机猜', () => {
    const guesses = [
      { guess: '0123', feedback: 4 },
      { guess: '4567', feedback: 4 },
    ] // 互斥 → 候选空
    const g = botGuess(guesses, 4, 'hard', seq([0, 0, 0, 0]))
    expect(g).toHaveLength(4)
  })
})
