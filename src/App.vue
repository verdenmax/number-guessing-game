<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from './composables/useGame'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'
import SolverPanel from './components/SolverPanel.vue'

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
    <div class="table">
      <SolverPanel
        v-if="phase === 'playing'"
        class="solver-left"
        :digits="config.digits"
        :guesses="state.history.p1"
        side="red"
      />

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

      <SolverPanel
        v-if="phase === 'playing'"
        class="solver-right"
        :digits="config.digits"
        :guesses="state.history.p2"
        side="blue"
      />
    </div>
  </div>
</template>
