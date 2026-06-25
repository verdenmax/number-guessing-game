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
    req.onsuccess = () => {
      const db = req.result
      // 另一 tab 触发版本升级时主动关闭，避免阻塞其升级；连接被关闭则清缓存，下次调用自动重连（自愈）
      db.onversionchange = () => db.close()
      db.onclose = () => {
        if (dbPromise === p) dbPromise = null
      }
      resolve(db)
    }
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

// 渲染前的结构校验：损坏/未来 schema 的记录直接跳过，避免后续 outcome/secrets/history 解引用导致整页崩溃
function isValidRecord(v: unknown): v is GameRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  const h = r.history as Record<string, unknown> | undefined
  return (
    typeof r.id === 'string' &&
    typeof r.playedAt === 'number' &&
    typeof r.secrets === 'object' &&
    r.secrets !== null &&
    typeof r.outcome === 'object' &&
    r.outcome !== null &&
    typeof h === 'object' &&
    h !== null &&
    Array.isArray(h.p1) &&
    Array.isArray(h.p2)
  )
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
        if (isValidRecord(cursor.value)) out.push(cursor.value)
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
