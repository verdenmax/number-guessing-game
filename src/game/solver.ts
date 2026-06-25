import { feedback } from './engine'
import type { GuessRecord } from './types'

const candidateCache = new Map<number, string[]>()

// 注意：返回的是按 digits 缓存的共享数组，调用方必须视为只读、切勿就地修改
// （否则会污染缓存，影响后续所有调用）。filterByFacts 用 .filter 返回新数组，安全。
export function enumerateCandidates(digits: number): string[] {
  const cached = candidateCache.get(digits)
  if (cached) return cached

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
  candidateCache.set(digits, results)
  return results
}

export function filterByFacts(candidates: string[], guesses: GuessRecord[]): string[] {
  return candidates.filter((c) => guesses.every((g) => feedback(c, g.guess) === g.feedback))
}

export type CellState = 'available' | 'eliminated' | 'crossed' | 'fixed' | 'fixedAssumed' | 'assumed' | 'conflict'

export interface SolverInput {
  digits: number
  guesses: GuessRecord[]
  assumptions: (number | null)[]
  crossedOut: Set<string>
}

export type Grid = CellState[][]

// 候选 c 是否满足「假设 + 划除」约束（what-if 过滤判据）。assumptions 仅对 0-9 的有效值施加。
function matchesWhatif(
  c: string,
  digits: number,
  assumptions: (number | null)[],
  crossedOut: Set<string>,
): boolean {
  for (let i = 0; i < digits; i++) {
    const a = assumptions[i]
    if (a != null && a >= 0 && a <= 9 && c[i] !== String(a)) return false
  }
  for (const key of crossedOut) {
    const [p, d] = key.split('-')
    if (c[Number(p)] === d) return false
  }
  return true
}

function computeFactAndWhatif(input: SolverInput): { factPossible: string[]; whatif: string[] } {
  const { digits, guesses, assumptions, crossedOut } = input
  const factPossible = filterByFacts(enumerateCandidates(digits), guesses)
  const whatif = factPossible.filter((c) => matchesWhatif(c, digits, assumptions, crossedOut))
  return { factPossible, whatif }
}

export function solve(input: SolverInput): Grid {
  const { digits, assumptions, crossedOut } = input
  const { factPossible, whatif } = computeFactAndWhatif(input)

  const whatifEmpty = whatif.length === 0

  // 预计算每列在 factPossible / whatif 中各位出现过的数字集合
  const factDigitsAt: Set<string>[] = []
  const whatifDigitsAt: Set<string>[] = []
  for (let pos = 0; pos < digits; pos++) {
    factDigitsAt.push(new Set(factPossible.map((c) => c[pos])))
    whatifDigitsAt.push(new Set(whatif.map((c) => c[pos])))
  }

  // 矛盾（what-if 空）时，非假设格回退到"仅事实推理"（基于 factPossible），
  // 避免整片置灰；只有冲突的假设格标红。
  const derivedDigitsAt = whatifEmpty ? factDigitsAt : whatifDigitsAt

  // what-if 空（假设组合无解）时，精确归因冲突：只把「真正参与冲突」的假设格标红，
  // 避免无辜假设格（如三个假设里仅两个互斥，第三个被连累）也被误标红。
  // 判据：该假设值本身即与事实矛盾（自身不可能），或移除它后 what-if 重新有解（它是冲突的必要成员）。
  const conflictPositions = new Set<number>()
  if (whatifEmpty) {
    for (let pos = 0; pos < digits; pos++) {
      const a = assumptions[pos]
      if (a == null || a < 0 || a > 9) continue
      if (!factDigitsAt[pos].has(String(a))) {
        conflictPositions.add(pos)
        continue
      }
      const reduced = assumptions.map((x, i) => (i === pos ? null : x))
      if (factPossible.some((c) => matchesWhatif(c, digits, reduced, crossedOut))) {
        conflictPositions.add(pos)
      }
    }
  }

  const grid: Grid = []
  for (let pos = 0; pos < digits; pos++) {
    const col: CellState[] = []
    for (let digit = 0; digit < 10; digit++) {
      const d = String(digit)
      const posDigitOK = derivedDigitsAt[pos].has(d)
      const factHasIt = factDigitsAt[pos].has(d)
      const colOnlyThis = derivedDigitsAt[pos].size === 1 && posDigitOK

      const factColOnlyThis = factDigitsAt[pos].size === 1 && factHasIt
      let state: CellState
      if (assumptions[pos] === digit) {
        // what-if 非空：假设成立→assumed；what-if 空：仅真正冲突的假设格标红，无辜假设格仍显示 assumed
        state = !whatifEmpty && posDigitOK ? 'assumed' : conflictPositions.has(pos) ? 'conflict' : 'assumed'
      } else if (crossedOut.has(`${pos}-${digit}`)) {
        state = 'crossed'
      } else if (!factHasIt) {
        state = 'eliminated'
      } else if (colOnlyThis) {
        state = factColOnlyThis ? 'fixed' : 'fixedAssumed'
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

export function remainingCount(input: SolverInput): { remaining: number; candidates: string[] } {
  const { whatif } = computeFactAndWhatif(input)
  return { remaining: whatif.length, candidates: whatif.length <= 8 ? [...whatif] : [] }
}

export function basicSolve(input: SolverInput): Grid {
  const { digits, guesses, assumptions, crossedOut } = input

  const eliminated = new Set<string>()
  // ① 反馈=0 的事实排除：该猜测每位数字在对应位置不可能
  for (const g of guesses) {
    if (g.feedback === 0) {
      for (let i = 0; i < digits; i++) {
        eliminated.add(`${i}-${Number(g.guess[i])}`)
      }
    }
  }
  // ② 已知正确(用户假设)的行/列排除：仅对有效的 0-9 假设施加
  for (let p = 0; p < digits; p++) {
    const d = assumptions[p]
    if (d != null && d >= 0 && d <= 9) {
      for (let p2 = 0; p2 < digits; p2++) {
        if (p2 !== p) eliminated.add(`${p2}-${d}`) // 行：该数字在其它位置不可能
      }
      for (let d2 = 0; d2 < 10; d2++) {
        if (d2 !== d) eliminated.add(`${p}-${d2}`) // 列：该位置其它数字不可能
      }
    }
  }

  const grid: Grid = []
  for (let pos = 0; pos < digits; pos++) {
    const col: CellState[] = []
    for (let digit = 0; digit < 10; digit++) {
      const key = `${pos}-${digit}`
      let state: CellState
      if (assumptions[pos] === digit) {
        state = eliminated.has(key) ? 'conflict' : 'assumed'
      } else if (crossedOut.has(key)) {
        state = 'crossed'
      } else if (eliminated.has(key)) {
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
