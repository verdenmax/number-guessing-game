# 双人猜数字游戏（热座版）设计文档

- 日期：2026-06-22
- 状态：已与用户确认，待转入实施计划
- 作者：与 @verdenmax 协作 brainstorming

## 1. 概述与目标

实现一个**网页双人猜数字游戏**。两名玩家在**同一台电脑上轮流操作**（热座 / hot-seat 模式），各自秘密设置一个数字，然后互相猜测对方的数字。每次猜测后，答主只告知「有几个位置上的数字完全正确」，先完全猜中对方数字的一方获胜。

**基础版**固定为 4 位数；架构上把「位数」作为参数（默认 4），为「未来可更改位数」预留零成本扩展。

## 2. 已确认的需求决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 对战形式 | 同一台电脑轮流（热座），纯前端，无后端 |
| 2 | 提示语义 | **Bulls**：统计「位置且数字都正确」的个数；不告知位置，不告知「数字对但位置错」 |
| 3 | 胜利条件 | 提示达到 N（默认 4），即完全猜中对方数字（含顺序） |
| 4 | 秘密数约束 | N 位、每位 0-9、**互不相同**，允许前导 0（如 `0891`） |
| 5 | 猜测约束 | N 位、每位 0-9、**允许重复**（如 `0290`、`0011`） |
| 6 | 公平性 | 先手猜中**不立即结束**，回合末统一结算，保证双方猜测次数相等；双方同回合都猜中则**平局** |
| 7 | 技术栈 | Vue 3 + Vite + Vitest |
| 8 | 部署 | GitHub Pages（GitHub Actions 构建部署） |
| 9 | 位数 | 基础版固定 4；引擎以 `digits` 参数支持 1..10 |
| 10 | 交接屏 | 设置阶段与猜测阶段**每次轮换都插入交接屏**（仪式感 + 防窥）；当前玩家只看自己的猜测历史 |

### 提示计算示例（验证）

```
feedback(secret, guess) = 统计 secret[i] === guess[i] 的位置数（Bulls）

answer 0891, guess 0290 → 位置1(0✓) 位置3(9✓)          → 提示 2
answer 1234, guess 4321 → 每位都不同                     → 提示 0
answer 1234, guess 1234 → 全部相同                       → 提示 4（胜利）
answer 1234, guess 1111 → 仅位置1(1✓)                    → 提示 1（猜测允许重复）
```

## 3. 游戏流程与状态机

三个阶段：`setup`（轮流秘密设置）→ `playing`（轮流猜）→ `over`（结束）。

```
[setup_p1] --P1提交秘密数--> [setup_p2] --P2提交秘密数--> [round: P1_turn]

[round: P1_turn] --P1 猜 P2 的数--> 记录 p1Hit=(提示==N) --> [round: P2_turn]
[round: P2_turn] --P2 猜 P1 的数--> 记录 p2Hit=(提示==N) --> 回合末结算：
        p1Hit && p2Hit → [over: 平局]
        仅 p1Hit       → [over: P1 胜]
        仅 p2Hit       → [over: P2 胜]
        都没中          → round++，重置 pendingHits → [round: P1_turn]
```

**公平性原理**：先手第 k 次猜中时，后手只猜了 k-1 次；回合末结算 = 强制给后手第 k 次机会。两人都中→平局；仅一方中→该方胜。胜负只在「一个完整回合（P1 猜 + P2 猜）结束」时结算。

## 4. 架构：分层（纯逻辑引擎 + Vue UI）

```
┌─────────────────────────────────┐
│  Vue UI 层 (components/)          │  只负责显示与收集输入
├─────────────────────────────────┤
│  useGame() 组合式封装             │  把引擎接入 Vue 响应式
├─────────────────────────────────┤
│  纯逻辑引擎 (game/) 零 Vue 依赖   │  校验·算提示·回合状态机·判胜负
└─────────────────────────────────┘
```

- 核心逻辑（校验、算提示、回合/胜负状态机）抽成**与框架无关的纯 TypeScript 模块**，可被 Vitest 独立穷尽测试。
- 「改位数」只是参数；「未来联网」只需替换「对手输入来源」，引擎可复用。

## 5. 核心逻辑引擎（`src/game/`）

### 5.1 数据结构（不可变状态快照）

```typescript
interface GameConfig { digits: number }            // 位数 N，默认 4
type Phase = 'setup' | 'playing' | 'over'
type PlayerId = 'p1' | 'p2'

interface GuessRecord { guess: string; feedback: number }   // feedback = Bulls 数

type Outcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winner: PlayerId }
  | { kind: 'draw' }

interface GameState {
  config: GameConfig
  phase: Phase
  secrets: { p1: string | null; p2: string | null }   // 明文；UI 绝不渲染对方的
  current: PlayerId                                    // 当前轮到谁猜
  round: number                                        // 回合数，从 1 开始
  history: { p1: GuessRecord[]; p2: GuessRecord[] }    // 各自猜测历史
  pendingHits: { p1: boolean; p2: boolean }            // 本回合是否已猜中（回合末结算用）
  outcome: Outcome
}

type ValidationResult = { ok: true } | { ok: false; error: string }
```

