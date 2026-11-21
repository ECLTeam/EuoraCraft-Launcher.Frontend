# EuoraCraft Launcher 前端

EuoraCraft Launcher（Minecraft 第三方启动器）的 Vue 3 + TypeScript 前端，以 git 子模块形式随主仓库集成，通过 PyTauri 与 Python 后端通信。

[![Stars](https://img.shields.io/github/stars/ECLTeam/EuoraCraft-Launcher?style=flat-square&label=Stars&color=f0b429)](https://github.com/ECLTeam/EuoraCraft-Launcher/stargazers)
[![License](https://img.shields.io/badge/License-GPL--3.0-3fb950?style=flat-square)](./LICENSE)
![Tech](https://img.shields.io/badge/Vue%203-TypeScript-Vite-64748b?style=flat-square)

## 开发

```bash
pnpm install
pnpm dev
```

## 展示模式

展示模式使用纯前端的内存 Transport 提供账户、版本、插件、Mod、配置和进度事件示例，不依赖
PyTauri、Python 后端或本地文件。展示模式中的修改会在刷新页面后还原，并在标题栏显示 `SHOWCASE` 标识。

```bash
pnpm showcase
```

也可以在普通开发服务器地址后添加 `?showcase=1` 临时进入展示模式。生产桌面模式使用 PyTauri Transport，两者共享相同的类型化 API 客户端。

## 提交前检查

```bash
pnpm check
```

`pnpm check` 是全量质量检查入口，依次执行格式、ESLint、设计检查、页面根类检查、类型检查和 Vitest。

常用命令：

- `pnpm format` / `pnpm format:check`：自动格式化 / 仅检查格式。
- `pnpm lint` / `pnpm lint:fix`：检查 / 自动修复 Vue、TypeScript 和导入顺序问题。
- `pnpm typecheck`：严格 TypeScript 类型检查。
- `pnpm test` / `pnpm test:watch`：运行 Vitest 单元测试 / 监听模式。
- `pnpm check:design`：检查新增或修改的 CSS 与 Vue style 声明，支持指定 Git 提交范围。
- `pnpm build` / `pnpm build:showcase`：类型检查并构建生产版本 / 可独立展示的前端版本。

## 相关文档

- [项目规范](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/AGENTS.md)与[贡献指南](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/CONTRIBUTING.md)
- [文档索引](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/docs/README.md)
- [前端协作规范](AGENTS.md)：目录职责、UI 组件边界、国际化与可访问性要求
- [ECL 设计规范](docs/ECL_DESIGN_SYSTEM.md)：主题变量、控件与样式约定
- [样式自动检查说明](docs/frontend-style-checks.md)：新增样式约束、Git/CI 范围与例外
