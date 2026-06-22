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
    await deleteGame(id)
    await load()
  }

  const clear = async () => {
    await clearAll()
    await load()
  }

  return { records, error, load, remove, clear }
}
