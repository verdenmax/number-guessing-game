import { describe, it, expect } from 'vitest'
import { useGame } from './useGame'

describe('useGame', () => {
  it('初始处于 setup', () => {
    expect(useGame().phase.value).toBe('setup')
  })
  it('两次 applySecret 后进入 playing，P1 先手', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.applySecret('p2', '5678')
    expect(g.phase.value).toBe('playing')
    expect(g.current.value).toBe('p1')
  })
  it('applyGuess 推进对局：P1 中 + P2 未中 → P1 胜', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.applySecret('p2', '5678')
    g.applyGuess('5678') // P1 中
    g.applyGuess('0000') // P2 未中 → 回合末结算
    expect(g.phase.value).toBe('over')
    expect(g.outcome.value).toEqual({ kind: 'win', winner: 'p1' })
  })
  it('reset 回到 setup 并清空', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.reset()
    expect(g.phase.value).toBe('setup')
    expect(g.state.value.secrets).toEqual({ p1: null, p2: null })
  })
  it('checkSecret / checkGuess 转发校验', () => {
    const g = useGame()
    expect(g.checkSecret('1224')).toEqual({ ok: false, error: '每位数字必须互不相同' })
    expect(g.checkGuess('0011')).toEqual({ ok: true })
  })
  it('支持自定义位数', () => {
    expect(useGame({ digits: 5 }).config.value.digits).toBe(5)
  })
})
