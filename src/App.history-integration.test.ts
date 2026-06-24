import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from './App.vue'
import ModeSelect from './components/ModeSelect.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import HistoryView from './components/HistoryView.vue'
import { clearAll, listGames } from './history/store'
import type { GameRecord } from './history/types'

// 端到端：不 mock store，使用真实(fake-)IndexedDB。
// 捕获“记录残留 Vue 响应式 Proxy → saveGame 结构化克隆抛 DataCloneError → 历史静默保存失败”
// 这一类回归——仅 mock store 的测试无法发现。
async function playToWin(w: ReturnType<typeof mount>) {
  w.findComponent(ModeSelect).vm.$emit('select', 'pvp')
  await w.vm.$nextTick()
  w.findComponent(SetupView).vm.$emit('setName', 'p1', 'Alice')
  w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '0123')
  w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '4567')
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '4567') // p1 命中 p2
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '9999') // p2 未中 → over
  await flushPromises()
}

// App 的 watch 在 over 时异步 saveGame；fake-indexeddb 用宏任务，flushPromises 不足以等待落库，
// 故用 vi.waitFor 轮询 store 直到记录真正写入（若 saveGame 抛错则永不满足 → 超时失败）。
async function waitForSaved(count: number) {
  await vi.waitFor(async () => {
    expect(await listGames()).toHaveLength(count)
  })
}

describe('App 历史真实持久化（真实 IndexedDB，不 mock store）', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('玩完一局后记录真的落库且历史视图列出该局（saveGame→listGames 端到端）', async () => {
    const w = mount(App)
    await playToWin(w)
    await waitForSaved(1)

    await w.find('.nav-history').trigger('click')
    // 同理：load() 的 listGames 也是异步落库后才返回，轮询直到 UI 拿到记录
    await vi.waitFor(() => {
      expect(w.findComponent(HistoryView).props('records')).toHaveLength(1)
    })

    const view = w.findComponent(HistoryView)
    const records = view.props('records') as GameRecord[]
    expect(records[0].secrets).toEqual({ p1: '0123', p2: '4567' })
    expect(records[0].outcome).toEqual({ kind: 'win', winner: 'p1' })
    expect(records[0].names).toEqual({ p1: 'Alice', p2: null })
    expect(view.props('error')).toBeNull()
  })
})
