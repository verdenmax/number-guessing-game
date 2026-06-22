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
