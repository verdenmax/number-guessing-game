import { describe, it, expect } from 'vitest'
import { formatPlayedAt } from './format'

describe('formatPlayedAt', () => {
  it('输出 MM-DD HH:mm 紧凑格式（各段两位补零）', () => {
    // 断言格式形状即可，避免依赖运行时时区
    expect(formatPlayedAt(Date.now())).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('对具体时间补零正确', () => {
    // 构造本地时间 2026-03-05 09:07，按本地时区格式化后形状与补零正确
    const ms = new Date(2026, 2, 5, 9, 7).getTime()
    expect(formatPlayedAt(ms)).toBe('03-05 09:07')
  })
})
