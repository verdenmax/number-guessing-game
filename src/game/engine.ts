import type { GameConfig, GameState, PlayerId } from './types'
import { validateSecret } from './validate'

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

export function setSecret(state: GameState, player: PlayerId, value: string): GameState {
  if (state.phase !== 'setup') {
    throw new Error('只能在 setup 阶段设置秘密数')
  }
  if (state.secrets[player] !== null) {
    throw new Error(`${player} 的秘密数已设置`)
  }
  const v = validateSecret(value, state.config)
  if (!v.ok) {
    throw new Error(`非法秘密数：${v.error}`)
  }
  const secrets = { ...state.secrets, [player]: value }
  const bothSet = secrets.p1 !== null && secrets.p2 !== null
  return {
    ...state,
    secrets,
    phase: bothSet ? 'playing' : 'setup',
    current: 'p1',
    round: 1,
  }
}
