import type { GuessRecord } from './types'
import { enumerateCandidates, filterByFacts } from './solver'
import { feedback } from './engine'

export type BotDifficulty = 'easy' | 'normal' | 'hard'

// 随机互不相同的 digits 位秘密：Fisher–Yates 洗牌 0-9，取前 digits 位。digits 必须 ≤ 10。
export function randomSecret(digits: number, rnd: () => number = Math.random): string {
  const ds = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  for (let i = ds.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[ds[i], ds[j]] = [ds[j], ds[i]]
  }
  return ds.slice(0, digits).join('')
}

// 困难档一步 minimax 的候选规模上限：超过则取候选首个，避免开局 O(n^2) 卡顿
const HARD_MINIMAX_THRESHOLD = 150

function randomGuess(digits: number, rnd: () => number): string {
  let s = ''
  for (let i = 0; i < digits; i++) s += Math.floor(rnd() * 10)
  return s
}

// bot(p2) 依据其对玩家秘密的猜测历史 guesses(=state.history.p2) 选下一猜。
export function botGuess(
  guesses: GuessRecord[],
  digits: number,
  difficulty: BotDifficulty,
  rnd: () => number = Math.random,
): string {
  if (difficulty === 'easy') return randomGuess(digits, rnd)

  const candidates = filterByFacts(enumerateCandidates(digits), guesses)
  if (candidates.length === 0) return randomGuess(digits, rnd)

  if (difficulty === 'normal') {
    return candidates[Math.floor(rnd() * candidates.length)]
  }

  // hard
  if (candidates.length > HARD_MINIMAX_THRESHOLD) return candidates[0]
  return minimaxGuess(candidates)
}

// 一步 minimax：对每个候选 g，按 feedback(s,g) 把候选集分桶，取最大桶（猜 g 后最坏剩余）；
// 选使「最大桶最小」的 g。严格小于比较 → 平局保留候选序最前者（确定性）。
// 注意：g 仅遍历候选集 C（不是全体字符串），是候选受限的 minimax——这样所选猜测既是最优分割、
// 又可能直接命中，故并非全局 minimax，是有意为之。
function minimaxGuess(candidates: string[]): string {
  let best = candidates[0]
  let bestWorst = Infinity
  for (const g of candidates) {
    const buckets = new Map<number, number>()
    let worst = 0
    for (const s of candidates) {
      const fb = feedback(s, g)
      // s === g 落入全中（all-bulls）桶；该桶大小恒为 1，绝不会改变 argmin，无需特判。
      const n = (buckets.get(fb) ?? 0) + 1
      buckets.set(fb, n)
      if (n > worst) worst = n
    }
    if (worst < bestWorst) {
      bestWorst = worst
      best = g
    }
  }
  return best
}
