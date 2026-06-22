<script setup lang="ts">
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'

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

function matchTitle(r: GameRecord): string {
  return `${sideName('p1', r.names)} vs ${sideName('p2', r.names)}`
}
function outcomeText(r: GameRecord): string {
  if (r.outcome.kind === 'draw') return '平局'
  if (r.outcome.kind === 'win') return `${sideName(r.outcome.winner, r.names)} 胜`
  return ''
}
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString()
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
      <h2>对局历史</h2>
      <div class="history-actions">
        <button type="button" :disabled="records.length === 0" @click="confirmClear">
          🗑 清空历史
        </button>
        <button type="button" @click="emit('back')">← 返回</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="records.length === 0 && !error" class="empty">还没有历史记录，玩一局试试吧</p>

    <ul v-if="records.length" class="history-list">
      <li v-for="r in records" :key="r.id" class="history-row">
        <button type="button" class="row-main" @click="emit('open', r)">
          <span class="when">{{ fmtTime(r.playedAt) }}</span>
          <span class="match">{{ matchTitle(r) }}</span>
          <span class="result">{{ outcomeText(r) }}</span>
          <span class="meta">{{ r.digits }}位 · {{ r.rounds }}回合</span>
        </button>
        <button type="button" class="row-del" @click="confirmRemove(r.id)">删除</button>
      </li>
    </ul>
  </div>
</template>
