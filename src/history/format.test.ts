import { describe, it, expect } from 'vitest'
import { formatPlayedAt } from './format'

describe('formatPlayedAt', () => {
  it('输出 MM-DD HH:mm 紧凑格式（各段两位补零）', () => {
    // 断言格式形状即可，避免依赖运行时时区
    expect(formatPlayedAt(Date.now())).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('同年：省略年份，补零正确', () => {
    const y = new Date().getFullYear()
    const ms = new Date(y, 2, 5, 9, 7).getTime()
    expect(formatPlayedAt(ms)).toBe('03-05 09:07')
  })

  it('跨年（非当前年）：补上年份', () => {
    const past = new Date().getFullYear() - 1
    const ms = new Date(past, 2, 5, 9, 7).getTime()
    expect(formatPlayedAt(ms)).toBe(`${past}-03-05 09:07`)
  })

  it('非有限 ms（损坏数据）：返回占位符而非 NaN', () => {
    expect(formatPlayedAt(NaN)).toBe('—')
    expect(formatPlayedAt(Infinity)).toBe('—')
  })
})
