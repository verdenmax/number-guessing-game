import type { GameState } from '../game/types'
import type { GameRecord } from './types'

export interface RecordNames {
  p1: string | null
  p2: string | null
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function buildGameRecord(
  state: GameState,
  names: RecordNames,
  opts: { id?: string; now?: number } = {},
): GameRecord {
  if (state.phase !== 'over') {
    throw new Error('buildGameRecord 只能在 over 阶段调用')
  }
  const { p1, p2 } = state.secrets
  if (p1 === null || p2 === null) {
    throw new Error('over 阶段双方秘密数不应为 null')
  }
  return {
    id: opts.id ?? newId(),
    playedAt: opts.now ?? Date.now(),
    digits: state.config.digits,
    names: { p1: names.p1, p2: names.p2 },
    secrets: { p1, p2 },
    history: {
      p1: state.history.p1.map((r) => ({ ...r })),
      p2: state.history.p2.map((r) => ({ ...r })),
    },
    outcome: state.outcome,
    rounds: state.round,
  }
}
