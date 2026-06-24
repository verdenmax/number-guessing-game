# 双人猜数字（热座版）· Number Guessing Game

🎮 **在线试玩**：<https://verdenmax.github.io/number-guessing-game/>

> 两名玩家（**红方 / 蓝方**）在**同一台电脑**上轮流玩的猜数字小游戏：各自秘密设置一个 N 位（默认 4 位）、每位互不相同的数字，再轮流互猜。每次只得到一个 **正确数目**提示（有几位完全正确，即 Bulls），**先在一个完整回合内全部猜中者胜，同回合双方都中则平局。** 猜测阶段两侧各有一个**推理助手**辅助排除。

- 🤖 **人机对战**：开局选双人热座或挑战电脑（简单/普通/困难三档，困难为一步 minimax）。

## 玩法（3 步）

1. **设置秘密数**：红方、蓝方各自秘密设置一个 **4 位、每位互不相同**的数字（允许前导 0，如 `0891`）。中间有交接屏防窥。
2. **轮流猜**：红蓝同屏轮流猜对方的数字（猜测**允许重复数字**，如 `0290`），双方历史常驻显示。每次提交后得到**正确数目** = 有几个位置上的数字完全正确（不告诉是哪几位）。
3. **分胜负**：先在一个完整回合里把对方数字全部猜中者获胜；若同一回合双方都猜中则平局。

**正确数目示例**：

```
答案 0891，猜 0290 → 位置1(0✓)、位置3(9✓) → 正确数目 2
答案 1234，猜 4321 → 每位都不同           → 正确数目 0
答案 1234，猜 1234 → 全部命中             → 正确数目 4（达到 N，全部命中）
答案 1234，猜 1111 → 仅位置1(1✓)          → 正确数目 1
```

## 推理助手

猜测阶段，屏幕**左右两侧分别是红方、蓝方助手**（默认收起，点折叠条展开）。每个助手是 **4 列 × 10 格**网格（4 个数字位 × 0-9）：

- **自动枚举排除**：基于该方猜测历史，枚举全部「互不相同」候选并过滤，把不可能的数字置灰。
- **自动确定**：某列只剩一个可能数字时自动标绿。
- **标记**：点击/触摸任一格打开菜单，选「假设此位」做 what-if 推演（联动收窄）、「划除」手动标记不可能、「清除」撤销；一列最多一个假设。
- **矛盾标红**：假设组合无解时，被假设的格标红。
- **重置**：一键清空本面板假设与划除，回到纯事实推理。

推理为纯函数（`src/game/solver.ts`），仅复用引擎的 `feedback`，与对局逻辑独立。详见 [docs/L3-details/solver.md](./docs/L3-details/solver.md) · [docs/L4-api/solver.md](./docs/L4-api/solver.md)。

## 对局历史

每局结束**自动存入浏览器本地历史**（IndexedDB），可在「📜 历史」里查看过往对局的**双方数字与完整猜测记录**，支持**可选昵称**；可删除单局或一键清空。纯前端、与对局引擎解耦，浏览器隐私模式 / 不支持 IndexedDB 时仅内联提示、不影响游戏。详见 [docs/L2-components/history.md](./docs/L2-components/history.md) · [docs/L3-details/history-storage.md](./docs/L3-details/history-storage.md) · [docs/L4-api/history.md](./docs/L4-api/history.md)。

## 技术栈

- **Vue 3**（`<script setup>` + 组合式 API）
- **TypeScript**
- **Vite**（构建/开发服务器，`base: './'` 相对路径以适配 Pages 子目录）
- **Vitest** + `@vue/test-utils` + `jsdom`（单元/组件测试）

核心**纯逻辑引擎零 Vue 依赖**，可被 Vitest 独立穷尽测试；UI 层只负责显示与输入，严格单向数据流。

## 本地运行

> 环境为 Arch Linux，依赖装在项目本地 `node_modules`，安装命令请手动执行。

