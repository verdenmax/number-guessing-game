/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Node 22.4+ ships a built-in experimental Web Storage `localStorage`. On this
// machine (Node 25) it is a broken stub that shadows jsdom's working localStorage.
// Disable it via `--no-experimental-webstorage` — but ONLY when the running Node
// actually exposes that built-in (i.e. the flag exists). On Node 20 (CI) there is
// no built-in localStorage and the flag is unknown, so we must NOT pass it.
const hasBuiltinWebStorage = typeof (globalThis as { localStorage?: unknown }).localStorage !== 'undefined'
const execArgv = hasBuiltinWebStorage ? ['--no-experimental-webstorage'] : []

export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    poolOptions: {
      forks: { execArgv },
      threads: { execArgv },
    },
  },
})
