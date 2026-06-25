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

// 困难档一步 minimax 的候选规模上限：超过则从候选随机取一个，避免开局 O(n^2) 卡顿
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
  // 候选过多时若恒取 candidates[0]（按字典序最小），开局必为 '0123' 且总优先猜小数，
  // 导致大数秘密被很晚才命中（不公平/可预测）。改为按 rnd 随机取候选：
  // 依 Bulls&Cows 的数字置换对称性，任一互异候选作开局信息量等价，故无损推理强度。
  if (candidates.length > HARD_MINIMAX_THRESHOLD) {
    return candidates[Math.floor(rnd() * candidates.length)]
  }
  return minimaxGuess(candidates, rnd)
}

// 一步 minimax：对每个候选 g，按 feedback(s,g) 把候选集分桶，取最大桶（猜 g 后最坏剩余）；
// 选使「最大桶最小」的 g。等优（多个 g 并列最坏桶最小）时经 rnd 在它们间随机取，
// 避免恒取候选序最前者（字典序最小）造成的小数偏置——大/小数秘密因此被同等速度命中。
// 注意：g 仅遍历候选集 C（不是全体字符串），是候选受限的 minimax——这样所选猜测既是最优分割、
// 又可能直接命中，故并非全局 minimax，是有意为之。
function minimaxGuess(candidates: string[], rnd: () => number): string {
  let bestWorst = Infinity
  let bestGuesses: string[] = []
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
      bestGuesses = [g]
    } else if (worst === bestWorst) {
      bestGuesses.push(g)
    }
  }
  return bestGuesses[Math.floor(rnd() * bestGuesses.length)]
}
