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
