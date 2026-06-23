import { describe, it, expect } from 'vitest'
import { buildGameRecord, newId } from './record'
import { createGame, setSecret, submitGuess } from '../game/engine'
import type { GameState } from '../game/types'

// 构造一局已结束的对局：p1 猜中 p2 秘密(4 bulls)，p2 没中(0 bulls) → p1 胜
function finishedGame(): GameState {
  let s = createGame({ digits: 4 })
  s = setSecret(s, 'p1', '0123')
  s = setSecret(s, 'p2', '4567') // 双方设好 → playing
  s = submitGuess(s, '4567') // p1 → 命中 p2 秘密，轮到 p2
  s = submitGuess(s, '9999') // p2 → 对 '0123' 得 0 bulls，p1 胜，over
  return s
}

describe('buildGameRecord', () => {
  it('从已结束对局组装记录，字段正确', () => {
    const s = finishedGame()
    const r = buildGameRecord(s, { p1: 'Alice', p2: null }, { id: 'fixed', now: 123 })
    expect(r).toEqual({
      id: 'fixed',
      playedAt: 123,
      digits: 4,
      names: { p1: 'Alice', p2: null },
      secrets: { p1: '0123', p2: '4567' },
      history: {
        p1: [{ guess: '4567', feedback: 4 }],
        p2: [{ guess: '9999', feedback: 0 }],
      },
      outcome: { kind: 'win', winner: 'p1' },
      rounds: 1,
    })
  })

  it('history 为深拷贝，不与原 state 共享引用', () => {
    const s = finishedGame()
    const r = buildGameRecord(s, { p1: null, p2: null })
    expect(r.history.p1).not.toBe(s.history.p1)
    expect(r.history.p1[0]).not.toBe(s.history.p1[0])
  })

  it('非 over 阶段调用抛错', () => {
    const s = createGame({ digits: 4 })
    expect(() => buildGameRecord(s, { p1: null, p2: null })).toThrow()
  })

  it('newId 生成非空且两次不相等', () => {
    expect(newId()).not.toBe('')
    expect(newId()).not.toBe(newId())
  })

  it('平局对局：outcome 为 draw', () => {
    let s = createGame({ digits: 4 })
    s = setSecret(s, 'p1', '0123')
    s = setSecret(s, 'p2', '4567')
    s = submitGuess(s, '4567') // p1 命中 p2(4567)
    s = submitGuess(s, '0123') // p2 命中 p1(0123) → 双中平局 over
    const r = buildGameRecord(s, { p1: null, p2: null }, { id: 'd', now: 1 })
    expect(r.outcome).toEqual({ kind: 'draw' })
    expect(r.rounds).toBe(1)
  })

  it('多回合：rounds 反映回合数', () => {
    let s = createGame({ digits: 4 })
    s = setSecret(s, 'p1', '0123')
    s = setSecret(s, 'p2', '4567')
    s = submitGuess(s, '8888') // 第1回合 p1 对 4567 → 0
    s = submitGuess(s, '8888') // 第1回合 p2 对 0123 → 0 → 进入第2回合
    s = submitGuess(s, '4567') // 第2回合 p1 命中
    s = submitGuess(s, '8888') // 第2回合 p2 未中 → p1 胜 over
    const r = buildGameRecord(s, { p1: null, p2: null }, { id: 'm', now: 1 })
    expect(r.rounds).toBe(2)
    expect(r.outcome).toEqual({ kind: 'win', winner: 'p1' })
  })
})
