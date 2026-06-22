<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, Outcome } from '../game/types'
import { sideName } from '../playerLabels'
import HistoryList from './HistoryList.vue'

const props = defineProps<{
  outcome: Outcome
  secrets: { p1: string | null; p2: string | null }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  names?: { p1: string | null; p2: string | null }
  saveError?: string | null
}>()
const emit = defineEmits<{ playAgain: []; viewHistory: [] }>()

const p1Name = computed(() => sideName('p1', props.names))
const p2Name = computed(() => sideName('p2', props.names))

const resultText = computed(() => {
  if (props.outcome.kind === 'draw') return '平局！'
  if (props.outcome.kind === 'win') return `${sideName(props.outcome.winner, props.names)}获胜！`
  return ''
})
</script>

<template>
  <div class="result">
    <h2>{{ resultText }}</h2>
    <p class="reveal">{{ p1Name }}的数字：{{ secrets.p1 }}　{{ p2Name }}的数字：{{ secrets.p2 }}</p>
    <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
    <p v-else class="saved-hint">✅ 本局已保存到历史</p>
    <div class="histories">
      <HistoryList :records="history.p1" :title="p1Name" side="red" />
      <HistoryList :records="history.p2" :title="p2Name" side="blue" />
    </div>
    <div class="result-actions">
      <button type="button" @click="emit('playAgain')">再来一局</button>
      <button type="button" @click="emit('viewHistory')">📜 查看历史</button>
    </div>
  </div>
</template>
