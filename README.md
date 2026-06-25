# 🎮 双人猜数字 · Number Guessing Game

[![Play Online](https://img.shields.io/badge/%F0%9F%8E%AE-Play%20Online-1a7f64?style=for-the-badge)](https://verdenmax.github.io/number-guessing-game/)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
![Tests](https://img.shields.io/badge/tests-308%20passing-brightgreen.svg)

> 两名玩家在**同一台电脑**上轮流玩的猜数字小游戏：各自悄悄设一个 4 位、每位都不一样的秘密数，再轮流互猜，**先在一回合内把对方猜中者获胜**。也可以**单人挑战电脑**（简单 / 普通 / 困难三档）。

👉 **[点此在线试玩 →](https://verdenmax.github.io/number-guessing-game/)** ｜ 纯前端，打开即玩，无需注册。

## 🎮 怎么玩

1. **设秘密数** —— 红蓝双方各自悄悄设一个 **4 位、每位都不一样**的数字（可以有前导 0，如 `0891`）。中间有交接屏防偷看。
2. **轮流猜** —— 同屏轮流猜对方的数字（猜的时候**允许重复数字**）。每猜一次只告诉你**猜对几位**（有几位的数字和位置都对），但不告诉是哪几位。
3. **分胜负** —— 先在**同一回合内**把对方 4 位全猜中的人获胜；同回合双方都猜中则平局。

> **「猜对几位」怎么算**：答案 `0891`，你猜 `0290` → 第 1 位的 `0`、第 3 位的 `9` 都对 → 提示 **2**。

## ✨ 亮点

- 👥 **双人热座**：一台设备两人对战，带防窥交接屏。
- 🤖 **人机对战**：单人挑战电脑，简单 / 普通 / 困难三档（困难为一步 minimax 最优策略）。
- 🧩 **推理助手**：4×10 网格自动排除不可能的数字，支持「假设此位」做 what-if 推演，帮你缩小范围。
- 📜 **对局历史**：每局自动存进浏览器本地（IndexedDB），可回看双方数字与完整猜测、支持昵称。
- ⚡ **纯前端零后端**：核心是零依赖的纯函数引擎，打开网页即玩，数据不出本机。

## 🚀 本地运行

> 环境为 Arch Linux，依赖装在项目本地 `node_modules`，安装命令请手动执行。

```bash
npm install    # 安装依赖（首次）
npm run dev    # 启动本地开发服务器
npm run test   # 跑全部测试（Vitest）
npm run build  # 类型检查 + 生产构建到 dist/
```

## 🛠 技术栈

**Vue 3**（`<script setup>`）+ **TypeScript** + **Vite** + **Vitest**。核心纯逻辑引擎零 Vue 依赖、可被独立穷尽测试；UI 层只负责显示与输入，严格单向数据流。

## 📚 文档 & 部署

- 📖 **完整文档**：从 [docs/L1 概览](./docs/L1-overview.md) 入手，按 **L1 概览 → L2 组件 → L3 细节 → L4 API** 分层下钻。
- 🚀 **自动部署**：推送到 `main` 即由 GitHub Actions 构建并部署到 [GitHub Pages](https://verdenmax.github.io/number-guessing-game/)。（首次需在仓库 **Settings → Pages → Source** 选「GitHub Actions」一次；详见 [部署文档](./docs/L2-components/deploy.md)。）

## 📄 License

[MIT](./LICENSE) © 2026 verdenmax
