<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useGame } from './composables/useGame'
import { useHistory } from './composables/useHistory'
import { buildGameRecord } from './history/record'
import { saveGame } from './history/store'
import type { GameMode, PlayerId } from './game/types'
import type { GameRecord } from './history/types'
import { botGuess, randomSecret, type BotDifficulty } from './game/bot'
import ModeSelect from './components/ModeSelect.vue'
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

const gameMode = ref<GameMode | null>(null)
const botDifficulty = ref<BotDifficulty>('normal')
const botName = computed(
  () => '🤖 电脑·' + ({ easy: '简单', normal: '普通', hard: '困难' } as const)[botDifficulty.value],
)

function onSelectMode(mode: GameMode, difficulty?: BotDifficulty) {
  gameMode.value = mode
  if (mode === 'pve') {
    botDifficulty.value = difficulty ?? 'normal'
    applyName('p2', botName.value)
  }
}

// pve：玩家(p1)设秘密后，自动为 bot(p2)设随机秘密 → 进入对战
watch(
  () => state.value.secrets.p1,
  (p1secret) => {
    if (
      gameMode.value === 'pve' &&
      p1secret !== null &&
      state.value.secrets.p2 === null &&
      phase.value === 'setup'
    ) {
      applySecret('p2', randomSecret(config.value.digits))
    }
  },
)

const botTurn = computed(() => gameMode.value === 'pve' && current.value === 'p2')

let botTimer: ReturnType<typeof setTimeout> | null = null
function clearBotTimer() {
  if (botTimer !== null) {
    clearTimeout(botTimer)
    botTimer = null
  }
}

// pve：轮到 bot(p2) 时延迟出招；每次状态变化先清旧定时器防重入/串台
watch([phase, current], ([ph, cur]) => {
  clearBotTimer()
  if (gameMode.value === 'pve' && ph === 'playing' && cur === 'p2') {
    botTimer = setTimeout(() => {
      botTimer = null
      applyGuess(botGuess(state.value.history.p2, config.value.digits, botDifficulty.value))
    }, 800)
  }
})

onUnmounted(clearBotTimer)

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
  clearBotTimer()
  if (gameMode.value === 'pve') names.value.p2 = null // 清 bot 名，避免 pve→pvp 再战时蓝方残留「🤖 电脑·X」
  reset() // 重置秘密数/历史/回合/outcome；保留 names（pvp 再选双人后仍预填）
  gameMode.value = null // 回到模式选择
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

          <ModeSelect v-if="gameMode === null" @select="onSelectMode" />

          <SetupView
            v-else-if="phase === 'setup'"
            :digits="config.digits"
            :validate="checkSecret"
            :names="names"
            :vs-bot="gameMode === 'pve'"
            @set-secret="applySecret"
            @set-name="applyName"
          />

          <PlayView
            v-else-if="phase === 'playing'"
            :digits="config.digits"
            :current="current"
            :validate="checkGuess"
            :history="state.history"
            :names="names"
            :bot-turn="botTurn"
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
