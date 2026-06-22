import type { GameConfig, GameState, PlayerId, GuessRecord } from './types'
import { validateSecret, validateGuess } from './validate'

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

function otherPlayer(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1'
}

export function submitGuess(state: GameState, value: string): GameState {
  if (state.phase !== 'playing') {
    throw new Error('只能在 playing 阶段猜测')
  }
  const g = validateGuess(value, state.config)
  if (!g.ok) {
    throw new Error(`非法猜测：${g.error}`)
  }
  const player = state.current
  const opponent = otherPlayer(player)
  const secret = state.secrets[opponent] as string
  const fb = feedback(secret, value)
  const hit = fb === state.config.digits

  const record: GuessRecord = { guess: value, feedback: fb }
  const history = { ...state.history, [player]: [...state.history[player], record] }
  const pendingHits = { ...state.pendingHits, [player]: hit }

  if (player === 'p1') {
    return { ...state, history, pendingHits, current: 'p2' }
  }

  const { p1: p1Hit, p2: p2Hit } = pendingHits
  if (p1Hit && p2Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'draw' } }
  }
  if (p1Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'win', winner: 'p1' } }
  }
  if (p2Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'win', winner: 'p2' } }
  }
  return {
    ...state,
    history,
    pendingHits: { p1: false, p2: false },
    round: state.round + 1,
    current: 'p1',
  }
}
