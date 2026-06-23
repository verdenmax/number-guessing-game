<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { GuessRecord } from '../game/types'
import { solve, basicSolve, remainingCount, type CellState } from '../game/solver'

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

const meta = computed(() =>
  smartMode.value
    ? remainingCount({
        digits: props.digits,
        guesses: props.guesses,
        assumptions: assumptions.value,
        crossedOut: crossedOut.value,
      })
    : null,
)

const sideName = computed(() => (props.side === 'red' ? '红方' : '蓝方'))

const stateLabel: Record<CellState, string> = {
  available: '可用',
  eliminated: '已排除',
  crossed: '已划除',
  fixed: '确定',
  fixedAssumed: '假设下确定',
  assumed: '已假设',
  conflict: '矛盾',
}

const menuFor = ref<{ pos: number; digit: number } | null>(null)
const menuStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })
const menuEl = ref<HTMLElement | null>(null)
let triggerEl: HTMLElement | null = null

function isMenuOpen(pos: number, digit: number) {
  return menuFor.value?.pos === pos && menuFor.value?.digit === digit
}

const canClear = computed(() => {
  const m = menuFor.value
  if (!m) return false
  return assumptions.value[m.pos] === m.digit || crossedOut.value.has(`${m.pos}-${m.digit}`)
})

function openMenu(e: MouseEvent, pos: number, digit: number) {
  if (isMenuOpen(pos, digit)) {
    closeMenu()
    return
  }
  triggerEl = e.currentTarget as HTMLElement
  menuStyle.value = { left: `${triggerEl.offsetLeft}px`, top: `${triggerEl.offsetTop + triggerEl.offsetHeight}px` }
  menuFor.value = { pos, digit }
  nextTick(() => menuEl.value?.querySelector('button')?.focus())
}

function closeMenu() {
  menuFor.value = null
  triggerEl?.focus()
  triggerEl = null
}

function chooseAssume() {
  const m = menuFor.value
  if (!m) return
  const next = assumptions.value.slice()
  next[m.pos] = m.digit
  assumptions.value = next
  closeMenu()
}

function chooseCross() {
  const m = menuFor.value
  if (!m) return
  const next = new Set(crossedOut.value)
  next.add(`${m.pos}-${m.digit}`)
  crossedOut.value = next
  closeMenu()
}

function chooseClear() {
  const m = menuFor.value
  if (!m) return
  if (assumptions.value[m.pos] === m.digit) {
    const a = assumptions.value.slice()
    a[m.pos] = null
    assumptions.value = a
  }
  const key = `${m.pos}-${m.digit}`
  if (crossedOut.value.has(key)) {
    const s = new Set(crossedOut.value)
    s.delete(key)
    crossedOut.value = s
  }
  closeMenu()
}

function reset() {
  assumptions.value = Array.from({ length: props.digits }, () => null)
  crossedOut.value = new Set()
}
</script>

<template>
  <aside class="solver" :class="`side-${side}`" :aria-label="`${sideName}推理助手`">
    <button
      type="button"
      class="solver-toggle"
      :aria-expanded="expanded"
      :aria-controls="`solver-body-${side}`"
      @click="expanded = !expanded"
    >
      {{ sideName }}助手 <span aria-hidden="true">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <div v-if="expanded" :id="`solver-body-${side}`" class="solver-body">
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
        <p class="legend-mode">
          {{ smartMode ? '智能：枚举推理，自动判定确定/排除' : '基础：只标排除（反馈0 + 已知正确的行列），不自动判确定' }}
        </p>
        <ul class="legend-list">
          <li><span class="solver-cell available">5</span><span>可用：该位仍可能是这个数字</span></li>
          <li v-if="smartMode">
            <span class="solver-cell fixed">5</span><span>事实确定：无需假设即可断定</span>
          </li>
          <li v-if="smartMode">
            <span class="solver-cell fixedAssumed">5</span><span>假设下确定：依赖你当前的假设/划除</span>
          </li>
          <li><span class="solver-cell assumed">5</span><span>假设正确：你在菜单中选「假设此位」</span></li>
          <li><span class="solver-cell crossed">5</span><span>已划除：你手动标记为「不是它」</span></li>
          <li>
            <span class="solver-cell eliminated">5</span><span>真的错误：据猜测历史逻辑上不可能</span>
          </li>
          <li><span class="solver-cell conflict">5</span><span>矛盾：假设互相冲突，无解</span></li>
        </ul>
        <p class="legend-ops">点击格子打开菜单：假设此位／划除／清除 · 「重置假设」清空全部</p>
      </div>
      <p v-if="meta" class="solver-count">
        剩 {{ meta.remaining }} 个可能<span v-if="meta.candidates.length">：{{ meta.candidates.join('、') }}</span>
      </p>
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
            aria-haspopup="menu"
            :aria-expanded="isMenuOpen(pos - 1, digit - 1)"
            @click="openMenu($event, pos - 1, digit - 1)"
            @contextmenu.prevent="openMenu($event, pos - 1, digit - 1)"
          >
            {{ digit - 1 }}
          </button>
        </template>
        <div v-if="menuFor" class="solver-menu-backdrop" @click="closeMenu"></div>
        <div
          v-if="menuFor"
          ref="menuEl"
          class="solver-menu"
          role="menu"
          :style="menuStyle"
          @keydown.esc="closeMenu"
        >
          <button type="button" role="menuitem" class="solver-menu-item" data-act="assume" @click="chooseAssume">
            假设此位
          </button>
          <button type="button" role="menuitem" class="solver-menu-item" data-act="cross" @click="chooseCross">
            划除
          </button>
          <button
            type="button"
            role="menuitem"
            class="solver-menu-item"
            data-act="clear"
            :disabled="!canClear"
            @click="chooseClear"
          >
            清除
          </button>
        </div>
      </div>
      <button type="button" class="solver-reset" @click="reset">重置假设</button>
    </div>
  </aside>
</template>
