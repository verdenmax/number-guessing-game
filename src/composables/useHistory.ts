import { ref } from 'vue'
import type { GameRecord } from '../history/types'
import { listGames, deleteGame, clearAll } from '../history/store'

export function useHistory() {
  const records = ref<GameRecord[]>([])
  const error = ref<string | null>(null)

  const load = async () => {
    try {
      records.value = await listGames()
      error.value = null
    } catch {
      error.value = '历史读取失败'
      records.value = []
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteGame(id)
    } catch {
      error.value = '历史删除失败'
      return
    }
    await load()
  }

  const clear = async () => {
    try {
      await clearAll()
    } catch {
      error.value = '历史清空失败'
      return
    }
    await load()
  }

  return { records, error, load, remove, clear }
}
