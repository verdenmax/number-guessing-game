import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as store from './history/store'
import App from './App.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

vi.mock('./history/store')
const mockStore = vi.mocked(store)

async function playToWin(w: ReturnType<typeof mount>) {
  w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
  w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '5678') // p1 命中 p2
  await w.vm.$nextTick()
  w.findComponent(PlayView).vm.$emit('guess', '0000') // p2 未中 → over
  await flushPromises()
}

describe('App 录入历史', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.saveGame.mockResolvedValue(undefined)
    mockStore.listGames.mockResolvedValue([])
  })

  it('一局结束恰好保存一条，字段正确', async () => {
    const w = mount(App)
    await playToWin(w)
    expect(mockStore.saveGame).toHaveBeenCalledTimes(1)
    const rec = mockStore.saveGame.mock.calls[0][0]
    expect(rec.secrets).toEqual({ p1: '1234', p2: '5678' })
    expect(rec.outcome).toEqual({ kind: 'win', winner: 'p1' })
    expect(rec.names).toEqual({ p1: null, p2: null })
    expect(rec.digits).toBe(4)
    expect(typeof rec.id).toBe('string')
  })

  it('再来一局后再次结束 → 共保存两次且 id 不同', async () => {
    const w = mount(App)
    await playToWin(w)
    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    await playToWin(w)
    expect(mockStore.saveGame).toHaveBeenCalledTimes(2)
    const id1 = mockStore.saveGame.mock.calls[0][0].id
    const id2 = mockStore.saveGame.mock.calls[1][0].id
    expect(id1).not.toBe(id2)
  })

  it('保存失败时显示 saveError，不崩', async () => {
    mockStore.saveGame.mockRejectedValueOnce(new Error('quota'))
    const w = mount(App)
    await playToWin(w)
    expect(w.findComponent(ResultView).text()).toContain('历史保存失败')
  })

  it('记录昵称：setName 后保存的 names 反映昵称（空串→null）', async () => {
    const w = mount(App)
    w.findComponent(SetupView).vm.$emit('setName', 'p1', 'Alice')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setName', 'p2', '')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000')
    await flushPromises()
    expect(mockStore.saveGame.mock.calls[0][0].names).toEqual({ p1: 'Alice', p2: null })
  })
})
