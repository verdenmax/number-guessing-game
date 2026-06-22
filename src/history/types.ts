import type { GuessRecord, Outcome } from '../game/types'

export interface GameRecord {
  id: string
  playedAt: number
  digits: number
  names: { p1: string | null; p2: string | null }
  secrets: { p1: string; p2: string }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  outcome: Outcome
  rounds: number
}
