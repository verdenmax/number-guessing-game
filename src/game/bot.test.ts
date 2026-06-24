import { describe, it, expect } from 'vitest'
import { randomSecret } from './bot'

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
