import type { GameState, Outcome } from '../game/types'
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
  // 重建为普通对象：state 经 useGame 的 ref 后是 Vue 响应式 Proxy，
  // 直接引用 state.outcome 会让记录残留 Proxy，导致 IndexedDB put 的结构化克隆抛 DataCloneError。
  const o = state.outcome
  const outcome: Outcome =
    o.kind === 'win'
      ? { kind: 'win', winner: o.winner }
      : o.kind === 'draw'
        ? { kind: 'draw' }
        : { kind: 'ongoing' }
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
    outcome,
    rounds: state.round,
  }
}
