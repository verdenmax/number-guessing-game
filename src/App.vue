<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from './composables/useGame'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

const {
  phase, current, outcome, config, state,
  applySecret, applyGuess, checkSecret, checkGuess, reset,
} = useGame()

const activeSide = computed(() => {
  if (phase.value === 'playing') return current.value === 'p1' ? 'red' : 'blue'
  if (phase.value === 'setup') return state.value.secrets.p1 === null ? 'red' : 'blue'
  return 'neutral'
})
</script>

<template>
  <div class="stage" :class="`side-${activeSide}`">
    <main class="app">
      <h1>Guessing Number</h1>

      <SetupView
        v-if="phase === 'setup'"
        :digits="config.digits"
        :validate="checkSecret"
        @set-secret="applySecret"
      />

      <PlayView
        v-else-if="phase === 'playing'"
        :digits="config.digits"
        :current="current"
        :validate="checkGuess"
        :history="state.history"
        @guess="applyGuess"
      />

      <ResultView
        v-else
        :outcome="outcome"
        :secrets="state.secrets"
        :history="state.history"
        @play-again="reset()"
      />
    </main>
  </div>
</template>
