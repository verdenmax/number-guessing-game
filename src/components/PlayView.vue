<script setup lang="ts">
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import { sideName } from '../playerLabels'

defineProps<{
  digits: number
  current: PlayerId
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

function onGuess(value: string) {
  emit('guess', value)
}
</script>

<template>
  <div class="play">
    <GuessInput
      :key="current"
      :digits="digits"
      :validate="validate"
      :label="`${sideName(current)}输入`"
      @confirm="onGuess"
    />
    <div class="histories">
      <HistoryList :records="history.p1" title="红方" side="red" />
      <HistoryList :records="history.p2" title="蓝方" side="blue" />
    </div>
  </div>
</template>
