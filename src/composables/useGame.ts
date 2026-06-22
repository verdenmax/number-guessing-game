import { ref, computed } from 'vue'
import type { GameConfig, GameState, PlayerId } from '../game/types'
import { createGame, setSecret, submitGuess } from '../game/engine'
import { validateSecret, validateGuess } from '../game/validate'

export function useGame(initial: Partial<GameConfig> = {}) {
  const state = ref<GameState>(createGame(initial))

  const applySecret = (player: PlayerId, value: string) => {
    state.value = setSecret(state.value, player, value)
  }
  const applyGuess = (value: string) => {
    state.value = submitGuess(state.value, value)
  }
  const reset = (config: Partial<GameConfig> = {}) => {
    state.value = createGame(config)
  }

  const phase = computed(() => state.value.phase)
  const current = computed(() => state.value.current)
  const round = computed(() => state.value.round)
  const outcome = computed(() => state.value.outcome)
  const config = computed(() => state.value.config)

  const checkSecret = (value: string) => validateSecret(value, state.value.config)
  const checkGuess = (value: string) => validateGuess(value, state.value.config)

  return {
    state, phase, current, round, outcome, config,
    applySecret, applyGuess, reset, checkSecret, checkGuess,
  }
}
