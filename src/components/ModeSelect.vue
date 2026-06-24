<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { GameMode } from '../game/types'
import type { BotDifficulty } from '../game/bot'

const emit = defineEmits<{ select: [mode: GameMode, difficulty?: BotDifficulty] }>()

const showDifficulty = ref(false)
const difficulty = ref<BotDifficulty>('normal')
const pveBtn = ref<HTMLButtonElement | null>(null)
const diffLegend = ref<HTMLElement | null>(null)

async function openDifficulty() {
  showDifficulty.value = true
  await nextTick()
  diffLegend.value?.focus()
}
async function backToModes() {
  showDifficulty.value = false
  await nextTick()
  pveBtn.value?.focus()
}
</script>

<template>
  <div class="mode-select">
    <h2>选择对战模式</h2>

    <div v-if="!showDifficulty" class="mode-options">
      <button type="button" class="mode-btn mode-pvp" @click="emit('select', 'pvp')">
        <span class="mode-icon" aria-hidden="true">👥</span>
        <span class="mode-title">双人对战</span>
        <span class="mode-desc">同一设备热座，红蓝轮流</span>
      </button>
      <button ref="pveBtn" type="button" class="mode-btn mode-pve" @click="openDifficulty">
        <span class="mode-icon" aria-hidden="true">🤖</span>
        <span class="mode-title">人机对战</span>
        <span class="mode-desc">你先手，挑战电脑</span>
      </button>
    </div>

    <fieldset v-else class="difficulty-options">
      <legend ref="diffLegend" tabindex="-1">选择电脑难度</legend>
      <label><input v-model="difficulty" type="radio" name="difficulty" value="easy" /> 简单 · 随机猜</label>
      <label><input v-model="difficulty" type="radio" name="difficulty" value="normal" /> 普通 · 按线索推理</label>
      <label><input v-model="difficulty" type="radio" name="difficulty" value="hard" /> 困难 · 最优策略</label>
      <div class="difficulty-actions">
        <button type="button" class="back-mode" @click="backToModes">← 返回</button>
        <button type="button" class="start-pve" @click="emit('select', 'pve', difficulty)">开始对战</button>
      </div>
    </fieldset>
  </div>
</template>
