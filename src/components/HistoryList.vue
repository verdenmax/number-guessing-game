<script setup lang="ts">
import type { GuessRecord } from '../game/types'
defineProps<{ records: GuessRecord[]; title?: string; side?: 'red' | 'blue' }>()
</script>

<template>
  <div class="history" :class="side ? 'side-' + side : null">
    <h3 v-if="title">{{ title }}</h3>
    <table v-if="records.length" class="guess-table">
      <caption class="visually-hidden">{{ title ?? '该方' }}的猜测记录</caption>
      <thead>
        <tr>
          <th scope="col">猜测</th>
          <th scope="col">正确数目</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in records" :key="i">
          <td class="guess">{{ r.guess }}</td>
          <td class="fb">{{ r.feedback }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="records.length === 0" class="empty">还没有猜测</p>
  </div>
</template>
