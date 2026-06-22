import { describe, it, expect } from 'vitest'
import { feedback, createGame, setSecret, submitGuess } from './engine'

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

describe('setSecret', () => {
  it('P1 设置后仍处于 setup，等待 P2', () => {
    const s = setSecret(createGame(), 'p1', '1234')
    expect(s.phase).toBe('setup')
    expect(s.secrets).toEqual({ p1: '1234', p2: null })
  })
  it('P2 设置后转入 playing，P1 先手，回合 1', () => {
    let s = setSecret(createGame(), 'p1', '1234')
    s = setSecret(s, 'p2', '5678')
    expect(s.phase).toBe('playing')
    expect(s.current).toBe('p1')
    expect(s.round).toBe(1)
    expect(s.secrets).toEqual({ p1: '1234', p2: '5678' })
  })
  it('保留前导 0', () => {
    const s = setSecret(createGame(), 'p1', '0891')
    expect(s.secrets.p1).toBe('0891')
  })
  it('非 setup 阶段调用抛错', () => {
    let s = setSecret(createGame(), 'p1', '1234')
    s = setSecret(s, 'p2', '5678') // 现在是 playing
    expect(() => setSecret(s, 'p1', '4321')).toThrow()
  })
  it('重复设置同一玩家抛错', () => {
    const s = setSecret(createGame(), 'p1', '1234')
    expect(() => setSecret(s, 'p1', '4321')).toThrow()
  })
  it('非法秘密数抛错', () => {
    expect(() => setSecret(createGame(), 'p1', '1224')).toThrow()
  })
  it('不修改原状态（不可变）', () => {
    const s0 = createGame()
    setSecret(s0, 'p1', '1234')
    expect(s0.secrets.p1).toBeNull()
  })
})

function startPlaying() {
  let s = createGame()
  s = setSecret(s, 'p1', '1234')
  s = setSecret(s, 'p2', '5678')
  return s
}

describe('submitGuess', () => {
  it('P1 猜后轮到 P2，本回合未结算', () => {
    const s = submitGuess(startPlaying(), '0000') // 猜 P2 的 5678，未中
    expect(s.current).toBe('p2')
    expect(s.phase).toBe('playing')
    expect(s.history.p1).toHaveLength(1)
    expect(s.history.p1[0]).toEqual({ guess: '0000', feedback: 0 })
    expect(s.pendingHits.p1).toBe(false)
  })

  it('记录正确的 feedback 值', () => {
    const s = submitGuess(startPlaying(), '5000') // 对 5678：位置1的5✓ → 1
    expect(s.history.p1[0].feedback).toBe(1)
  })

  it('一整回合都没中 → 进入下一回合、P1 先手、pendingHits 重置', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000') // P1 猜 P2，未中
    s = submitGuess(s, '0000') // P2 猜 P1，未中 → 回合末
    expect(s.phase).toBe('playing')
    expect(s.round).toBe(2)
    expect(s.current).toBe('p1')
    expect(s.pendingHits).toEqual({ p1: false, p2: false })
  })

  it('仅 P1 猜中 → P1 胜（回合末结算，P2 同回合也猜过）', () => {
    let s = startPlaying()
    s = submitGuess(s, '5678') // P1 猜中 P2 的数
    expect(s.current).toBe('p2') // 不立即结束
    expect(s.phase).toBe('playing')
    s = submitGuess(s, '0000') // P2 猜 P1，未中 → 回合末结算
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'win', winner: 'p1' })
  })

  it('仅 P2 猜中 → P2 胜', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000') // P1 未中
    s = submitGuess(s, '1234') // P2 猜中 P1 的数 → 回合末
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'win', winner: 'p2' })
  })

  it('双方同回合都猜中 → 平局', () => {
    let s = startPlaying()
    s = submitGuess(s, '5678') // P1 中
    s = submitGuess(s, '1234') // P2 也中 → 回合末
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'draw' })
  })

  it('历史跨回合正确累积', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000')
    s = submitGuess(s, '0000')
    s = submitGuess(s, '1000')
    s = submitGuess(s, '2000')
    expect(s.history.p1).toHaveLength(2)
    expect(s.history.p2).toHaveLength(2)
  })

  it('非 playing 阶段调用抛错', () => {
    expect(() => submitGuess(createGame(), '1234')).toThrow()
  })

  it('非法猜测抛错', () => {
    expect(() => submitGuess(startPlaying(), '12')).toThrow()
  })

  it('不修改原状态（不可变）', () => {
    const s0 = startPlaying()
    submitGuess(s0, '5678')
    expect(s0.history.p1).toHaveLength(0)
    expect(s0.current).toBe('p1')
  })
})
