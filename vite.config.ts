/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Node 25 ships a built-in experimental Web Storage `localStorage` that
    // requires a `--localstorage-file` path; without one it is a broken stub
    // that shadows jsdom's working localStorage. Disable it so jsdom wins.
    poolOptions: {
      forks: { execArgv: ['--no-experimental-webstorage'] },
      threads: { execArgv: ['--no-experimental-webstorage'] },
    },
  },
})
