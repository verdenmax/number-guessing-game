<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import HandoffScreen from './HandoffScreen.vue'

const props = defineProps<{
  digits: number
  current: PlayerId
  round: number
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

const awaitingHandoff = ref(true)
const playerName = computed(() => (props.current === 'p1' ? '玩家1' : '玩家2'))
const opponentName = computed(() => (props.current === 'p1' ? '玩家2' : '玩家1'))
const currentHistory = computed(() => props.history[props.current])

function onGuess(value: string) {
  emit('guess', value)
  awaitingHandoff.value = true
}
</script>

<template>
  <HandoffScreen
    v-if="awaitingHandoff"
    :message="`请把电脑交给【${playerName}】，准备好后开始第 ${round} 回合的猜测`"
    button-text="开始猜测"
    @continue="awaitingHandoff = false"
  />
  <div v-else class="play">
    <p class="turn">第 {{ round }} 回合 · 轮到【{{ playerName }}】猜【{{ opponentName }}】的数字</p>
    <GuessInput
      :digits="digits"
      :validate="validate"
      :label="`输入你对【${opponentName}】数字的猜测`"
      @confirm="onGuess"
    />
    <HistoryList :records="currentHistory" :title="`【${playerName}】的猜测记录`" />
  </div>
</template>
