<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { GameRecord } from '../history/types'
import { sideName } from '../playerLabels'
import { formatPlayedAt } from '../history/format'
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

const headingEl = ref<HTMLElement | null>(null)
onMounted(() => headingEl.value?.focus())

function confirmDelete() {
  if (confirm('删除这局历史？')) emit('delete', props.record.id)
}
</script>

<template>
  <div class="history-detail">
    <h1 class="detail-title" ref="headingEl" tabindex="-1">对局详情</h1>
    <header class="detail-head">
      <button type="button" @click="emit('back')"><span aria-hidden="true">←</span> 列表</button>
      <span class="when">{{ formatPlayedAt(record.playedAt) }}</span>
      <span class="detail-outcome">{{ outcomeText }} · {{ record.digits }}位 · {{ record.rounds }}回合</span>
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
