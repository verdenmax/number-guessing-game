import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import ModeSelect from './components/ModeSelect.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'

// 固定 bot 秘密/猜测，使 pve 集成可确定推进（真实算法由 bot.test.ts 覆盖）
vi.mock('./game/bot', async (orig) => {
  const actual = await orig<typeof import('./game/bot')>()
  return { ...actual, randomSecret: () => '5678', botGuess: () => '0000' }
})

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
})
