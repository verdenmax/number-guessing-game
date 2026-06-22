<script setup lang="ts">
import type { GuessRecord } from '../game/types'
defineProps<{ records: GuessRecord[]; title?: string; side?: 'red' | 'blue' }>()
</script>

<template>
  <div class="history" :class="side ? 'side-' + side : null">
    <h3 v-if="title">{{ title }}</h3>
    <ol>
      <li v-for="(r, i) in records" :key="i">
        <span class="guess">{{ r.guess }}</span>
        <span class="fb">正确数目 {{ r.feedback }}</span>
      </li>
    </ol>
    <p v-if="records.length === 0" class="empty">还没有猜测</p>
  </div>
</template>
