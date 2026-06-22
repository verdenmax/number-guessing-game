<script setup lang="ts">
import { computed } from 'vue'
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'
import HistoryList from './HistoryList.vue'

const props = defineProps<{ record: GameRecord }>()
const emit = defineEmits<{ back: []; delete: [id: string] }>()

const p1Name = computed(() => sideName('p1', props.record.names))
const p2Name = computed(() => sideName('p2', props.record.names))

const outcomeText = computed(() => {
  const o = props.record.outcome
  if (o.kind === 'draw') return '平局'
  if (o.kind === 'win') return `${sideName(o.winner, props.record.names)} 胜`
  return ''
})
const fmtTime = computed(() => new Date(props.record.playedAt).toLocaleString())

function confirmDelete() {
  if (confirm('删除这局历史？')) emit('delete', props.record.id)
}
</script>

<template>
  <div class="history-detail">
    <h2 class="detail-title">对局详情</h2>
    <header class="detail-head">
      <button type="button" @click="emit('back')">← 列表</button>
      <span class="when">{{ fmtTime }}</span>
      <span class="result">{{ outcomeText }} · {{ record.digits }}位 · {{ record.rounds }}回合</span>
    </header>

    <p class="reveal">
      {{ p1Name }} 的数字：{{ record.secrets.p1 }}　{{ p2Name }} 的数字：{{ record.secrets.p2 }}
    </p>

    <div class="histories">
      <HistoryList :records="record.history.p1" :title="p1Name" side="red" />
      <HistoryList :records="record.history.p2" :title="p2Name" side="blue" />
    </div>

    <button type="button" class="detail-del" @click="confirmDelete">删除此局</button>
  </div>
</template>
