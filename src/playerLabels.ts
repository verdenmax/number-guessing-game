import type { PlayerId } from './game/types'

export const sideName = (
  player: PlayerId,
  names?: { p1: string | null; p2: string | null },
): string => names?.[player]?.trim() || (player === 'p1' ? '红方' : '蓝方')
