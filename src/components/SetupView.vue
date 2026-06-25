<script setup lang="ts">
import { ref } from 'vue'
import type { PlayerId, ValidationResult } from '../game/types'
import SecretInput from './SecretInput.vue'
import HandoffScreen from './HandoffScreen.vue'

const props = defineProps<{
  digits: number
  validate: (value: string) => ValidationResult
  names?: { p1: string | null; p2: string | null }
  vsBot?: boolean
  p1Done?: boolean
}>()
const emit = defineEmits<{
  setSecret: [player: PlayerId, value: string]
  setName: [player: PlayerId, name: string]
}>()

type Step = 'p1' | 'handoff' | 'p2'
// p1Done：红方秘密已设（如看历史后重挂载）。pvp 下从交接屏续上，避免回到 'p1' 重设导致
// setSecret 对已设玩家抛错而软锁定；vsBot 下 p1 设好即进对战、不会停在 setup，故仅 pvp 生效。
const step = ref<Step>(props.p1Done && !props.vsBot ? 'handoff' : 'p1')
const p1Name = ref(props.names?.p1 ?? '')
const p2Name = ref(props.names?.p2 ?? '')

function confirmP1(value: string) {
  emit('setName', 'p1', p1Name.value)
  emit('setSecret', 'p1', value)
  if (!props.vsBot) step.value = 'handoff'
}
function confirmP2(value: string) {
  emit('setName', 'p2', p2Name.value)
  emit('setSecret', 'p2', value)
}
</script>

<template>
  <fieldset v-if="step === 'p1'" class="setup-step">
    <legend>红方设置</legend>
    <label class="name-field">
      你的名字（可选，留空用红方）
      <input v-model="p1Name" type="text" maxlength="12" placeholder="红方" />
    </label>
    <SecretInput
      :digits="digits"
      :validate="validate"
      label="红方：秘密设置你的数字（蓝方请勿看屏幕）"
      @confirm="confirmP1"
    />
  </fieldset>
  <HandoffScreen
    v-else-if="step === 'handoff'"
    message="请把电脑交给蓝方，准备好后点击开始"
    @continue="step = 'p2'"
  />
  <fieldset v-else class="setup-step">
    <legend>蓝方设置</legend>
    <label class="name-field">
      你的名字（可选，留空用蓝方）
      <input v-model="p2Name" type="text" maxlength="12" placeholder="蓝方" />
    </label>
    <SecretInput
      :digits="digits"
      :validate="validate"
      label="蓝方：秘密设置你的数字（红方请勿看屏幕）"
      @confirm="confirmP2"
    />
  </fieldset>
</template>
