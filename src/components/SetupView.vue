<script setup lang="ts">
import { ref } from 'vue'
import type { PlayerId, ValidationResult } from '../game/types'
import SecretInput from './SecretInput.vue'
import HandoffScreen from './HandoffScreen.vue'

defineProps<{
  digits: number
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ setSecret: [player: PlayerId, value: string] }>()

type Step = 'p1' | 'handoff' | 'p2'
const step = ref<Step>('p1')

function confirmP1(value: string) {
  emit('setSecret', 'p1', value)
  step.value = 'handoff'
}
function confirmP2(value: string) {
  emit('setSecret', 'p2', value)
}
</script>

<template>
  <SecretInput
    v-if="step === 'p1'"
    :digits="digits"
    :validate="validate"
    label="红方：秘密设置你的数字（蓝方请勿看屏幕）"
    @confirm="confirmP1"
  />
  <HandoffScreen
    v-else-if="step === 'handoff'"
    message="请把电脑交给蓝方，准备好后点击开始"
    @continue="step = 'p2'"
  />
  <SecretInput
    v-else
    :digits="digits"
    :validate="validate"
    label="蓝方：秘密设置你的数字（红方请勿看屏幕）"
    @confirm="confirmP2"
  />
</template>
