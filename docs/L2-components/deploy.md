# L2 · 部署（GitHub Pages via Actions）

> 上层：[L1 概览](../L1-overview.md) ｜ 相关：[设计 spec §10](../../superpowers/specs/2026-06-22-number-guessing-game-design.md)

## 为什么用 `base: './'`（相对路径）

`vite.config.ts` 里设置：

```typescript
export default defineConfig({
  base: './',          // ← 相对路径
  plugins: [vue()],
  ...
})
```

本游戏是**单页、无路由**应用。GitHub Pages 通常把站点托管在子目录（如 `https://<user>.github.io/<repo>/`）。若用默认的绝对根路径 `/`，构建产物里 `/assets/xxx.js` 会指向域名根，在子目录下 404。

设为 `base: './'` 后，`dist/index.html` 引用资源用**相对路径**（`./assets/xxx.js`），无论部署到根目录还是任意子目录都生效，**免去硬编码仓库名**，也方便本地 `npm run preview` 与离线打开。

## GitHub Actions 流程

工作流（`.github/workflows/deploy.yml`）在 `push` 到 `main` 时触发，按 **build → test → upload → deploy** 推进：

```mermaid
flowchart LR
    Push([push main]) --> CI[checkout + setup-node]
    CI --> Install[npm ci 安装依赖]
    Install --> Build[npm run build → dist/]
    Build --> Test[npm run test 跑 Vitest]
    Test --> Upload[upload-pages-artifact 上传 dist/]
    Upload --> Deploy[actions/deploy-pages 部署]
    Deploy --> Live([GitHub Pages 上线])
```

ASCII 版：

```
push main
  └─ checkout 代码
  └─ setup-node（启用 npm 缓存）
  └─ npm ci                 # 干净安装（按 lockfile）
  └─ npm run build          # vue-tsc 类型检查 + vite build → dist/
  └─ npm run test           # vitest run，确保逻辑正确才发布
  └─ actions/upload-pages-artifact（path: dist）
  └─ actions/deploy-pages   # 部署到 Pages 环境
```

关键点：

- **`npm ci`** 而非 `npm install`：按 `package-lock.json` 干净、可重现地安装。
- **build 调用 `vue-tsc --noEmit`**（见 `package.json` 的 `build` 脚本），类型错误会让构建失败，阻止坏代码上线。
- **test 步骤**用 `vitest run` 一次性跑全部用例；任何用例失败都中止部署。
- 部署用官方 `actions/upload-pages-artifact` + `actions/deploy-pages`，工作流需具备 `pages: write` 与 `id-token: write` 权限。

## ⚠️ 首次需手动启用一次

`GITHUB_TOKEN` 无权自动**创建** Pages 站点，只能向已启用的站点**部署**。因此**首次部署前需手动操作一次**：

```
仓库 → Settings → Pages → Build and deployment → Source → 选择「GitHub Actions」
```

选好后再推送 `main`（或重跑工作流），Actions 即可成功部署。之后无需再手动干预。

## 依赖与本机环境

- 依赖装在项目本地 `node_modules`（非全局），与 CI 的 `npm ci` 一致。
- 本机为 **Arch Linux**：`npm install` 等安装命令请**手动执行**，不要全局安装。
