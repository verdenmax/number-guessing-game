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
          >
            {{ digit - 1 }}
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
