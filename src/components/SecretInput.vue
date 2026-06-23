<script setup lang="ts">
import { ref, computed, onMounted, useId } from 'vue'
import type { ValidationResult } from '../game/types'

const props = defineProps<{
  digits: number
  label: string
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ confirm: [value: string] }>()

const value = ref('')
const masked = ref(true)
const inputEl = ref<HTMLInputElement | null>(null)
const id = useId()
onMounted(() => inputEl.value?.focus())

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
  <form class="secret-input" @submit.prevent="confirm">
    <label class="label" :for="id">{{ label }}</label>
    <div class="row">
      <input
        :id="id"
        ref="inputEl"
        :type="masked ? 'password' : 'text'"
        :value="value"
        inputmode="numeric"
        autocomplete="off"
        :maxlength="digits"
        @input="onInput"
      />
      <button type="button" class="toggle" @click="masked = !masked">
        {{ masked ? '显示' : '隐藏' }}
      </button>
    </div>
    <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
    <button type="submit" class="confirm" :disabled="!canSubmit">确认</button>
  </form>
</template>
