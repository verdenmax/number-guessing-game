import type { GameConfig, GameState } from './types'

export function feedback(secret: string, guess: string): number {
  let bulls = 0
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) bulls++
  }
  return bulls
}

const DEFAULT_DIGITS = 4

export function createGame(config: Partial<GameConfig> = {}): GameState {
  const digits = config.digits ?? DEFAULT_DIGITS
  if (!Number.isInteger(digits) || digits < 1 || digits > 10) {
    throw new Error('digits 必须是 1 到 10 之间的整数')
  }
  return {
    config: { digits },
    phase: 'setup',
    secrets: { p1: null, p2: null },
    current: 'p1',
    round: 1,
    history: { p1: [], p2: [] },
    pendingHits: { p1: false, p2: false },
    outcome: { kind: 'ongoing' },
  }
}
