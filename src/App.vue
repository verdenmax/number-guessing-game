<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGame } from './composables/useGame'
import { useHistory } from './composables/useHistory'
import { buildGameRecord } from './history/record'
import { saveGame } from './history/store'
import type { PlayerId } from './game/types'
import type { GameRecord } from './history/types'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'
import SolverPanel from './components/SolverPanel.vue'
import HistoryView from './components/HistoryView.vue'
import HistoryDetail from './components/HistoryDetail.vue'

const {
  phase, current, outcome, config, state,
  applySecret, applyGuess, checkSecret, checkGuess, reset,
} = useGame()

const names = ref<{ p1: string | null; p2: string | null }>({ p1: null, p2: null })
const applyName = (p: PlayerId, n: string) => {
  names.value[p] = n.trim() || null
}

const saved = ref(false)
const saveStatus = ref<'saving' | 'saved' | 'error'>('saving')

watch(phase, async (p) => {
  if (p === 'over' && !saved.value) {
    saved.value = true
    saveStatus.value = 'saving'
    try {
      await saveGame(buildGameRecord(state.value, names.value))
      saveStatus.value = 'saved'
    } catch {
      saveStatus.value = 'error'
    }
  }
})

function playAgain() {
  reset()
  names.value = { p1: null, p2: null }
  saved.value = false
  saveStatus.value = 'saving'
}

const view = ref<'game' | 'history'>('game')
const detail = ref<GameRecord | null>(null)
const { records, error: historyError, load, remove, clear } = useHistory()

async function openHistory() {
  detail.value = null
  view.value = 'history'
  await load()
}

const activeSide = computed(() => {
  if (phase.value === 'playing') return current.value === 'p1' ? 'red' : 'blue'
  if (phase.value === 'setup') return state.value.secrets.p1 === null ? 'red' : 'blue'
  return 'neutral'
})
</script>

<template>
  <div class="stage" :class="`side-${activeSide}`">
    <div class="table">
      <template v-if="view === 'game'">
        <SolverPanel
          v-if="phase === 'playing'"
          class="solver-left"
          :digits="config.digits"
          :guesses="state.history.p1"
          side="red"
        />

        <main class="app">
          <header class="app-head">
            <h1>猜数字</h1>
            <nav v-if="phase !== 'playing'" class="app-nav" aria-label="页面导航">
              <button type="button" class="nav-history" @click="openHistory">
                <span aria-hidden="true">📜</span> 历史
              </button>
            </nav>
          </header>

          <SetupView
            v-if="phase === 'setup'"
            :digits="config.digits"
            :validate="checkSecret"
            @set-secret="applySecret"
            @set-name="applyName"
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
            :names="names"
            :save-status="saveStatus"
            @play-again="playAgain"
            @view-history="openHistory"
          />
        </main>

        <SolverPanel
          v-if="phase === 'playing'"
          class="solver-right"
          :digits="config.digits"
          :guesses="state.history.p2"
          side="blue"
        />
      </template>

      <main v-else class="app history-page">
        <HistoryDetail
          v-if="detail"
          :record="detail"
          @back="detail = null"
          @delete="async (id) => { await remove(id); detail = null }"
        />
        <HistoryView
          v-else
          :records="records"
          :error="historyError"
          @open="detail = $event"
          @remove="remove"
          @clear="clear"
          @back="view = 'game'"
        />
      </main>
    </div>
  </div>
</template>