### 5.2 纯函数 API

```typescript
createGame(config?: Partial<GameConfig>): GameState     // 进入 setup，等 p1；校验 1≤digits≤10
validateSecret(value: string, config: GameConfig): ValidationResult   // N位·数字·互不相同
setSecret(state: GameState, player: PlayerId, value: string): GameState // p2 设置后转 playing
validateGuess(value: string, config: GameConfig): ValidationResult     // N位·数字·允许重复
feedback(secret: string, guess: string): number          // 核心：Bulls 数
submitGuess(state: GameState, value: string): GameState   // 算提示·记历史·回合末结算
```

### 5.3 `submitGuess` 状态转移（伪代码）

```
assert state.phase == 'playing'
player = state.current; opponent = 另一方
fb = feedback(state.secrets[opponent], value)
history[player].push({ guess: value, feedback: fb })
pendingHits[player] = (fb === config.digits)

if player == 'p1':
    current = 'p2'                                   // 同回合，轮到后手
else:                                                // 回合末结算
    if   pendingHits.p1 && pendingHits.p2: outcome = draw;        phase = over
    elif pendingHits.p1:                   outcome = win('p1');   phase = over
    elif pendingHits.p2:                   outcome = win('p2');   phase = over
    else: round += 1; pendingHits = {p1:false, p2:false}; current = 'p1'
return 新的 GameState
```

### 5.4 设计要点

1. **状态不可变**：每次返回新对象，利于 Vue 响应式 diff、单元测试、未来加「回放/悔棋」。
2. **`feedback` 独立纯函数**：最易测，是规则核心。
3. **引擎不管 UI 交接屏**：交接屏是 UI 层职责，引擎只认两次 `setSecret` 与若干 `submitGuess`。
4. **明文 secret**：单机热座不做加密；UI 永不渲染对方 secret，结束后才公开。联网版才需服务端保管 secret（扩展点）。
5. **全程字符串**：秘密数与猜测一律以字符串存储与比较，**绝不 `parseInt`**（避免丢前导 0）。

## 6. Vue UI 组件结构与数据流

### 6.1 `useGame()` 组合式封装（`src/composables/useGame.ts`）

```typescript
function useGame() {
  const state = ref<GameState>(createGame())
  const applySecret = (p: PlayerId, v: string) => { state.value = setSecret(state.value, p, v) }
  const applyGuess  = (v: string)              => { state.value = submitGuess(state.value, v) }
  const reset       = (cfg?: Partial<GameConfig>) => { state.value = createGame(cfg) }
  const phase   = computed(() => state.value.phase)
  const current = computed(() => state.value.current)
  const outcome = computed(() => state.value.outcome)
  return { state, phase, current, outcome, applySecret, applyGuess, reset,
           validateSecret, validateGuess }
}
```

### 6.2 组件树

```
App.vue                  根：持有 useGame()，依 phase 渲染对应视图
├─ SetupView.vue         设置阶段：轮流秘密输入 + 交接屏
│   └─ SecretInput.vue   单个秘密输入框（实时校验、可隐藏为 ●）
├─ PlayView.vue          猜测阶段：当前玩家猜测 + 自己的历史
│   ├─ GuessInput.vue    猜测输入（实时校验）
│   └─ HistoryList.vue   猜测+提示历史列表（可复用）
├─ HandoffScreen.vue     交接屏（setup 与 play 阶段复用）
└─ ResultView.vue        结束：公布胜负/平局 + 公开双方秘密 + 再来一局
```

### 6.3 交接屏（仪式感 + 防窥）

- **设置阶段**：「请玩家1 设置（玩家2 勿看）」→ P1 输入（可隐藏 ●）→ 确认（立即清屏）→ 交接屏「请把电脑交给玩家2」→ P2 输入 → 进入 playing。
- **猜测阶段**：每次轮换都插入交接屏。P1 猜完 → 交接屏「请交给玩家2」→ P2 猜 → 交接屏「请交给玩家1」→…
- **交接屏是 UI 层本地状态**（如 `awaitingHandoff` ref），引擎状态机不感知。
- **当前玩家只看自己的猜测历史**（对对方数字的推理）；对方历史不显示，结束后 `ResultView` 才公开双方秘密与完整历史。

### 6.4 数据流（严格单向）

```
用户输入 → 组件调用 useGame 方法 → 引擎纯函数算出新 state
        → state.value 替换 → computed 派生更新 → 视图重渲染
```

