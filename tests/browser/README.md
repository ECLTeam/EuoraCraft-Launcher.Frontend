# 浏览器布局回归

## 工程治理与实际页面

`test_accessibility.py` 使用真实 Vue 页面、本地固定版本 axe-core 和 Python Playwright。共 31 个场景：四种基础主题下的设置、任务、离线账户表单、实例详情、插件权限及更新弹窗，加上六语言最小窗口和德语放大窗口。插件权限与更新使用测试域 API 输入，组件本身不替换；不执行真实登录、游戏启动、授权保存或下载。

环境使用 Python Playwright 1.58.0，先安装该包及其 Chromium；本机也可设置 `PLAYWRIGHT_CHANNEL=msedge` 使用现有 Edge。Node 依赖按锁文件安装，axe 脚本从 `node_modules/axe-core` 读取，不在测试中下载远端脚本。

入口为 `pnpm test:accessibility`，默认自行启动并关闭本地 showcase Vite 服务。可传 `--url http://127.0.0.1:端口` 复用现有服务，或 `--report 路径` 指定报告。仅接受本地展示服务，测试拦截外部网络。失败、超时或场景缺失都会生成失败状态，不能以已执行的部分场景冒充通过。

采集成功表示报告完整，不表示所有规则通过。随后由主仓库 `AGENTS.md` 第 6 节的 `governance.py check` 检查违规和有限期复核；前端独立 CI 使用 `governance-revision.txt` 中固定的主仓库工具提交，统一例外来源不复制进子仓库。

报告保留 axe 原始 `violations`、`incomplete`、场景和截图。含组件生成 ID 的节点保留原始 `target`，另记录经唯一性验证的 `governance_target` 结构定位，避免随机 ID 导致误报；结构改变仍须复核。对复杂背景的未决文字另保存保守像素测量；低于阈值仍然失败，其他未决项仍须复核。引擎自检要求无名称按钮与低对比文字确实被拒绝，且更换 ID 不改变结构定位。自动扫描不能替代真实启动器、辅助技术及全部滚动状态验收。

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

## 视觉回归基线

`test_visual.py` 对四个基准页面截图并与已提交的基线逐像素比对，捕获静态检查抓不到的布局塌陷、宽度未撑满、间距失衡和溢出换行错位。

覆盖 `settings-appearance`（分区设置页）、`plugins`（单一管理面板）、`room`（无二级导航入口页）、`instance-detail`（全屏任务页），在 Classic 亮暗两种主题、1280×800 视口下各一张，共 8 张基线。

确定性来自：固定视口与主题（复用 `test_accessibility.py` 的 showcase 配置注入）、拦截外部网络、等待字体与 `data-theme`/`data-ui-skin` 就绪、注入样式关闭动画与过渡、隐藏调试工具浮层（属开发工具而非产品界面）。容差为单通道差值 8、变化像素占比上限 0.1%，抗锯齿噪声不会误报。

```powershell
# 比对（默认自行启动并关闭 showcase 服务）
$env:PLAYWRIGHT_CHANNEL = 'msedge'
python tests/browser/test_visual.py

# 确认改动符合预期后重建基线
python tests/browser/test_visual.py --update
```

基线是平台相关的：字体渲染和滚动条宽度随操作系统变化。基线在 Windows 上生成，其他平台比对失败时应复核差异后重新生成，不能直接覆盖。运行产物写入 `tests/browser/visual-output/`，不进版本库。

基线有效性的自检方式：临时把已修复的定宽写法加回去，对应页面必须失败且其他页面保持 0 变化；若全部通过说明基线已失效。重建基线前必须确认每一处差异都是预期改动，不吸收无关的页面高度或环境漂移。
