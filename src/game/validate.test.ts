import { describe, it, expect } from 'vitest'
import { validateSecret, validateGuess } from './validate'
import type { GameConfig } from './types'

const cfg: GameConfig = { digits: 4 }

describe('validateSecret', () => {
  it('合法的互不相同 4 位数', () => {
    expect(validateSecret('1234', cfg)).toEqual({ ok: true })
  })
  it('前导 0 合法', () => {
    expect(validateSecret('0891', cfg)).toEqual({ ok: true })
  })
  it('长度不符报错', () => {
    expect(validateSecret('123', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('空串报长度错', () => {
    expect(validateSecret('', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('含非数字字符报错', () => {
    expect(validateSecret('12a4', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('有重复数字报错', () => {
    expect(validateSecret('1224', cfg)).toEqual({ ok: false, error: '每位数字必须互不相同' })
  })
  it('全角数字被拒（不在 0-9）', () => {
    expect(validateSecret('１２３４', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('含符号被拒', () => {
    expect(validateSecret('12+4', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('过长被拒（长度先于字符检查）', () => {
    expect(validateSecret('12345', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('参数化位数 digits=6', () => {
    const cfg6: GameConfig = { digits: 6 }
    expect(validateSecret('123456', cfg6)).toEqual({ ok: true })
    expect(validateSecret('1234', cfg6)).toEqual({ ok: false, error: '请输入 6 位数字' })
  })
})

describe('validateGuess', () => {
  it('合法猜测', () => {
    expect(validateGuess('0290', cfg)).toEqual({ ok: true })
  })
  it('允许重复数字', () => {
    expect(validateGuess('0011', cfg)).toEqual({ ok: true })
  })
  it('长度不符报错', () => {
    expect(validateGuess('029', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('含非数字字符报错', () => {
    expect(validateGuess('02a0', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('含空格被拒', () => {
    expect(validateGuess('12 4', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('参数化位数 digits=6 允许重复', () => {
    const cfg6: GameConfig = { digits: 6 }
    expect(validateGuess('001122', cfg6)).toEqual({ ok: true })
  })
})
