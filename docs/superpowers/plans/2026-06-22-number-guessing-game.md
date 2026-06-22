# 双人猜数字游戏（热座版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 Vue 3 网页双人猜数字游戏（热座模式）：两人同机轮流秘密设置 4 位互不相同的数字并互猜，提示只给「位置且数字都对」的个数（Bulls），先完全猜中者胜，可平局；部署到 GitHub Pages。

**Architecture:** 分层架构——`src/game/` 是零 Vue 依赖的纯逻辑引擎（不可变状态 + 纯函数 + 回合状态机），`src/composables/useGame.ts` 把引擎接入 Vue 响应式，`src/components/` 只做 UI（设置/猜测/交接屏/结果）。核心逻辑用 Vitest 穷尽测试，UI 做关键路径冒烟测试。

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + @vue/test-utils（jsdom）；GitHub Actions 部署 Pages。

> **环境约定（@verdenmax，Arch Linux）：** 依赖装在项目本地 `node_modules`（非全局）。涉及 `npm install` 的安装命令在计划中写明，**执行阶段交由用户手动运行**，agent 不自行安装系统级包。

---

## 文件结构（File Structure）

| 文件 | 职责 |
|------|------|
| `package.json` | 依赖与脚本（dev/build/test） |
| `vite.config.ts` | Vite 配置：`base: './'`（相对路径）+ 内联 Vitest 配置（jsdom 环境） |
| `tsconfig.json` | TypeScript 配置 |
| `index.html` | 应用入口 HTML，挂载点 `#app` |
| `src/main.ts` | 创建并挂载 Vue 应用 |
| `src/App.vue` | 根组件：持有 `useGame()`，按 `phase` 渲染对应视图 |
| `src/game/types.ts` | 全部类型：`GameConfig` `Phase` `PlayerId` `GuessRecord` `Outcome` `GameState` `ValidationResult` |
| `src/game/validate.ts` | `validateSecret` `validateGuess` |
| `src/game/engine.ts` | `createGame` `feedback` `setSecret` `submitGuess` |
| `src/game/validate.test.ts` | 校验单元测试 |
| `src/game/engine.test.ts` | 引擎单元测试（含状态机分支） |
| `src/composables/useGame.ts` | 把引擎接入 Vue 响应式，暴露只读派生 + 操作方法 |
| `src/composables/useGame.test.ts` | 组合式流转测试 |
| `src/components/SecretInput.vue` | 单个秘密数输入框（实时校验、可隐藏为 ●） |
| `src/components/SetupView.vue` | 设置阶段：P1→交接屏→P2 |
| `src/components/GuessInput.vue` | 猜测输入框（实时校验、允许重复） |
| `src/components/HistoryList.vue` | 某玩家「猜测+提示」历史列表（可复用） |
| `src/components/HandoffScreen.vue` | 交接屏（setup 与 play 阶段复用） |
| `src/components/PlayView.vue` | 猜测阶段：当前玩家猜测 + 自己历史 + 每次轮换交接屏 |
| `src/components/ResultView.vue` | 结束：公布胜负/平局 + 公开双方秘密 + 再来一局 |
| `.github/workflows/deploy.yml` | push main → build → 部署 Pages |
| `docs/L1-overview.md` | L1：整个游戏概览 |
| `docs/L2-components/*.md` | L2：引擎层 / UI 层 / 部署 各部分职责与接口 |
| `docs/L3-details/*.md` | L3：状态机·回合结算·保密交接·校验 细节 |
| `docs/L4-api/*.md` | L4：逐文件 API |
| `README.md` | 项目说明 + 玩法 + 「当前文档覆盖」summary |

## 任务总览

- **Task 1** 项目脚手架（Vite + Vue + TS + Vitest 跑通）
- **Task 2** 核心类型定义 `src/game/types.ts`
- **Task 3** `feedback()` 提示计算（Bulls）— TDD
- **Task 4** 输入校验 `validateSecret` / `validateGuess` — TDD
- **Task 5** `createGame()` 初始化与 digits 校验 — TDD
- **Task 6** `setSecret()` 设置秘密数与阶段转移 — TDD
- **Task 7** `submitGuess()` 回合状态机（核心，多分支）— TDD
- **Task 8** `useGame()` 组合式封装 — TDD
- **Task 9** 设置视图 `SecretInput` + `HandoffScreen` + `SetupView`
- **Task 10** 猜测视图 `GuessInput` + `HistoryList` + `PlayView`（含轮换交接屏）
- **Task 11** `ResultView` + `App` 整合（端到端可玩）
- **Task 12** 分层文档 L1-L4 + README
- **Task 13** GitHub Pages 部署 workflow

> 任务详情在下方逐一展开。每个任务遵循 TDD：写失败测试 → 跑测试看失败 → 最小实现 → 跑测试看通过 → 提交。

---

### Task 1: 项目脚手架（Vite + Vue + TS + Vitest 跑通）

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/vite-env.d.ts`, `index.html`, `src/main.ts`, `src/App.vue`, `src/smoke.test.ts`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "number-guessing-game",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `npm install`
（按环境约定，执行阶段交 @verdenmax 手动运行。）
Expected: 生成 `node_modules/` 与 `package-lock.json`，无报错。

- [ ] **Step 3: 创建 `vite.config.ts`**

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: 创建 `tsconfig.json` 与 `src/vite-env.d.ts`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"]
}
```

`src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
```

- [ ] **Step 5: 创建入口文件**

`index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>双人猜数字</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`src/App.vue`:
```vue
<script setup lang="ts"></script>

<template>
  <main>
    <h1>双人猜数字</h1>
  </main>