```bash
npm install      # 安装依赖（首次）
npm run dev      # 本地开发服务器（Vite）
npm run test     # 跑 Vitest 全部测试
npm run build    # vue-tsc 类型检查 + 生产构建到 dist/
```

## 部署（GitHub Pages）

推送到 `main` 即由 **GitHub Actions** 自动构建并部署到 GitHub Pages：`npm ci → build → test → upload dist → deploy`。线上地址：<https://verdenmax.github.io/number-guessing-game/>。

> ⚠️ **首次需手动一次**：仓库 **Settings → Pages → Source → 选「GitHub Actions」**（`GITHUB_TOKEN` 无权自动建站，只能部署）。之后无需再干预。

详见 [docs/L2-components/deploy.md](./docs/L2-components/deploy.md)。

## 文档导航（分层 L1–L4）

| 层级 | 文档 | 内容 |
|------|------|------|
| **L1** | [docs/L1-overview.md](./docs/L1-overview.md) | 整体概览：是什么、架构分层图、三阶段流程图、目录总览、如何运行 |
| **L2** | [engine](./docs/L2-components/engine.md) · [ui](./docs/L2-components/ui.md) · [history](./docs/L2-components/history.md) · [deploy](./docs/L2-components/deploy.md) | 各部分职责与接口：引擎层 / UI 层 / 本地历史 / 部署 |
| **L3** | [state-machine](./docs/L3-details/state-machine.md) · [handoff](./docs/L3-details/handoff.md) · [validation](./docs/L3-details/validation.md) · [solver](./docs/L3-details/solver.md) · [history-storage](./docs/L3-details/history-storage.md) | 关键细节：状态机与回合结算 / 保密交接 / 输入校验 / 推理引擎 / 历史存储 |
| **L4** | [engine](./docs/L4-api/engine.md) · [validate](./docs/L4-api/validate.md) · [useGame](./docs/L4-api/useGame.md) · [components](./docs/L4-api/components.md) · [solver](./docs/L4-api/solver.md) · [history](./docs/L4-api/history.md) | 逐文件 API：函数签名 / props·emits |

设计文档（spec）：[docs/superpowers/specs/2026-06-22-number-guessing-game-design.md](./docs/superpowers/specs/2026-06-22-number-guessing-game-design.md)

## 当前文档覆盖

| 层级 | 文件 | 状态 |
|------|------|:----:|
| L1 | `L1-overview.md` | ✅ |
| L2 | `L2-components/engine.md` | ✅ |
| L2 | `L2-components/ui.md` | ✅ |
| L2 | `L2-components/history.md` | ✅ |
| L2 | `L2-components/deploy.md` | ✅ |
| L3 | `L3-details/state-machine.md` | ✅ |
| L3 | `L3-details/handoff.md` | ✅ |
| L3 | `L3-details/validation.md` | ✅ |
| L3 | `L3-details/solver.md` | ✅ |
| L3 | `L3-details/history-storage.md` | ✅ |
| L4 | `L4-api/engine.md` | ✅ |
| L4 | `L4-api/validate.md` | ✅ |
| L4 | `L4-api/useGame.md` | ✅ |
| L4 | `L4-api/components.md` | ✅ |
| L4 | `L4-api/solver.md` | ✅ |
| L4 | `L4-api/history.md` | ✅ |
| — | `README.md` | ✅ |

## 项目结构

```
number-guessing-game/
├─ index.html  package.json  vite.config.ts  tsconfig.json
├─ src/
│  ├─ main.ts  App.vue
│  ├─ game/          # 纯引擎(零 Vue)：types.ts engine.ts validate.ts solver.ts + *.test.ts
│  ├─ history/       # 本地历史(零 Vue)：types.ts store.ts(IndexedDB) record.ts
│  ├─ composables/   # useGame.ts useHistory.ts
│  └─ components/     # SetupView SecretInput PlayView GuessInput SolverPanel
│                     #  HistoryList HandoffScreen ResultView HistoryView HistoryDetail
├─ docs/             # 分层文档 L1–L4
└─ README.md
```
