# ECL 前端协作规范

本文件约束前端子仓库，补充主仓库 [AGENTS.md](https://github.com/ECLTeam/EuoraCraft-Launcher/blob/main/AGENTS.md) 的工程流程、前端要求、测试分级和交付规则。嵌入启动器开发时同时阅读主仓库实际文件；用户已批准的工作不重复询问。

- 修改界面、公共组件、主题或样式前，阅读 [ECL 设计规范](docs/ECL_DESIGN_SYSTEM.md)；样式依据当前 ECL 变量、控件、皮肤和用户设置，不复制其他项目的视觉值或技术栈。
- 保持 Vue、TypeScript、Naive UI、自有 Ui 控件及现有目录职责。先复用当前入口，公共问题在公共实现修复；不批量替换控件、不额外建立原子层或包装框架。
- `base.css`、`tokens.css`、主题配置/`useTheme`、`folia.css` 和公共组件各自维护已有职责；页面不得覆盖用户主题、透明度或减少动效。不要为了格式一致重命名所有旧变量。
- `components/ui` 只直接依赖公共 Ui、通用工具、类型、国际化、外部库，以及检查规则列明的交互 composable；不能直接依赖业务 API、store、views、features 或其他业务组件。
- 页面样式限定作用域；公共 CSS 关键帧和 Vue 过渡归入 `animations.css`。CSS 的新增颜色、动效、important 和关键帧遵循[自动检查说明](docs/frontend-style-checks.md)，不得使用内联脚本、变量赋值或宽范围例外绕过规范。
- 用户文案保持六语言一致；异步去重、旧响应保护、状态反馈、稳定列表身份、模态焦点和滚动可达性沿用主仓库要求。
- `pnpm check` 是全量入口，包含格式、ESLint、设计检查、类型和 Vitest；`pnpm check:design` 支持本地工作区和明确提交范围。局部变更与产品 UI 验收继续按主仓库第 6 节执行，不重复无关全量测试。
- CI 必须指定设计检查前后提交；独立仓库使用前端提交，主仓库使用前后 gitlink。历史不足、解析失败、无效或过期例外必须失败，不以干净 checkout 的空 diff 代替检查。
- 变更前检查工作区与子模块状态；只提交授权范围，使用中文 Conventional Commits；先集成前端本地 main，再更新主仓库指针。本地提交不授权远端推送或发布。
