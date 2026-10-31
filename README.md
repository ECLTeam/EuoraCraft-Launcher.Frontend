# EuoraCraftLauncher-UI

EuoraCraft Launcher 的 Vue 3 + TypeScript 前端，通过 PyTauri 与 Python 后端通信。

## 开发

```bash
pnpm install
pnpm dev
```

## 展示模式

展示模式使用纯前端的内存 Transport 提供账户、版本、插件、Mod、配置和进度事件示例，不依赖
PyTauri、Python 后端或本地文件。展示模式中的修改会在刷新页面后还原。

```bash
pnpm showcase
```

也可以在普通开发服务器地址后添加 `?showcase=1` 临时进入展示模式：

```text
http://localhost:5173/?showcase=1
```

展示模式会在标题栏显示 `SHOWCASE` 标识。生产桌面模式仍使用 PyTauri Transport，两者共享相同的
类型化 API 客户端。

提交代码前运行统一质量检查：

```bash
pnpm check
```

常用命令：

- `pnpm format`：自动格式化代码和文档。
- `pnpm format:check`：检查格式，不修改文件。
- `pnpm lint`：检查 Vue、TypeScript 和导入顺序。
- `pnpm lint:fix`：自动修复可安全修复的 Lint 问题。
- `pnpm typecheck`：执行严格 TypeScript 类型检查。
- `pnpm build`：类型检查并构建生产版本。
- `pnpm build:showcase`：类型检查并构建可独立展示的前端版本。

工程协作约定见主仓库的[贡献指南](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/CONTRIBUTING.md)和[项目规范](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/AGENTS.md)。项目文档见[文档索引](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/docs/README.md)。
