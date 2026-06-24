import type { GuessRecord } from './types'
import { enumerateCandidates, filterByFacts } from './solver'

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

  // normal：从候选随机；hard 在 Task 3 实现，暂同 normal 占位（下一个任务替换）
  return candidates[Math.floor(rnd() * candidates.length)]
}
