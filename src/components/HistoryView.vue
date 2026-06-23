<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'
import { formatPlayedAt } from '../history/format'

defineProps<{
  records: GameRecord[]
  error: string | null
}>()
const emit = defineEmits<{
  open: [record: GameRecord]
  remove: [id: string]
  clear: []
  back: []
}>()

const headingEl = ref<HTMLElement | null>(null)
onMounted(() => headingEl.value?.focus())

function matchTitle(r: GameRecord): string {
  return `${sideName('p1', r.names)} vs ${sideName('p2', r.names)}`
}
function outcomeText(r: GameRecord): string {
  if (r.outcome.kind === 'draw') return '平局'
  if (r.outcome.kind === 'win') return `${sideName(r.outcome.winner, r.names)} 胜`
  return ''
}
function confirmRemove(id: string) {
  if (confirm('删除这局历史？')) emit('remove', id)
}
function confirmClear() {
  if (confirm('清空所有历史？')) emit('clear')
}
</script>

<template>
  <div class="history-view">
    <header class="history-head">
      <h1 ref="headingEl" tabindex="-1">对局历史</h1>
      <nav class="history-actions" aria-label="历史导航">
        <button type="button" :disabled="records.length === 0" @click="confirmClear">
          <span aria-hidden="true">🗑</span> 清空历史
        </button>
        <button type="button" @click="emit('back')"><span aria-hidden="true">←</span> 返回</button>
      </nav>
    </header>

    <!-- 错误横幅与列表非互斥；空态仅在无记录且无错误时显示 -->
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="records.length === 0 && !error" class="empty">还没有历史记录，玩一局试试吧</p>

    <ul v-if="records.length" class="history-list">
      <li v-for="r in records" :key="r.id" class="history-row">
        <button type="button" class="row-main" @click="emit('open', r)">
          <span class="when">{{ formatPlayedAt(r.playedAt) }}</span>
          <span class="match">{{ matchTitle(r) }}</span>
          <span class="row-outcome">{{ outcomeText(r) }}</span>
          <span class="meta">{{ r.digits }}位 · {{ r.rounds }}回合</span>
        </button>
        <button type="button" class="row-del" @click="confirmRemove(r.id)">删除</button>
      </li>
    </ul>
  </div>
</template>
