# 浏览器布局回归

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

## 任务中心顶部操作区

`test_task_queue_toolbar_layout.py` 读取现有基础样式、主题和任务面板 CSS，在有明暗纹理背景的真实浏览器页面中验证任务状态与清理按钮有底色承托，按钮禁用后仍可读，控件不重叠、不溢出且键盘焦点可见。

覆盖六语言、Classic/Folia、亮暗主题、100%/60% 卡片透明度、三个窗口尺寸，以及清理按钮可用／禁用状态，共 288 组。它补充实际 Windows 启动器中的页面和清理操作验收；不改变任务数据或后端协议。

```powershell
# 默认使用已安装的 Chrome；也可指定已安装的 Microsoft Edge。
$env:PLAYWRIGHT_CHANNEL = 'msedge'
python tests/browser/test_task_queue_toolbar_layout.py
```
