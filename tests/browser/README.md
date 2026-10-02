# 模组列表浏览器布局回归

`test_instance_mod_list_layout.py` 使用真实 Chromium 排版，加载项目现有的基础样式、模组列表样式及共用内容容器样式。它验证每行内容位于自身内边距之内，且末项可以完整滚动到可视区域。

覆盖 classic / folia 两种皮肤、960 / 860 / 800 / 520px 视口，以及 1 / 10 / 272 项模组，混合带译名、无译名和不同信息行数。修复前，16 个大量模组场景出现内容溢出；禁止行收缩后全部通过。

该测试补充 `pnpm check` 的组件测试。jsdom 不计算实际行高，因此 CSS 布局验收必须另行执行此测试，并继续实际启动启动器验证。

## 执行

环境需要 Python、Playwright Python 包和已安装的 Google Chrome。可以使用主项目已有的验证环境，不必修改前端 Node 依赖。

在前端仓库目录执行：

```powershell
python tests/browser/test_instance_mod_list_layout.py
```

测试只创建无头浏览器及内存页面，读取本地源码，不修改实例文件，不访问远程服务。
