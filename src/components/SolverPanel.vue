<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GuessRecord } from '../game/types'
import { solve, basicSolve, type CellState } from '../game/solver'

const props = defineProps<{
  digits: number
  guesses: GuessRecord[]
  side: 'red' | 'blue'
}>()

const expanded = ref(false)
const showHelp = ref(false)
const smartMode = ref(true)
const assumptions = ref<(number | null)[]>(Array.from({ length: props.digits }, () => null))
const crossedOut = ref<Set<string>>(new Set())

const grid = computed(() =>
  (smartMode.value ? solve : basicSolve)({
    digits: props.digits,
    guesses: props.guesses,
    assumptions: assumptions.value,
    crossedOut: crossedOut.value,
  }),
)

const sideName = computed(() => (props.side === 'red' ? '红方' : '蓝方'))

const stateLabel: Record<CellState, string> = {
  available: '可用',
  eliminated: '已排除',
  crossed: '已划除',
  fixed: '确定',
  assumed: '已假设',
  conflict: '矛盾',
}

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
      <div class="solver-help-bar">
        <label class="solver-mode">
          <input type="checkbox" v-model="smartMode" />
          🧠 智能推理
        </label>
        <button
          type="button"
          class="solver-help-btn"
          :aria-expanded="showHelp"
          aria-label="图例与帮助"
          @click="showHelp = !showHelp"
        >
          ?
        </button>
      </div>
      <div v-if="showHelp" class="solver-legend">
        <ul class="legend-list">
          <li><span class="solver-cell available">5</span><span>可用：该位仍可能是这个数字</span></li>
          <li><span class="solver-cell fixed">5</span><span>确定：该位唯一可能就是它</span></li>
          <li><span class="solver-cell assumed">5</span><span>假设正确：你左键假设此位为该数字</span></li>
          <li><span class="solver-cell crossed">5</span><span>假设错误：你右键划除（认为不是它）</span></li>
          <li>
            <span class="solver-cell eliminated">5</span><span>真的错误：据猜测历史逻辑上不可能</span>
          </li>
          <li><span class="solver-cell conflict">5</span><span>矛盾：假设互相冲突，无解</span></li>
        </ul>
        <p class="legend-ops">左键＝假设此位 · 右键／Shift+左键／Delete＝划除 · 「重置假设」清空全部</p>
      </div>
      <div class="solver-grid" :style="{ gridTemplateColumns: `repeat(${digits}, 1fr)` }">
        <div v-for="pos in digits" :key="`h-${pos}`" class="solver-col-head">位{{ pos }}</div>
        <template v-for="digit in 10" :key="`row-${digit}`">
          <button
            v-for="pos in digits"
            :key="`c-${pos}-${digit}`"
            type="button"
            class="solver-cell"
            :class="grid[pos - 1][digit - 1]"
            :aria-label="`位${pos} 数字${digit - 1} ${stateLabel[grid[pos - 1][digit - 1]]}`"
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