UI 永不直接修改 state，只经 `useGame` → 引擎。校验文案来自引擎 `ValidationResult.error`。

## 7. 错误处理与输入校验

| 场景 | 秘密数 | 猜测 |
|------|--------|------|
| 长度 ≠ N | 「请输入 N 位数字」 | 「请输入 N 位数字」 |
| 含非 0-9 字符 | 「只能输入数字 0-9」 | 「只能输入数字 0-9」 |
| 有重复数字 | 「每位数字必须互不相同」 | ✅ 允许重复，不校验 |

**边界**：

- **前导 0**：全程字符串，绝不 `parseInt`（`0891`、`0011` 必须正确）。
- **输入过滤**：输入框 `maxlength=N` + 仅允许数字键入；引擎层二次校验（不信任 UI）。
- **空提交**：提交按钮在校验未通过时 `disabled`。
- **digits 范围**：`1 ≤ digits ≤ 10`（秘密数需互不相同，最多 10 个不同数字）；`createGame` 校验越界。
- **引擎防御性断言**：`submitGuess` 在 `phase≠playing`、`setSecret` 在阶段非法/重复设置时抛错——保护编程错误，非用户可见错误。

**UI 错误展示**：输入框下方实时红字提示 `error`；按钮按 `ok` 启用/禁用；交接屏与结果屏无错误态。

## 8. 测试策略（Vitest）

重心在纯引擎层穷尽 corner case；组件层做关键路径冒烟测试。

**引擎层**：

- `feedback()`：全对(=N)、全错(`1234`/`4321`=0)、`0891`/`0290`=2、重复猜(`1234`/`1111`=1)、前导 0、N=1 与 N=10 边界。
- `validateSecret()`：正确、长度不符、非数字、重复数字报错、空串、前导 0 合法。
- `validateGuess()`：正确、允许重复、长度不符、非数字、空串。
- `createGame()`：默认 N=4、自定义、越界(0 / 11)、初始状态正确。
- `setSecret()`：p1 后仍 setup、p2 后转 playing(current=p1,round=1)、非法阶段/重复设置抛错。
- **`submitGuess()` 状态机（最关键）**：P1 猜后未结算；回合末四分支（都没中→下一回合、仅 P1 中、仅 P2 中、**双中→平局**）；历史累积；完整一局模拟。

**组件层**（@vue/test-utils）：`useGame` 流转；三视图关键路径（设置→交接→猜测→结果）冒烟测试。

> 可使用专门的 subagent 集中编写引擎层测试，便于发现核心逻辑问题。

## 9. 项目结构与分层文档

```
number-guessing-game/
├─ index.html  package.json  vite.config.ts  tsconfig.json  （vitest 配置）
├─ .github/workflows/deploy.yml      # Actions → Pages
├─ src/
│  ├─ main.ts  App.vue
│  ├─ game/          # 纯引擎(零Vue)：types.ts engine.ts validate.ts + *.test.ts
│  ├─ composables/   # useGame.ts
│  └─ components/     # SetupView SecretInput PlayView GuessInput
│                     #  HistoryList HandoffScreen ResultView
├─ docs/             # 分层文档 L1-L4
│  ├─ L1-overview.md          # 整个游戏概览
│  ├─ L2-components/          # 引擎层 / UI 层 / 部署 各部分职责与接口
│  ├─ L3-details/             # 状态机·回合结算·保密交接·校验 细节
│  └─ L4-api/                 # 逐文件 API（engine/validate/useGame/各组件 props·emits）
└─ README.md         # 含「当前文档覆盖」summary
```

**文档工作方式**：边写代码边填充对应层级文档，随代码一起提交，保持 L1-L4 与 README 覆盖 summary 与代码同步。

## 10. 部署（GitHub Pages via Actions）

- **`vite base: './'`（相对路径）**：单页无路由，相对引用在任意子目录都生效，免去硬编码仓库名。
- `deploy.yml`：`push main` → `npm ci` → `npm run build` → upload `dist` → `actions/deploy-pages`。
- ⚠️ **需手动一次**：仓库 Settings → Pages → Source 选「GitHub Actions」（GITHUB_TOKEN 无权自动建站，只能部署）。
- 依赖装在项目本地 `node_modules`（非全局）。按用户环境规则（Arch Linux），`npm install` 等安装命令交由用户手动执行。

## 11. 非目标（YAGNI）与未来扩展

**基础版不做**：

- 联网 / 局域网对战（未来：加后端 + WebSocket，引擎复用，UI 的「对手来源」替换）。
- 人机 AI 对手。
- 账号、排行榜、对局持久化。
- 运行期自由切换位数的设置界面（位数已是引擎参数，未来加一个设置入口即可）。

**已为扩展预留**：位数参数化、引擎与 UI 解耦、状态不可变（利于回放）。
