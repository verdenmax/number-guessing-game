import { describe, it, expect } from 'vitest'
import { enumerateCandidates, filterByFacts, solve } from './solver'
import type { GuessRecord } from './types'
import type { SolverInput } from './solver'

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

  it('记忆化：同一 digits 多次调用返回同一引用（缓存）', () => {
    expect(enumerateCandidates(4)).toBe(enumerateCandidates(4))
  })

  it('不同 digits 返回不同结果', () => {
    expect(enumerateCandidates(4)).not.toBe(enumerateCandidates(3))
    expect(enumerateCandidates(3)).toHaveLength(720)
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

function baseInput(over: Partial<SolverInput> = {}): SolverInput {
  return {
    digits: 4,
    guesses: [],
    assumptions: [null, null, null, null],
    crossedOut: new Set<string>(),
    ...over,
  }
}

describe('solve', () => {
  it('返回 digits 列 × 10 行的网格', () => {
    const grid = solve(baseInput())
    expect(grid).toHaveLength(4)
    for (const col of grid) expect(col).toHaveLength(10)
  })

  it('无任何信息时所有格为 available', () => {
    const grid = solve(baseInput())
    for (const col of grid) for (const s of col) expect(s).toBe('available')
  })

  it('猜 0000 正确数目 0 → 数字 0 在所有列 eliminated', () => {
    const grid = solve(baseInput({ guesses: [{ guess: '0000', feedback: 0 }] }))
    for (let pos = 0; pos < 4; pos++) {
      expect(grid[pos][0]).toBe('eliminated')
    }
  })

  it('完全确定时每列正确数字为 fixed', () => {
    // 猜 1234 得 4 → 候选只剩 1234 → 各位对应数字 fixed
    const grid = solve(baseInput({ guesses: [{ guess: '1234', feedback: 4 }] }))
    expect(grid[0][1]).toBe('fixed')
    expect(grid[1][2]).toBe('fixed')
    expect(grid[2][3]).toBe('fixed')
    expect(grid[3][4]).toBe('fixed')
    // 同列其它数字 eliminated
    expect(grid[0][2]).toBe('eliminated')
  })

  it('用户假设成立 → assumed', () => {
    // 无事实约束，假设 pos0 = 5；5 在 pos0 仍可能 → assumed
    const grid = solve(baseInput({ assumptions: [5, null, null, null] }))
    expect(grid[0][5]).toBe('assumed')
  })

  it('假设联动收窄其它列：假设 pos0=5 → pos1..3 的 5 变 eliminated', () => {
    // 因为互不相同，pos0 既然假设是 5，其它位不可能是 5
    const grid = solve(baseInput({ assumptions: [5, null, null, null] }))
    expect(grid[1][5]).toBe('eliminated')
    expect(grid[2][5]).toBe('eliminated')
    expect(grid[3][5]).toBe('eliminated')
  })

  it('矛盾假设 → 相关假设格 conflict', () => {
    // 假设 pos0=1 且 pos1=1：互不相同使 what-if 为空 → 两格 conflict
    const grid = solve(baseInput({ assumptions: [1, 1, null, null] }))
    expect(grid[0][1]).toBe('conflict')
    expect(grid[1][1]).toBe('conflict')
  })

  it('假设与事实矛盾 → conflict', () => {
    // 事实：猜 1234 得 4 → 秘密就是 1234；假设 pos0=9 与之矛盾
    const grid = solve(
      baseInput({
        guesses: [{ guess: '1234', feedback: 4 }],
        assumptions: [9, null, null, null],
      }),
    )
    expect(grid[0][9]).toBe('conflict')
  })

  it('手动划除 → crossed', () => {
    const grid = solve(baseInput({ crossedOut: new Set(['0-7']) }))
    expect(grid[0][7]).toBe('crossed')
  })

  it('手动划除(crossed)与事实排除(eliminated)区分', () => {
    // 猜 0000 得 0 → pos0 的数字 0 被事实排除(eliminated)；同时手动划除 pos0 的数字 7(crossed)
    const grid = solve(
      baseInput({
        guesses: [{ guess: '0000', feedback: 0 }],
        crossedOut: new Set(['0-7']),
      }),
    )
    expect(grid[0][0]).toBe('eliminated') // 事实排除
    expect(grid[0][7]).toBe('crossed') // 手动划除
  })

  it('划除联动：划掉 pos0 除某值外所有 → 余下值 fixed', () => {
    // 划掉 pos0 的 0..8（保留 9）→ pos0 只能是 9 → fixed
    const crossed = new Set<string>()
    for (let d = 0; d <= 8; d++) crossed.add(`0-${d}`)
    const grid = solve(baseInput({ crossedOut: crossed }))
    expect(grid[0][9]).toBe('fixed')
  })

  it('digits=1 网格为 1 列', () => {
    const grid = solve(baseInput({ digits: 1, assumptions: [null] }))
    expect(grid).toHaveLength(1)
    expect(grid[0]).toHaveLength(10)
  })

  it('稀疏/短 assumptions 数组不误判 conflict（健壮性）', () => {
    // assumptions 只给 pos0，数组长度不足 digits（其余视为无假设）
    const grid = solve({
      digits: 4,
      guesses: [],
      assumptions: [3],
      crossedOut: new Set<string>(),
    })
    expect(grid[0][3]).toBe('assumed')
    // 其它列不应因 undefined 假设变成 conflict
    expect(grid[1][0]).toBe('available')
    expect(grid[2][5]).not.toBe('conflict')
  })

  it('越界假设值被当作无假设，不清空 what-if', () => {
    const grid = solve({
      digits: 4,
      guesses: [],
      assumptions: [15, null, null, null],
      crossedOut: new Set<string>(),
    })
    // 越界值不施加约束 → 其它格保持正常（available），不会全变 conflict
    expect(grid[1][2]).toBe('available')
  })

  it('同一列假设 + 划除联动：假设 pos0=5 且划除 pos1 的 5（本就联动排除）', () => {
    const grid = solve({
      digits: 4,
      guesses: [],
      assumptions: [5, null, null, null],
      crossedOut: new Set<string>(['1-5']),
    })
    expect(grid[0][5]).toBe('assumed')
    expect(grid[1][5]).toBe('crossed')
  })

  it('混合列：部分 available 部分 eliminated 并存', () => {
    // 猜 0123 得 0 → 数字 0,1,2,3 分别在其所在位置被排除，但各列仍有可用数字
    const grid = solve({
      digits: 4,
      guesses: [{ guess: '0123', feedback: 0 }],
      assumptions: [null, null, null, null],
      crossedOut: new Set<string>(),
    })
    expect(grid[0][0]).toBe('eliminated') // pos0 不可能是 0
    expect(grid[0][9]).toBe('available') // pos0 仍可能是 9
  })

  it('整列划空：所有候选被划除后该列无 available（不崩溃）', () => {
    // 划掉 pos0 全部 0-9 → pos0 无任何候选；函数应正常返回，不抛错
    const crossed = new Set<string>()
    for (let d = 0; d <= 9; d++) crossed.add(`0-${d}`)
    const grid = solve({
      digits: 4,
      guesses: [],
      assumptions: [null, null, null, null],
      crossedOut: crossed,
    })
    expect(grid[0].every((s) => s === 'crossed')).toBe(true)
  })

  it('矛盾时非假设格回退到仅事实推理（不整片置灰）', () => {
    // 假设 pos0=1 且 pos1=1 → what-if 空（互不相同矛盾）
    const grid = solve(baseInput({ assumptions: [1, 1, null, null] }))
    // 冲突的假设格标红
    expect(grid[0][1]).toBe('conflict')
    expect(grid[1][1]).toBe('conflict')
    // 非假设格不应因矛盾而全部置灰——无事实约束时应为 available
    expect(grid[2][3]).toBe('available')
    expect(grid[3][7]).toBe('available')
  })

  it('矛盾时非假设格仍反映事实推理（置灰/确定照常）', () => {
    // 事实：猜 1234 得 4 → 秘密就是 1234；再加与事实矛盾的假设 pos0=9
    const grid = solve(
      baseInput({
        guesses: [{ guess: '1234', feedback: 4 }],
        assumptions: [9, null, null, null],
      }),
    )
    expect(grid[0][9]).toBe('conflict') // 矛盾假设标红
    expect(grid[1][2]).toBe('fixed') // pos1 事实确定是 2，不因矛盾变灰
    expect(grid[0][1]).toBe('fixed') // pos0 事实确定是 1
  })
})