</template>
```

- [ ] **Step 6: 创建烟雾测试 `src/smoke.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('vitest 正常工作', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 7: 运行测试确认环境就绪**

Run: `npm run test`
Expected: PASS，1 个测试通过。

- [ ] **Step 8: 运行构建确认可打包**

Run: `npm run build`
Expected: 成功，生成 `dist/`，无类型错误。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "chore: 初始化 Vite + Vue 3 + TS + Vitest 脚手架

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: 核心类型定义 `src/game/types.ts`

**Files:**
- Create: `src/game/types.ts`

> 纯类型声明，无运行时测试；编译期由 Task 3 起的引擎测试与 `npm run typecheck` 验证。

- [ ] **Step 1: 创建 `src/game/types.ts`**

```typescript
export interface GameConfig {
  digits: number
}

export type Phase = 'setup' | 'playing' | 'over'

export type PlayerId = 'p1' | 'p2'

export interface GuessRecord {
  guess: string
  feedback: number
}

export type Outcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winner: PlayerId }
  | { kind: 'draw' }

export interface GameState {
  config: GameConfig
  phase: Phase
  secrets: { p1: string | null; p2: string | null }
  current: PlayerId
  round: number
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
  pendingHits: { p1: boolean; p2: boolean }
  outcome: Outcome
}

export type ValidationResult = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（仅声明，未使用）。

- [ ] **Step 3: 提交**

```bash
git add src/game/types.ts
git commit -m "feat: 定义游戏核心类型

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: `feedback()` 提示计算（Bulls）— TDD

**Files:**
- Create: `src/game/engine.ts`, `src/game/engine.test.ts`
- Delete: `src/smoke.test.ts`

- [ ] **Step 1: 删除烟雾测试**

```bash
git rm src/smoke.test.ts
```

- [ ] **Step 2: 写失败测试 `src/game/engine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { feedback } from './engine'

describe('feedback', () => {
  it('全部位置正确返回位数', () => {
    expect(feedback('1234', '1234')).toBe(4)
  })

  it('全部位置错误返回 0（数字相同但顺序全乱）', () => {
    expect(feedback('1234', '4321')).toBe(0)
  })

  it('部分位置正确：0891 vs 0290 → 2', () => {
    expect(feedback('0891', '0290')).toBe(2)
  })

  it('猜测含重复数字时仅按位置计数：1234 vs 1111 → 1', () => {
    expect(feedback('1234', '1111')).toBe(1)
  })

  it('前导 0 正确处理：0123 vs 0999 → 1', () => {
    expect(feedback('0123', '0999')).toBe(1)
  })

  it('单位数 N=1', () => {
    expect(feedback('5', '5')).toBe(1)
    expect(feedback('5', '3')).toBe(0)
  })

  it('十位数 N=10 全对', () => {
    expect(feedback('0123456789', '0123456789')).toBe(10)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— 找不到模块 `./engine` 或 `feedback` 未定义。

- [ ] **Step 4: 最小实现 `src/game/engine.ts`**

```typescript
export function feedback(secret: string, guess: string): number {
  let bulls = 0
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) bulls++
  }
  return bulls
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，feedback 全部用例通过。

- [ ] **Step 6: 提交**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "feat: 实现 feedback 提示计算（Bulls）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: 输入校验 `validateSecret` / `validateGuess` — TDD

**Files:**
- Create: `src/game/validate.ts`, `src/game/validate.test.ts`

- [ ] **Step 1: 写失败测试 `src/game/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateSecret, validateGuess } from './validate'
import type { GameConfig } from './types'

const cfg: GameConfig = { digits: 4 }

describe('validateSecret', () => {
  it('合法的互不相同 4 位数', () => {
    expect(validateSecret('1234', cfg)).toEqual({ ok: true })
  })
  it('前导 0 合法', () => {
    expect(validateSecret('0891', cfg)).toEqual({ ok: true })
  })
  it('长度不符报错', () => {
    expect(validateSecret('123', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('空串报长度错', () => {
    expect(validateSecret('', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('含非数字字符报错', () => {
    expect(validateSecret('12a4', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
  it('有重复数字报错', () => {
    expect(validateSecret('1224', cfg)).toEqual({ ok: false, error: '每位数字必须互不相同' })
  })
})

describe('validateGuess', () => {
  it('合法猜测', () => {
    expect(validateGuess('0290', cfg)).toEqual({ ok: true })
  })
  it('允许重复数字', () => {
    expect(validateGuess('0011', cfg)).toEqual({ ok: true })
  })
  it('长度不符报错', () => {
    expect(validateGuess('029', cfg)).toEqual({ ok: false, error: '请输入 4 位数字' })
  })
  it('含非数字字符报错', () => {
    expect(validateGuess('02a0', cfg)).toEqual({ ok: false, error: '只能输入数字 0-9' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— 找不到模块 `./validate`。

- [ ] **Step 3: 最小实现 `src/game/validate.ts`**

```typescript
import type { GameConfig, ValidationResult } from './types'

function checkShape(value: string, digits: number): ValidationResult | null {
  if (value.length !== digits) {
    return { ok: false, error: `请输入 ${digits} 位数字` }
  }
  if (!/^[0-9]+$/.test(value)) {
    return { ok: false, error: '只能输入数字 0-9' }
  }
  return null
}

export function validateSecret(value: string, config: GameConfig): ValidationResult {
  const shape = checkShape(value, config.digits)
  if (shape) return shape
  if (new Set(value).size !== value.length) {
    return { ok: false, error: '每位数字必须互不相同' }
  }
  return { ok: true }
}

