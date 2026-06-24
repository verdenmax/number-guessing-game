export interface GameConfig {
  digits: number
}

export type Phase = 'setup' | 'playing' | 'over'

export type GameMode = 'pvp' | 'pve'

export type PlayerId = 'p1' | 'p2'

export interface GuessRecord {
  guess: string
  feedback: number
}

export type Outcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winner: PlayerId }
  | { kind: 'draw' }

export interface GameState {
  config: GameConfig
  phase: Phase
  secrets: { p1: string | null; p2: string | null }
  current: PlayerId
  round: number
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  pendingHits: { p1: boolean; p2: boolean }
  outcome: Outcome
}

export type ValidationResult = { ok: true } | { ok: false; error: string }
