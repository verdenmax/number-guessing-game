<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GuessRecord } from '../game/types'
import { solve } from '../game/solver'

const props = defineProps<{
  digits: number
  guesses: GuessRecord[]
  side: 'red' | 'blue'
}>()

const expanded = ref(false)
const assumptions = ref<(number | null)[]>(Array.from({ length: props.digits }, () => null))
const crossedOut = ref<Set<string>>(new Set())

const grid = computed(() =>
  solve({
    digits: props.digits,
    guesses: props.guesses,
    assumptions: assumptions.value,
    crossedOut: crossedOut.value,
  }),
)

const sideName = computed(() => (props.side === 'red' ? '红方' : '蓝方'))

function toggleAssumption(pos: number, digit: number) {
  const next = assumptions.value.slice()
  next[pos] = next[pos] === digit ? null : digit
  assumptions.value = next
}

function toggleCrossOut(pos: number, digit: number) {
  const next = new Set(crossedOut.value)
  const key = `${pos}-${digit}`
  if (next.has(key)) next.delete(key)
  else next.add(key)
  crossedOut.value = next
}

function onCellClick(e: MouseEvent, pos: number, digit: number) {
  if (e.shiftKey) toggleCrossOut(pos, digit)
  else toggleAssumption(pos, digit)
}

function reset() {
  assumptions.value = Array.from({ length: props.digits }, () => null)
  crossedOut.value = new Set()
}
</script>

<template>
  <section class="solver" :class="`side-${side}`">
    <button type="button" class="solver-toggle" @click="expanded = !expanded">
      {{ sideName }}助手 {{ expanded ? '▾' : '▸' }}
    </button>
    <div v-if="expanded" class="solver-body">
      <div class="solver-grid" :style="{ gridTemplateColumns: `repeat(${digits}, 1fr)` }">
        <div v-for="pos in digits" :key="`h-${pos}`" class="solver-col-head">位{{ pos }}</div>
        <template v-for="digit in 10" :key="`row-${digit}`">
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${grid[pos - 1][digit - 1]}`"
            :aria-pressed="grid[pos - 1][digit - 1] === 'assumed'"
            @click="onCellClick($event, pos - 1, digit - 1)"
            @contextmenu.prevent="toggleCrossOut(pos - 1, digit - 1)"
            @keydown.delete.prevent="toggleCrossOut(pos - 1, digit - 1)"
          >
            {{ digit - 1 }}
          </button>
        </template>
      </div>
      <button type="button" class="solver-reset" @click="reset">重置假设</button>
    </div>
  </section>
</template>
