import { feedback } from './engine'
import type { GuessRecord } from './types'

export function enumerateCandidates(digits: number): string[] {
  const results: string[] = []
  const used = new Array<boolean>(10).fill(false)
  const current: string[] = []

  function recurse(): void {
    if (current.length === digits) {
      results.push(current.join(''))
      return
    }
    for (let d = 0; d < 10; d++) {
      if (used[d]) continue
      used[d] = true
      current.push(String(d))
      recurse()
      current.pop()
      used[d] = false
    }
  }

  recurse()
  return results
}

export function filterByFacts(candidates: string[], guesses: GuessRecord[]): string[] {
  return candidates.filter((c) => guesses.every((g) => feedback(c, g.guess) === g.feedback))
}

export type CellState = 'available' | 'eliminated' | 'fixed' | 'assumed' | 'conflict'

export interface SolverInput {
  digits: number
  guesses: GuessRecord[]
  assumptions: (number | null)[]
  crossedOut: Set<string>
}

export type Grid = CellState[][]

export function solve(input: SolverInput): Grid {
  const { digits, guesses, assumptions, crossedOut } = input

  const factPossible = filterByFacts(enumerateCandidates(digits), guesses)
  const whatif = factPossible.filter((c) => {
    for (let i = 0; i < digits; i++) {
      const a = assumptions[i]
      // 仅对有效的 0-9 假设施加约束；null/undefined/越界值视为"无假设"，避免误清空 what-if
      if (a != null && a >= 0 && a <= 9 && c[i] !== String(a)) return false
    }
    for (const key of crossedOut) {
      const [p, d] = key.split('-')
      if (c[Number(p)] === d) return false
    }
    return true
  })

  const whatifEmpty = whatif.length === 0

  // 预计算每列在 factPossible / whatif 中各位出现过的数字集合
  const factDigitsAt: Set<string>[] = []
  const whatifDigitsAt: Set<string>[] = []
  for (let pos = 0; pos < digits; pos++) {
    factDigitsAt.push(new Set(factPossible.map((c) => c[pos])))
    whatifDigitsAt.push(new Set(whatif.map((c) => c[pos])))
  }

  const grid: Grid = []
  for (let pos = 0; pos < digits; pos++) {
    const col: CellState[] = []
    for (let digit = 0; digit < 10; digit++) {
      const d = String(digit)
      const posDigitOK = whatifDigitsAt[pos].has(d)
      const factHasIt = factDigitsAt[pos].has(d)
      const colOnlyThis = whatifDigitsAt[pos].size === 1 && posDigitOK

      let state: CellState
      if (assumptions[pos] === digit) {
        state = posDigitOK && !whatifEmpty ? 'assumed' : 'conflict'
      } else if (crossedOut.has(`${pos}-${digit}`)) {
        state = 'eliminated'
      } else if (!factHasIt) {
        state = 'eliminated'
      } else if (colOnlyThis) {
        state = 'fixed'
      } else if (!posDigitOK) {
        state = 'eliminated'
      } else {
        state = 'available'
      }
      col.push(state)
    }
    grid.push(col)
  }
  return grid
}
