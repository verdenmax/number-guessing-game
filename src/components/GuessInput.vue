<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ValidationResult } from '../game/types'

const props = defineProps<{
  digits: number
  label: string
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ confirm: [value: string] }>()

const value = ref('')

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = el.value.replace(/[^0-9]/g, '').slice(0, props.digits)
  value.value = clean
  el.value = clean
}

const result = computed(() => props.validate(value.value))
const canSubmit = computed(() => result.value.ok)
const errorText = computed(() => (result.value.ok ? '' : result.value.error))

function confirm() {
  if (!canSubmit.value) return
  emit('confirm', value.value)
  value.value = ''
}
</script>

<template>
  <div class="guess-input">
    <p class="label">{{ label }}</p>
    <input
      type="text"
      :value="value"
      inputmode="numeric"
      :maxlength="digits"
      :aria-label="label"
      @input="onInput"
      @keyup.enter="confirm"
    />
    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    <button type="button" class="confirm" :disabled="!canSubmit" @click="confirm">提交猜测</button>
  </div>
</template>
