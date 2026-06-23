import { ref, watch, type Ref } from 'vue'

export type InteractionMode = 'menu' | 'gesture'

const KEY = 'ngg:solver-interaction'

function load(): InteractionMode {
  try {
    return localStorage.getItem(KEY) === 'gesture' ? 'gesture' : 'menu'
  } catch {
    return 'menu'
  }
}

// 模块级单例：所有 SolverPanel 共享同一 ref → 天然全局同步
const mode = ref<InteractionMode>(load())

watch(
  mode,
  (v) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // localStorage 不可用（隐私模式）→ 仅内存生效
    }
  },
  { flush: 'sync' },
)

export function useInteractionMode(): Ref<InteractionMode> {
  return mode
}
