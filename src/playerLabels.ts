import type { PlayerId } from './game/types'

export const sideName = (player: PlayerId): string => (player === 'p1' ? '红方' : '蓝方')
