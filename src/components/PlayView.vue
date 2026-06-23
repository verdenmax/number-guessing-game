<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import { sideName } from '../playerLabels'

const props = defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

function onGuess(value: string) {
  emit('guess', value)
}

const announceText = computed(() => {
  const { p1, p2 } = props.history
  const last = p1.length > p2.length ? { who: 'p1' as const, r: p1[p1.length - 1] } : p2.length ? { who: 'p2' as const, r: p2[p2.length - 1] } : null
  if (!last) return ''
  return `${sideName(last.who)} 猜 ${last.r.guess}，正确数目 ${last.r.feedback}`
})
</script>

<template>
  <div class="play">
    <p class="visually-hidden" role="status" aria-live="polite">{{ announceText }}</p>
    <GuessInput
      :key="current"
      :digits="digits"
      :validate="validate"
      :label="`${sideName(current)}输入`"
      @confirm="onGuess"
    />
    <section class="histories" aria-labelledby="play-hist-h">
      <h2 id="play-hist-h" class="visually-hidden">猜测记录</h2>
      <HistoryList :records="history.p1" title="红方" side="red" />
      <HistoryList :records="history.p2" title="蓝方" side="blue" />
    </section>
  </div>
</template>
