# 双人猜数字（热座版）· Number Guessing Game

> 两名玩家在**同一台电脑**上轮流玩的猜数字小游戏：各自秘密设置一个 N 位（默认 4 位）、每位互不相同的数字，再轮流互猜。每次只得到一个 **Bulls 提示**（有几位完全正确），**先在一个完整回合内全部猜中者胜，同回合双方都中则平局。**

## 玩法（3 步）

1. **设置秘密数**：玩家1、玩家2 各自秘密设置一个 **4 位、每位互不相同**的数字（允许前导 0，如 `0891`）。中间有交接屏防窥。
2. **轮流猜**：轮流猜对方的数字（猜测**允许重复数字**，如 `0290`）。每次提交后得到提示数 = **有几个位置上的数字完全正确**（不告诉是哪几位）。
3. **分胜负**：先在一个完整回合里把对方数字全部猜中者获胜；若同一回合双方都猜中则平局。

**提示示例**：

```
答案 0891，猜 0290 → 位置1(0✓)、位置3(9✓) → 提示 2
答案 1234，猜 4321 → 每位都不同           → 提示 0
答案 1234，猜 1234 → 全部命中             → 提示 4（胜利）
答案 1234，猜 1111 → 仅位置1(1✓)          → 提示 1
```

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

推送到 `main` 即由 **GitHub Actions** 自动构建并部署到 GitHub Pages：`npm ci → build → test → upload dist → deploy`。

> ⚠️ **首次需手动一次**：仓库 **Settings → Pages → Source → 选「GitHub Actions」**（`GITHUB_TOKEN` 无权自动建站，只能部署）。之后无需再干预。

详见 [docs/L2-components/deploy.md](./docs/L2-components/deploy.md)。

## 文档导航（分层 L1–L4）

| 层级 | 文档 | 内容 |
|------|------|------|
| **L1** | [docs/L1-overview.md](./docs/L1-overview.md) | 整体概览：是什么、架构分层图、三阶段流程图、目录总览、如何运行 |
| **L2** | [engine](./docs/L2-components/engine.md) · [ui](./docs/L2-components/ui.md) · [deploy](./docs/L2-components/deploy.md) | 各部分职责与接口：引擎层 / UI 层 / 部署 |
| **L3** | [state-machine](./docs/L3-details/state-machine.md) · [handoff](./docs/L3-details/handoff.md) · [validation](./docs/L3-details/validation.md) | 关键细节：状态机与回合结算 / 保密交接 / 输入校验 |
| **L4** | [engine](./docs/L4-api/engine.md) · [validate](./docs/L4-api/validate.md) · [useGame](./docs/L4-api/useGame.md) · [components](./docs/L4-api/components.md) | 逐文件 API：函数签名 / props·emits |

设计文档（spec）：[docs/superpowers/specs/2026-06-22-number-guessing-game-design.md](./docs/superpowers/specs/2026-06-22-number-guessing-game-design.md)

## 当前文档覆盖

| 层级 | 文件 | 状态 |
|------|------|:----:|
| L1 | `L1-overview.md` | ✅ |
| L2 | `L2-components/engine.md` | ✅ |
| L2 | `L2-components/ui.md` | ✅ |
| L2 | `L2-components/deploy.md` | ✅ |
| L3 | `L3-details/state-machine.md` | ✅ |
| L3 | `L3-details/handoff.md` | ✅ |
| L3 | `L3-details/validation.md` | ✅ |
| L4 | `L4-api/engine.md` | ✅ |
| L4 | `L4-api/validate.md` | ✅ |
| L4 | `L4-api/useGame.md` | ✅ |
| L4 | `L4-api/components.md` | ✅ |
| — | `README.md` | ✅ |

## 项目结构

```
number-guessing-game/
├─ index.html  package.json  vite.config.ts  tsconfig.json
├─ src/
│  ├─ main.ts  App.vue
│  ├─ game/          # 纯引擎(零 Vue)：types.ts engine.ts validate.ts + *.test.ts
│  ├─ composables/   # useGame.ts
│  └─ components/     # SetupView SecretInput PlayView GuessInput
│                     #  HistoryList HandoffScreen ResultView
├─ docs/             # 分层文档 L1–L4
└─ README.md
```
