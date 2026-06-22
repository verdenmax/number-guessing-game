import type { GameRecord } from './types'

const DB_NAME = 'ngg'
const DB_VERSION = 1
const STORE = 'games'
const INDEX = 'playedAt'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex(INDEX, 'playedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  dbPromise = p
  // 打开失败不缓存被拒绝的连接，允许后续重试（也避免 jsdom 无 indexedDB 时污染后续）
  p.catch(() => {
    if (dbPromise === p) dbPromise = null
  })
  return dbPromise
}

export async function saveGame(record: GameRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('saveGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('saveGame aborted'))
  })
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index(INDEX)
    const out: GameRecord[] = []
    const cursorReq = index.openCursor(null, 'prev')
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        out.push(cursor.value as GameRecord)
        cursor.continue()
      } else {
        resolve(out)
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error('listGames failed'))
    tx.onabort = () => reject(tx.error ?? new Error('listGames aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('listGames failed'))
  })
}

export async function clearAll(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('clearAll failed'))
    tx.onabort = () => reject(tx.error ?? new Error('clearAll aborted'))
  })
}

export async function getGame(id: string): Promise<GameRecord | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as GameRecord | undefined)
    req.onerror = () => reject(req.error ?? new Error('getGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('getGame aborted'))
  })
}

export async function deleteGame(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('deleteGame failed'))
    tx.onabort = () => reject(tx.error ?? new Error('deleteGame aborted'))
  })
}