export function validateGuess(value: string, config: GameConfig): ValidationResult {
  const shape = checkShape(value, config.digits)
  if (shape) return shape
  return { ok: true }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/game/validate.ts src/game/validate.test.ts
git commit -m "feat: 实现秘密数与猜测的输入校验

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: `createGame()` 初始化与 digits 校验 — TDD

**Files:**
- Modify: `src/game/engine.ts`, `src/game/engine.test.ts`

- [ ] **Step 1: 在 `engine.test.ts` 追加测试**

将顶部 import 行改为：
```typescript
import { feedback, createGame } from './engine'
```

在文件末尾追加：
```typescript
describe('createGame', () => {
  it('默认位数为 4', () => {
    expect(createGame().config.digits).toBe(4)
  })
  it('可自定义位数', () => {
    expect(createGame({ digits: 6 }).config.digits).toBe(6)
  })
  it('初始状态正确', () => {
    const s = createGame()
    expect(s.phase).toBe('setup')
    expect(s.current).toBe('p1')
    expect(s.round).toBe(1)
    expect(s.secrets).toEqual({ p1: null, p2: null })
    expect(s.history).toEqual({ p1: [], p2: [] })
    expect(s.pendingHits).toEqual({ p1: false, p2: false })
    expect(s.outcome).toEqual({ kind: 'ongoing' })
  })
  it('位数为 0 抛错', () => {
    expect(() => createGame({ digits: 0 })).toThrow()
  })
  it('位数为 11 抛错', () => {
    expect(() => createGame({ digits: 11 })).toThrow()
  })
  it('位数非整数抛错', () => {
    expect(() => createGame({ digits: 3.5 })).toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— `createGame` 未导出。

- [ ] **Step 3: 在 `engine.ts` 实现 `createGame`**

在文件顶部加 import，并追加实现：
```typescript
import type { GameConfig, GameState } from './types'

const DEFAULT_DIGITS = 4

export function createGame(config: Partial<GameConfig> = {}): GameState {
  const digits = config.digits ?? DEFAULT_DIGITS
  if (!Number.isInteger(digits) || digits < 1 || digits > 10) {
    throw new Error('digits 必须是 1 到 10 之间的整数')
  }
  return {
    config: { digits },
    phase: 'setup',
    secrets: { p1: null, p2: null },
    current: 'p1',
    round: 1,
    history: { p1: [], p2: [] },
    pendingHits: { p1: false, p2: false },
    outcome: { kind: 'ongoing' },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "feat: 实现 createGame 初始化与位数校验

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: `setSecret()` 设置秘密数与阶段转移 — TDD

**Files:**
- Modify: `src/game/engine.ts`, `src/game/engine.test.ts`

- [ ] **Step 1: 在 `engine.test.ts` 追加测试**

将顶部 import 行改为：
```typescript
import { feedback, createGame, setSecret } from './engine'
```

在文件末尾追加：
```typescript
describe('setSecret', () => {
  it('P1 设置后仍处于 setup，等待 P2', () => {
    const s = setSecret(createGame(), 'p1', '1234')
    expect(s.phase).toBe('setup')
    expect(s.secrets).toEqual({ p1: '1234', p2: null })
  })
  it('P2 设置后转入 playing，P1 先手，回合 1', () => {
    let s = setSecret(createGame(), 'p1', '1234')
    s = setSecret(s, 'p2', '5678')
    expect(s.phase).toBe('playing')
    expect(s.current).toBe('p1')
    expect(s.round).toBe(1)
    expect(s.secrets).toEqual({ p1: '1234', p2: '5678' })
  })
  it('保留前导 0', () => {
    const s = setSecret(createGame(), 'p1', '0891')
    expect(s.secrets.p1).toBe('0891')
  })
  it('非 setup 阶段调用抛错', () => {
    let s = setSecret(createGame(), 'p1', '1234')
    s = setSecret(s, 'p2', '5678') // 现在是 playing
    expect(() => setSecret(s, 'p1', '4321')).toThrow()
  })
  it('重复设置同一玩家抛错', () => {
    const s = setSecret(createGame(), 'p1', '1234')
    expect(() => setSecret(s, 'p1', '4321')).toThrow()
  })
  it('非法秘密数抛错', () => {
    expect(() => setSecret(createGame(), 'p1', '1224')).toThrow()
  })
  it('不修改原状态（不可变）', () => {
    const s0 = createGame()
    setSecret(s0, 'p1', '1234')
    expect(s0.secrets.p1).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— `setSecret` 未导出。

- [ ] **Step 3: 在 `engine.ts` 实现 `setSecret`**

将顶部类型 import 改为含 `PlayerId`，并加入 validate 引用：
```typescript
import type { GameConfig, GameState, PlayerId } from './types'
import { validateSecret } from './validate'
```

追加实现：
```typescript
export function setSecret(state: GameState, player: PlayerId, value: string): GameState {
  if (state.phase !== 'setup') {
    throw new Error('只能在 setup 阶段设置秘密数')
  }
  if (state.secrets[player] !== null) {
    throw new Error(`${player} 的秘密数已设置`)
  }
  const v = validateSecret(value, state.config)
  if (!v.ok) {
    throw new Error(`非法秘密数：${v.error}`)
  }
  const secrets = { ...state.secrets, [player]: value }
  const bothSet = secrets.p1 !== null && secrets.p2 !== null
  return {
    ...state,
    secrets,
    phase: bothSet ? 'playing' : 'setup',
    current: 'p1',
    round: 1,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "feat: 实现 setSecret 设置秘密数与阶段转移

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: `submitGuess()` 回合状态机（核心）— TDD

**Files:**
- Modify: `src/game/engine.ts`, `src/game/engine.test.ts`

- [ ] **Step 1: 在 `engine.test.ts` 追加 helper 与测试**

将顶部 import 行改为：
```typescript
import { feedback, createGame, setSecret, submitGuess } from './engine'
```

在文件末尾追加（`startPlaying` 构造一个已进入 playing 的状态：P1 秘密 `1234`、P2 秘密 `5678`）：
```typescript
function startPlaying() {
  let s = createGame()
  s = setSecret(s, 'p1', '1234')
  s = setSecret(s, 'p2', '5678')
  return s
}

describe('submitGuess', () => {
  it('P1 猜后轮到 P2，本回合未结算', () => {
    const s = submitGuess(startPlaying(), '0000') // 猜 P2 的 5678，未中
    expect(s.current).toBe('p2')
    expect(s.phase).toBe('playing')
    expect(s.history.p1).toHaveLength(1)
    expect(s.history.p1[0]).toEqual({ guess: '0000', feedback: 0 })
    expect(s.pendingHits.p1).toBe(false)
  })

  it('记录正确的 feedback 值', () => {
    const s = submitGuess(startPlaying(), '5000') // 对 5678：位置1的5✓ → 1
    expect(s.history.p1[0].feedback).toBe(1)
  })

  it('一整回合都没中 → 进入下一回合、P1 先手、pendingHits 重置', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000') // P1 猜 P2，未中
    s = submitGuess(s, '0000') // P2 猜 P1，未中 → 回合末
    expect(s.phase).toBe('playing')
    expect(s.round).toBe(2)
    expect(s.current).toBe('p1')
    expect(s.pendingHits).toEqual({ p1: false, p2: false })
  })

  it('仅 P1 猜中 → P1 胜（回合末结算，P2 同回合也猜过）', () => {
    let s = startPlaying()
    s = submitGuess(s, '5678') // P1 猜中 P2 的数
    expect(s.current).toBe('p2') // 不立即结束
    expect(s.phase).toBe('playing')
    s = submitGuess(s, '0000') // P2 猜 P1，未中 → 回合末结算
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'win', winner: 'p1' })
  })

  it('仅 P2 猜中 → P2 胜', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000') // P1 未中
    s = submitGuess(s, '1234') // P2 猜中 P1 的数 → 回合末
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'win', winner: 'p2' })
  })

  it('双方同回合都猜中 → 平局', () => {
    let s = startPlaying()
    s = submitGuess(s, '5678') // P1 中
    s = submitGuess(s, '1234') // P2 也中 → 回合末
    expect(s.phase).toBe('over')
    expect(s.outcome).toEqual({ kind: 'draw' })
  })

  it('历史跨回合正确累积', () => {
    let s = startPlaying()
    s = submitGuess(s, '0000')
    s = submitGuess(s, '0000')
    s = submitGuess(s, '1000')
    s = submitGuess(s, '2000')
    expect(s.history.p1).toHaveLength(2)
    expect(s.history.p2).toHaveLength(2)
  })

  it('非 playing 阶段调用抛错', () => {
    expect(() => submitGuess(createGame(), '1234')).toThrow()
  })

  it('非法猜测抛错', () => {
    expect(() => submitGuess(startPlaying(), '12')).toThrow()
  })

  it('不修改原状态（不可变）', () => {
    const s0 = startPlaying()
    submitGuess(s0, '5678')
    expect(s0.history.p1).toHaveLength(0)
    expect(s0.current).toBe('p1')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— `submitGuess` 未导出。

- [ ] **Step 3: 在 `engine.ts` 实现 `submitGuess`**

将顶部类型 import 改为含 `GuessRecord`，并加入 validateGuess 引用：
```typescript
import type { GameConfig, GameState, PlayerId, GuessRecord } from './types'
import { validateSecret, validateGuess } from './validate'
```

追加实现：
```typescript
function otherPlayer(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1'
}

export function submitGuess(state: GameState, value: string): GameState {
  if (state.phase !== 'playing') {
    throw new Error('只能在 playing 阶段猜测')
  }
  const g = validateGuess(value, state.config)
  if (!g.ok) {
    throw new Error(`非法猜测：${g.error}`)
  }
  const player = state.current
  const opponent = otherPlayer(player)
  const secret = state.secrets[opponent] as string
  const fb = feedback(secret, value)
  const hit = fb === state.config.digits

  const record: GuessRecord = { guess: value, feedback: fb }
  const history = { ...state.history, [player]: [...state.history[player], record] }
  const pendingHits = { ...state.pendingHits, [player]: hit }

  if (player === 'p1') {
    return { ...state, history, pendingHits, current: 'p2' }
  }

  const { p1: p1Hit, p2: p2Hit } = pendingHits
  if (p1Hit && p2Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'draw' } }
  }
  if (p1Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'win', winner: 'p1' } }
  }
  if (p2Hit) {
    return { ...state, history, pendingHits, phase: 'over', outcome: { kind: 'win', winner: 'p2' } }
  }
  return {
    ...state,
    history,
    pendingHits: { p1: false, p2: false },
    round: state.round + 1,
    current: 'p1',
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，submitGuess 全部分支通过。

- [ ] **Step 5: 提交**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "feat: 实现 submitGuess 回合状态机（含公平结算与平局）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: `useGame()` 组合式封装 — TDD

**Files:**
- Create: `src/composables/useGame.ts`, `src/composables/useGame.test.ts`

- [ ] **Step 1: 写失败测试 `src/composables/useGame.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { useGame } from './useGame'

describe('useGame', () => {
  it('初始处于 setup', () => {
    expect(useGame().phase.value).toBe('setup')
  })
  it('两次 applySecret 后进入 playing，P1 先手', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.applySecret('p2', '5678')
    expect(g.phase.value).toBe('playing')
    expect(g.current.value).toBe('p1')
  })
  it('applyGuess 推进对局：P1 中 + P2 未中 → P1 胜', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.applySecret('p2', '5678')
    g.applyGuess('5678') // P1 中
    g.applyGuess('0000') // P2 未中 → 回合末结算
    expect(g.phase.value).toBe('over')
    expect(g.outcome.value).toEqual({ kind: 'win', winner: 'p1' })
  })
  it('reset 回到 setup 并清空', () => {
    const g = useGame()
    g.applySecret('p1', '1234')
    g.reset()
    expect(g.phase.value).toBe('setup')
    expect(g.state.value.secrets).toEqual({ p1: null, p2: null })
  })
  it('checkSecret / checkGuess 转发校验', () => {
    const g = useGame()
    expect(g.checkSecret('1224')).toEqual({ ok: false, error: '每位数字必须互不相同' })
    expect(g.checkGuess('0011')).toEqual({ ok: true })
  })
  it('支持自定义位数', () => {
    expect(useGame({ digits: 5 }).config.value.digits).toBe(5)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL —— 找不到模块 `./useGame`。

- [ ] **Step 3: 实现 `src/composables/useGame.ts`**

```typescript
import { ref, computed } from 'vue'
import type { GameConfig, GameState, PlayerId } from '../game/types'
import { createGame, setSecret, submitGuess } from '../game/engine'
import { validateSecret, validateGuess } from '../game/validate'

export function useGame(initial: Partial<GameConfig> = {}) {
  const state = ref<GameState>(createGame(initial))

  const applySecret = (player: PlayerId, value: string) => {
    state.value = setSecret(state.value, player, value)
  }
  const applyGuess = (value: string) => {
    state.value = submitGuess(state.value, value)
  }
  const reset = (config: Partial<GameConfig> = {}) => {
    state.value = createGame(config)
  }

  const phase = computed(() => state.value.phase)
  const current = computed(() => state.value.current)
  const round = computed(() => state.value.round)
  const outcome = computed(() => state.value.outcome)
  const config = computed(() => state.value.config)

  const checkSecret = (value: string) => validateSecret(value, state.value.config)
  const checkGuess = (value: string) => validateGuess(value, state.value.config)

  return {
    state, phase, current, round, outcome, config,
    applySecret, applyGuess, reset, checkSecret, checkGuess,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/composables/useGame.ts src/composables/useGame.test.ts
git commit -m "feat: 实现 useGame 组合式封装

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: 设置视图 `SecretInput` + `HandoffScreen` + `SetupView`

**Files:**
- Create: `src/components/SecretInput.vue`, `src/components/HandoffScreen.vue`, `src/components/SetupView.vue`, `src/components/SetupView.test.ts`

> 安全约定：所有动态文案（含校验 error）一律用文本插值 `{{ }}`，**禁止 `v-html`**。

- [ ] **Step 1: 创建 `src/components/SecretInput.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ValidationResult } from '../game/types'

const props = defineProps<{
  digits: number
  label: string
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ confirm: [value: string] }>()

const value = ref('')
const masked = ref(true)

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  value.value = raw.replace(/[^0-9]/g, '').slice(0, props.digits)
}

const result = computed(() => props.validate(value.value))
const canSubmit = computed(() => result.value.ok)
const errorText = computed(() => (result.value.ok ? '' : result.value.error))

function confirm() {
  if (!canSubmit.value) return
  emit('confirm', value.value)
  value.value = ''
}
</script>

<template>
  <div class="secret-input">
    <p class="label">{{ label }}</p>
    <div class="row">
      <input
        :type="masked ? 'password' : 'text'"
        :value="value"
        inputmode="numeric"
        :maxlength="digits"
        @input="onInput"
        @keyup.enter="confirm"
      />
      <button type="button" class="toggle" @click="masked = !masked">
        {{ masked ? '显示' : '隐藏' }}
      </button>
    </div>
    <p v-if="errorText" class="error">{{ errorText }}</p>
    <button type="button" class="confirm" :disabled="!canSubmit" @click="confirm">确认</button>
  </div>
</template>
```

- [ ] **Step 2: 创建 `src/components/HandoffScreen.vue`**

```vue
<script setup lang="ts">
defineProps<{ message: string; buttonText?: string }>()
const emit = defineEmits<{ continue: [] }>()
</script>

<template>
  <div class="handoff">
    <p class="message">{{ message }}</p>
    <button type="button" @click="emit('continue')">{{ buttonText ?? '开始' }}</button>
  </div>
</template>
```

- [ ] **Step 3: 创建 `src/components/SetupView.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { PlayerId, ValidationResult } from '../game/types'
import SecretInput from './SecretInput.vue'
import HandoffScreen from './HandoffScreen.vue'

defineProps<{
  digits: number
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ setSecret: [player: PlayerId, value: string] }>()

type Step = 'p1' | 'handoff' | 'p2'
const step = ref<Step>('p1')

function confirmP1(value: string) {
  emit('setSecret', 'p1', value)
  step.value = 'handoff'
}
function confirmP2(value: string) {
  emit('setSecret', 'p2', value)
}
</script>

<template>
  <SecretInput
    v-if="step === 'p1'"
    :digits="digits"
    :validate="validate"
    label="请【玩家1】秘密设置你的数字（玩家2 请勿看屏幕）"
    @confirm="confirmP1"
  />
  <HandoffScreen
    v-else-if="step === 'handoff'"
    message="请把电脑交给【玩家2】，准备好后点击开始"
    @continue="step = 'p2'"
  />
  <SecretInput
    v-else
    :digits="digits"
    :validate="validate"
    label="请【玩家2】秘密设置你的数字（玩家1 请勿看屏幕）"
    @confirm="confirmP2"
  />
</template>
```

- [ ] **Step 4: 写测试 `src/components/SetupView.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupView from './SetupView.vue'
import HandoffScreen from './HandoffScreen.vue'
import SecretInput from './SecretInput.vue'
import type { ValidationResult } from '../game/types'

const okValidate = (): ValidationResult => ({ ok: true })

describe('SetupView', () => {
  it('P1 确认后进入交接屏，再进入 P2 输入；依次 emit setSecret', async () => {
    const wrapper = mount(SetupView, { props: { digits: 4, validate: okValidate } })

    // 初始：P1 输入
    expect(wrapper.findComponent(SecretInput).exists()).toBe(true)
    expect(wrapper.findComponent(HandoffScreen).exists()).toBe(false)

    // P1 确认
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '1234')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(HandoffScreen).exists()).toBe(true)

    // 交接 → P2 输入
    wrapper.findComponent(HandoffScreen).vm.$emit('continue')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(SecretInput).exists()).toBe(true)

    // P2 确认
    wrapper.findComponent(SecretInput).vm.$emit('confirm', '5678')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('setSecret')
    expect(events).toEqual([['p1', '1234'], ['p2', '5678']])
  })
})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test`
Expected: PASS（引擎测试 + SetupView 流程测试全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/components/SecretInput.vue src/components/HandoffScreen.vue src/components/SetupView.vue src/components/SetupView.test.ts
git commit -m "feat: 设置视图（秘密输入 + 交接屏 + 设置流程）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: 猜测视图 `GuessInput` + `HistoryList` + `PlayView`（含轮换交接屏）

**Files:**
- Create: `src/components/GuessInput.vue`, `src/components/HistoryList.vue`, `src/components/PlayView.vue`, `src/components/PlayView.test.ts`

- [ ] **Step 1: 创建 `src/components/GuessInput.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ValidationResult } from '../game/types'

const props = defineProps<{
  digits: number
  label: string
  validate: (value: string) => ValidationResult
}>()
const emit = defineEmits<{ confirm: [value: string] }>()

const value = ref('')

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = el.value.replace(/[^0-9]/g, '').slice(0, props.digits)
  value.value = clean
  el.value = clean
}

const result = computed(() => props.validate(value.value))
const canSubmit = computed(() => result.value.ok)
const errorText = computed(() => (result.value.ok ? '' : result.value.error))

function confirm() {
  if (!canSubmit.value) return
  emit('confirm', value.value)
  value.value = ''
}
</script>

<template>
  <div class="guess-input">
    <p class="label">{{ label }}</p>
    <input
      type="text"
      :value="value"
      inputmode="numeric"
      :maxlength="digits"
      @input="onInput"
      @keyup.enter="confirm"
    />
    <p v-if="errorText" class="error">{{ errorText }}</p>
    <button type="button" class="confirm" :disabled="!canSubmit" @click="confirm">提交猜测</button>
  </div>
</template>
```

- [ ] **Step 2: 创建 `src/components/HistoryList.vue`**

```vue
<script setup lang="ts">
import type { GuessRecord } from '../game/types'
defineProps<{ records: GuessRecord[]; title?: string }>()
</script>

<template>
  <div class="history">
    <h3 v-if="title">{{ title }}</h3>
    <ol>
      <li v-for="(r, i) in records" :key="i">
        <span class="guess">{{ r.guess }}</span>
        <span class="fb">提示 {{ r.feedback }}</span>
      </li>
    </ol>
    <p v-if="records.length === 0" class="empty">还没有猜测</p>
  </div>
</template>
```

- [ ] **Step 3: 创建 `src/components/PlayView.vue`**

> 每次猜测后立即把 `awaitingHandoff` 置 true；父组件已先同步更新 `current`，故交接屏显示的是**下一个**玩家。若本回合结算为结束，父组件会卸载 PlayView 切到结果页。

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GuessRecord, PlayerId, ValidationResult } from '../game/types'
import GuessInput from './GuessInput.vue'
import HistoryList from './HistoryList.vue'
import HandoffScreen from './HandoffScreen.vue'

const props = defineProps<{
  digits: number
  current: PlayerId
  round: number
  validate: (value: string) => ValidationResult
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ guess: [value: string] }>()

const awaitingHandoff = ref(true)
const playerName = computed(() => (props.current === 'p1' ? '玩家1' : '玩家2'))
const opponentName = computed(() => (props.current === 'p1' ? '玩家2' : '玩家1'))
const currentHistory = computed(() => props.history[props.current])

function onGuess(value: string) {
  emit('guess', value)
  awaitingHandoff.value = true
}
</script>

<template>
  <HandoffScreen
    v-if="awaitingHandoff"
    :message="`请把电脑交给【${playerName}】，准备好后开始第 ${round} 回合的猜测`"
    button-text="开始猜测"
    @continue="awaitingHandoff = false"
  />
  <div v-else class="play">
    <p class="turn">第 {{ round }} 回合 · 轮到【{{ playerName }}】猜【{{ opponentName }}】的数字</p>
    <GuessInput
      :digits="digits"
      :validate="validate"
      :label="`输入你对【${opponentName}】数字的猜测`"
      @confirm="onGuess"
    />
    <HistoryList :records="currentHistory" :title="`【${playerName}】的猜测记录`" />
  </div>
</template>
```

- [ ] **Step 4: 写测试 `src/components/PlayView.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayView from './PlayView.vue'
import HandoffScreen from './HandoffScreen.vue'
import GuessInput from './GuessInput.vue'
import type { ValidationResult } from '../game/types'

const okValidate = (): ValidationResult => ({ ok: true })
const baseProps = {
  digits: 4,
  current: 'p1' as const,
  round: 1,
  validate: okValidate,
  history: { p1: [], p2: [] },
}

describe('PlayView', () => {
  it('先显示交接屏，确认后显示猜测输入', async () => {
    const w = mount(PlayView, { props: baseProps })
    expect(w.findComponent(HandoffScreen).exists()).toBe(true)
    expect(w.findComponent(GuessInput).exists()).toBe(false)
    w.findComponent(HandoffScreen).vm.$emit('continue')
    await w.vm.$nextTick()
    expect(w.findComponent(GuessInput).exists()).toBe(true)
  })

  it('提交猜测后 emit guess 并回到交接屏', async () => {
    const w = mount(PlayView, { props: baseProps })
    w.findComponent(HandoffScreen).vm.$emit('continue')
    await w.vm.$nextTick()
    w.findComponent(GuessInput).vm.$emit('confirm', '5678')
    await w.vm.$nextTick()
    expect(w.emitted('guess')).toEqual([['5678']])
    expect(w.findComponent(HandoffScreen).exists()).toBe(true)
  })
})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/components/GuessInput.vue src/components/HistoryList.vue src/components/PlayView.vue src/components/PlayView.test.ts
git commit -m "feat: 猜测视图（猜测输入 + 历史 + 轮换交接屏）

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 11: `ResultView` + `App` 整合（端到端可玩）

**Files:**
- Create: `src/components/ResultView.vue`, `src/App.test.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: 创建 `src/components/ResultView.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { GuessRecord, Outcome } from '../game/types'
import HistoryList from './HistoryList.vue'

const props = defineProps<{
  outcome: Outcome
  secrets: { p1: string | null; p2: string | null }
  history: { p1: GuessRecord[]; p2: GuessRecord[] }
}>()
const emit = defineEmits<{ playAgain: [] }>()

const resultText = computed(() => {
  if (props.outcome.kind === 'draw') return '平局！'
  if (props.outcome.kind === 'win') {
    return props.outcome.winner === 'p1' ? '玩家1 获胜！' : '玩家2 获胜！'
  }
  return ''
})
</script>

<template>
  <div class="result">
    <h2>{{ resultText }}</h2>
    <p class="reveal">玩家1 的数字：{{ secrets.p1 }}　玩家2 的数字：{{ secrets.p2 }}</p>
    <div class="histories">
      <HistoryList :records="history.p1" title="玩家1 的猜测" />
      <HistoryList :records="history.p2" title="玩家2 的猜测" />
    </div>
    <button type="button" @click="emit('playAgain')">再来一局</button>
  </div>
</template>
```

- [ ] **Step 2: 重写 `src/App.vue` 接线三视图**

```vue
<script setup lang="ts">
import { useGame } from './composables/useGame'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

const {
  phase, current, round, outcome, config, state,
  applySecret, applyGuess, checkSecret, checkGuess, reset,
} = useGame()
</script>

<template>
  <main class="app">
    <h1>双人猜数字</h1>

    <SetupView
      v-if="phase === 'setup'"
      :digits="config.digits"
      :validate="checkSecret"
      @set-secret="applySecret"
    />

    <PlayView
      v-else-if="phase === 'playing'"
      :digits="config.digits"
      :current="current"
      :round="round"
      :validate="checkGuess"
      :history="state.history"
      @guess="applyGuess"
    />

    <ResultView
      v-else
      :outcome="outcome"
      :secrets="state.secrets"
      :history="state.history"
      @play-again="reset()"
    />
  </main>
</template>
```

- [ ] **Step 3: 写端到端集成测试 `src/App.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import SetupView from './components/SetupView.vue'
import PlayView from './components/PlayView.vue'
import ResultView from './components/ResultView.vue'

describe('App 整合', () => {
  it('完整一局：双方设置 → 猜测 → 玩家1 获胜', async () => {
    const w = mount(App)
    expect(w.findComponent(SetupView).exists()).toBe(true)

    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    expect(w.findComponent(PlayView).exists()).toBe(true)

    w.findComponent(PlayView).vm.$emit('guess', '5678') // P1 猜中 P2
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '0000') // P2 未中 → 结算
    await w.vm.$nextTick()

    expect(w.findComponent(ResultView).exists()).toBe(true)
    expect(w.findComponent(ResultView).text()).toContain('玩家1 获胜')
  })

  it('再来一局回到设置阶段', async () => {
    const w = mount(App)
    w.findComponent(SetupView).vm.$emit('setSecret', 'p1', '1234')
    w.findComponent(SetupView).vm.$emit('setSecret', 'p2', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '5678')
    await w.vm.$nextTick()
    w.findComponent(PlayView).vm.$emit('guess', '1234') // 双中 → 平局结束
    await w.vm.$nextTick()
    expect(w.findComponent(ResultView).exists()).toBe(true)

    w.findComponent(ResultView).vm.$emit('playAgain')
    await w.vm.$nextTick()
    expect(w.findComponent(SetupView).exists()).toBe(true)
  })
})
```

- [ ] **Step 4: 运行测试与构建确认全绿**

Run: `npm run test`
Expected: PASS（引擎 + 组合式 + 三视图 + App 集成全部通过）。

Run: `npm run build`
Expected: 成功生成 `dist/`，无类型错误。

- [ ] **Step 5: 提交**

```bash
git add src/components/ResultView.vue src/App.vue src/App.test.ts
git commit -m "feat: 结果视图与 App 整合，端到端可玩

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 12: 分层文档 L1-L4 + README

**Files:**
- Create: `docs/L1-overview.md`, `docs/L2-components/engine.md`, `docs/L2-components/ui.md`, `docs/L2-components/deploy.md`, `docs/L3-details/state-machine.md`, `docs/L3-details/handoff.md`, `docs/L3-details/validation.md`, `docs/L4-api/engine.md`, `docs/L4-api/validate.md`, `docs/L4-api/useGame.md`, `docs/L4-api/components.md`, `README.md`

> 文档基于已实现代码撰写，内容须与代码一致。下方给出每个文件必须覆盖的内容；细节可参考 `docs/superpowers/specs/2026-06-22-number-guessing-game-design.md`。

- [ ] **Step 1: 写 `docs/L1-overview.md`（整体概览）**

必含内容：
```markdown
# L1 · 整体概览

## 这是什么
一个 Vue 3 网页双人猜数字游戏（热座模式）。两人同机轮流秘密设置 N 位（默认 4）互不相同的数字，互相猜测；每次猜测只反馈「位置且数字都对」的个数（Bulls），先完全猜中对方者胜，可平局。

## 架构分层
（粘贴三层架构图：UI 层 / useGame 组合式 / 纯逻辑引擎，说明每层职责与依赖方向：UI → useGame → engine，engine 零 Vue 依赖。）

## 三阶段流程
setup（轮流秘密设置）→ playing（轮流猜，每次轮换有交接屏）→ over（公布胜负/平局）。

## 目录总览
（列出 src/game、src/composables、src/components、docs、.github 的职责，引用文件结构表。）

## 如何运行
- 安装：`npm install`
- 开发：`npm run dev`
- 测试：`npm run test`
- 构建：`npm run build`
```

- [ ] **Step 2: 写 `docs/L2-components/` 三个文件（各部分职责与接口）**

`engine.md` 必含：引擎层定位（纯函数 + 不可变状态机，零 Vue）；三个文件 `types.ts`/`validate.ts`/`engine.ts` 的职责；对外导出函数清单（`createGame`/`feedback`/`setSecret`/`submitGuess`/`validateSecret`/`validateGuess`）；状态不可变约定；「全程字符串、绝不 parseInt」约定。

`ui.md` 必含：组件树（App / SetupView / SecretInput / PlayView / GuessInput / HistoryList / HandoffScreen / ResultView）；每个组件一句话职责；单向数据流图（输入 → useGame 方法 → 引擎 → state → computed → 重渲染）；交接屏在 setup 与 playing 的复用；「禁止 v-html」安全约定。

`deploy.md` 必含：Vite `base: './'` 相对路径原因；GitHub Actions 流程（build→test→upload→deploy）；首次需手动在 Settings→Pages→Source 选 GitHub Actions。

- [ ] **Step 3: 写 `docs/L3-details/` 三个文件（细节）**

`state-machine.md` 必含：完整状态机图；`submitGuess` 回合末四分支结算逻辑；公平性原理（先手猜中不立即结束，回合末统一结算，双中平局）；`pendingHits`/`round`/`current` 的演化。

`handoff.md` 必含：setup 阶段 P1→交接→P2 流程；playing 阶段每次猜测后 `awaitingHandoff=true`、父先更新 current 故交接屏显示下一玩家；当前玩家只看自己历史、结束才公开双方。

`validation.md` 必含：秘密数与猜测的校验规则表；校验顺序（长度→字符→唯一性）；前导 0 与重复数字的处理；引擎防御性断言（阶段非法/重复设置抛错）。

- [ ] **Step 4: 写 `docs/L4-api/` 四个文件（逐文件 API）**

`engine.md`：逐个列出函数签名与语义、参数、返回、抛错条件：
```
createGame(config?: Partial<GameConfig>): GameState   // 校验 1≤digits≤10，否则抛错
feedback(secret: string, guess: string): number       // 返回 Bulls 数
setSecret(state, player, value): GameState             // 非 setup/重复/非法值抛错；p2 设置后转 playing
submitGuess(state, value): GameState                   // 非 playing/非法值抛错；回合末结算 outcome/phase
```

`validate.md`：
```
validateSecret(value, config): ValidationResult        // N位·数字·互不相同
validateGuess(value, config): ValidationResult         // N位·数字·允许重复
```

`useGame.md`：列出返回的响应式字段（`state`/`phase`/`current`/`round`/`outcome`/`config`）与方法（`applySecret`/`applyGuess`/`reset`/`checkSecret`/`checkGuess`）。

`components.md`：逐组件列出 props 与 emits：
```
SecretInput  props{digits,label,validate}                emits{confirm:[value]}
HandoffScreen props{message,buttonText?}                 emits{continue:[]}
SetupView    props{digits,validate}                      emits{setSecret:[player,value]}
GuessInput   props{digits,label,validate}                emits{confirm:[value]}
HistoryList  props{records,title?}                       emits{}
PlayView     props{digits,current,round,validate,history} emits{guess:[value]}
ResultView   props{outcome,secrets,history}              emits{playAgain:[]}
```

- [ ] **Step 5: 写 `README.md`**

必含：
```markdown
# 双人猜数字（热座版）

两人同一台电脑轮流玩的猜数字游戏。

## 玩法
1. 双方各秘密设置一个 4 位数字（每位 0-9，互不相同，可含前导 0）。
2. 轮流猜对方的数字；每次只反馈「有几个位置上的数字完全正确」（不告诉是哪些位置）。
3. 先完全猜中对方数字者获胜；同一回合双方都猜中则平局。

## 技术栈
Vue 3 + TypeScript + Vite + Vitest。

## 本地运行
\`\`\`bash
npm install
npm run dev      # 开发
npm run test     # 单元测试
npm run build    # 生产构建
\`\`\`

## 部署
推送到 main 由 GitHub Actions 自动构建并部署到 GitHub Pages。
首次需在仓库 Settings → Pages → Source 选择「GitHub Actions」。

## 文档
- L1 概览：docs/L1-overview.md
- L2 各部分职责：docs/L2-components/
- L3 细节：docs/L3-details/
- L4 逐文件 API：docs/L4-api/

### 当前文档覆盖
| 层级 | 覆盖 |
|------|------|
| L1 | 整体概览、架构、运行 ✅ |
| L2 | 引擎层 / UI 层 / 部署 ✅ |
| L3 | 状态机 / 交接 / 校验 ✅ |
| L4 | engine / validate / useGame / components ✅ |
```

- [ ] **Step 6: 提交**

```bash
git add docs/L1-overview.md docs/L2-components docs/L3-details docs/L4-api README.md
git commit -m "docs: 补充 L1-L4 分层文档与 README

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 13: GitHub Pages 部署 workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: 本地确认构建产物使用相对路径**

Run: `npm run build && grep -o 'src="[^"]*"' dist/index.html | head -1`
Expected: 资源路径以 `./` 开头（如 `./assets/...`），证明 `base: './'` 生效，可在 Pages 子路径下正常加载。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions 部署到 Pages

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 4: 推送并启用 Pages（手动，交 @verdenmax）**

1. 在 GitHub 创建仓库并 `git remote add origin <url>` + `git push -u origin main`。
2. 仓库 **Settings → Pages → Source 选「GitHub Actions」**（GITHUB_TOKEN 无权自动建站，必须手动启用一次）。
3. 等待 Actions 跑完，访问输出的 `page_url` 验证游戏可玩。

---

## 自检（Self-Review）

- **Spec 覆盖**：提示语义/胜负(Task 3,7) · 秘密数与猜测校验(Task 4) · 位数参数(Task 5) · 设置与阶段转移(Task 6) · 公平回合结算与平局(Task 7) · 响应式封装(Task 8) · 设置/交接(Task 9) · 猜测/轮换交接(Task 10) · 结果与整合(Task 11) · 分层文档(Task 12) · Pages 部署(Task 13)。全部覆盖。
- **类型一致**：`createGame/feedback/setSecret/submitGuess/validateSecret/validateGuess` 在引擎、useGame、组件、文档中签名一致；组件 props/emits 与 App 接线一致。
- **无占位符**：所有代码步骤含完整代码与可运行命令及预期输出。

