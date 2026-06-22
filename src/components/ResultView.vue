<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, Outcome } from '../game/types'
import HistoryList from './HistoryList.vue'

const props = defineProps<{
  outcome: Outcome
  secrets: { p1: string | null; p2: string | null }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ playAgain: [] }>()

const resultText = computed(() => {
  if (props.outcome.kind === 'draw') return '平局！'
  if (props.outcome.kind === 'win') {
    return props.outcome.winner === 'p1' ? '玩家1 获胜！' : '玩家2 获胜！'
  }
  return ''
})
</script>

<template>
  <div class="result">
    <h2>{{ resultText }}</h2>
    <p class="reveal">玩家1 的数字：{{ secrets.p1 }}　玩家2 的数字：{{ secrets.p2 }}</p>
    <div class="histories">
      <HistoryList :records="history.p1" title="玩家1 的猜测" />
      <HistoryList :records="history.p2" title="玩家2 的猜测" />
    </div>
    <button type="button" @click="emit('playAgain')">再来一局</button>
  </div>
</template>
