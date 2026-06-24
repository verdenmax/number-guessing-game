import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import ModeSelect from './components/ModeSelect.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'
import SolverPanel from './components/SolverPanel.vue'
import { botGuess } from './game/bot'

// 固定 bot 秘密/猜测，使 pve 集成可确定推进（真实算法由 bot.test.ts 覆盖）
// botGuess 用 spy，便于断言「卸载后 bot 不再出招」
vi.mock('./game/bot', async (orig) => {
  const actual = await orig<typeof import('./game/bot')>()
  return { ...actual, randomSecret: () => '5678', botGuess: vi.fn(() => '0000') }
})

// 自动 mock 历史存储：saveGame 返回 undefined（await 安全），使「到 over」不依赖 jsdom 下 saveGame 抛错
vi.mock('./history/store')

async function startPve(w: ReturnType<typeof mount>, difficulty = 'normal') {
  w.findComponent(ModeSelect).vm.$emit('select', 'pve', difficulty)
  await w.vm.$nextTick()
}

describe('App 人机对战(pve)', () => {
  it('选人机后只需玩家设秘密，bot 自动设秘密并进入对战（玩家先手）', async () => {
    const w = mount(App)
    await startPve(w)
    const sv = w.findComponent(SetupView)
    expect(sv.props('vsBot')).toBe(true)
    sv.vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick()
    const pv = w.findComponent(PlayView)
    expect(pv.exists()).toBe(true) // bot 秘密已自动设 → playing
    expect(pv.props('current')).toBe('p1') // 玩家先手
    expect(pv.props('botTurn')).toBe(false)
  })

  it('选困难后蓝方名为「🤖 电脑·困难」（结果/历史据此标记）', async () => {
    const w = mount(App)
    await startPve(w, 'hard')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).props('names')!.p2).toBe('🤖 电脑·困难')
  })

  it('玩家猜后 bot 在 ~0.8s 自动出招，落入蓝方历史并轮回玩家', async () => {
    vi.useFakeTimers()
    const w = mount(App)
    await startPve(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000') // 玩家未中 bot(5678) → current=p2
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).props('botTurn')).toBe(true) // 思考中
    expect(w.findComponent(PlayView).props('history').p2).toHaveLength(0)
    vi.advanceTimersByTime(799)
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).props('history').p2).toHaveLength(0) // 799ms 还没出招
    vi.advanceTimersByTime(1)
    await w.vm.$nextTick()
    const pv = w.findComponent(PlayView)
    // bot 出招(mock 返回 0000)，未中玩家(1234)，feedback=0
    expect(pv.props('history').p2).toEqual([{ guess: '0000', feedback: 0 }])
    expect(pv.props('current')).toBe('p1') // 双未中 → 轮回玩家
    vi.useRealTimers()
  })

  it('卸载时清除 bot 定时器：卸载后 bot 不再出招', async () => {
    vi.useFakeTimers()
    const mockedGuess = vi.mocked(botGuess)
    mockedGuess.mockClear()
    const w = mount(App)
    await startPve(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000') // 启动 bot 定时器（尚未触发）
    await w.vm.$nextTick()
    const before = mockedGuess.mock.calls.length // 此时应为 0：定时器还没触发
    w.unmount()
    vi.advanceTimersByTime(1000)
    expect(mockedGuess.mock.calls.length).toBe(before) // 卸载清了定时器→bot 未出招；若移除 onUnmounted(clearBotTimer) 则会 +1
    vi.useRealTimers()
  })

  it('pve 对局两侧 SolverPanel 都渲染（玩家可看 bot 推理）', async () => {
    const w = mount(App)
    await startPve(w)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick()
    expect(w.findAllComponents(SolverPanel)).toHaveLength(2)
  })

  it('pve 再战回模式选择且不把 bot 名带入双人局（清 names.p2）', async () => {
    vi.useFakeTimers()
    const w = mount(App)
    await startPve(w, 'hard') // names.p2 = '🤖 电脑·困难'
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    await w.vm.$nextTick() // watch 自动设 bot 秘密(mock '5678') → playing
    w.findComponent(PlayView).vm.$emit('guess', '5678') // 玩家猜中 bot 秘密 → current=p2
    await w.vm.$nextTick()
    vi.advanceTimersByTime(800) // bot 猜 '0000'(mock) 未中玩家 '1234' → 玩家胜 → over
    await flushPromises() // 让 over 时的 saveGame（store 已 mock，await 安全）落定
    expect(w.findComponent(ResultView).exists()).toBe(true)
    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    expect(w.findComponent(ModeSelect).exists()).toBe(true)
    w.findComponent(ModeSelect).vm.$emit('select', 'pvp')
    await w.vm.$nextTick()
    expect(w.findComponent(SetupView).props('names')!.p2).toBe(null) // 关键：bot 名已清，不残留给人类蓝方
    vi.useRealTimers()
  })
})
