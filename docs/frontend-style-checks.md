# 新增样式自动检查

本检查执行 [ECL 设计规范](ECL_DESIGN_SYSTEM.md) 中可可靠判定的部分。规则和 Git 对比代码位于 `scripts/design-style-rules.mjs`、`design-style-git.mjs` 和 `check-design-styles.mjs`；不改变产品样式，不依赖外部设计服务，也不向产品 bundle 注入开发工具。

## 1. 使用与范围

```sh
pnpm check:design
pnpm check:design --base <前端提交>
pnpm check:design --base <前端基线提交> --target <前端目标提交>
pnpm check:design --superproject .. --base <主仓库基线提交> --target <主仓库目标提交>
pnpm check:page-root
```

本地默认比较前端 HEAD 与工作区，包含暂存、未暂存和未跟踪的源码文件。扫描 `src/**/*.css` 和 `.vue` 的 CSS style 块，排除 `src/generated/`；不扫描 dist、node_modules、用户运行目录或第三方插件。

每次解析当前完整集合并核对例外；以文件、style 块身份、祖先 at-rule/选择器、属性、值及重复次数识别新违规。新增文件全部检查，改值、换选择器、复制到新文件或增加重复声明都受检；纯格式移动和未改的存量声明不阻塞本次提交。删除项不要求修复。

仅扫描 CSS 不等于全站视觉验证：JS/TS 配色逻辑、Vue 模板的动态 style、Canvas 及外部运行时样式仍需人工和实际界面验收。Vue 外部 style 只能指向受管 src 内 CSS；未知语言和解析错误不能跳过。合法 CSS 值的业务含义和浏览器最终级联也不由本工具完全验证。

## 2. 首批规则

| 规则                     | 失败条件                                                                                         | 建议修正                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `literal-color`          | 组件/页面颜色属性、渐变、阴影或变量中新增十六进制、命名颜色或字面颜色函数，含 var fallback       | 使用已接线语义颜色；真正内容固有色登记精确例外                     |
| `literal-motion`         | transition/animation 及其 duration/delay/timing-function，或局部变量中新增非零字面时长、字面缓动 | 使用当前 duration/easing；零时长、none 等关闭表达允许              |
| `literal-geometry`       | `max-width`、`min-width`、`max-height` 新增纯像素值                                              | 主表面撑满内容区；确需限宽用语义变量或登记精确例外                 |
| `keyframe-owner`         | 在 `src/styles/animations.css` 以外新增 CSS 关键帧                                               | 归入已有公共动画入口，或说明独立生命周期并登记例外                 |
| `important-owner`        | 新增 !important 声明                                                                             | 先解决级联和 API；确需表达所有权时登记精确例外                     |
| `ecl-design/ui-boundary` | 公共 Ui 直接导入具体业务模块，包括别名、相对路径、动态导入、重导出、require                      | 将业务编排留在消费方；通过 props、事件和公开工具组合               |
| `ecl-design/ui-entry`    | 公共 Ui 目录之外直接引用 `@/components/ui/` 下的文件，包括别名、动态导入、重导出、require        | 统一从 `@/components/ui` 导入，控件清单见 `components/ui/index.ts` |

颜色允许 `transparent`、`currentColor`、继承关键字及使用变量派生的颜色。字符串和 URL 内容不当成颜色声明；几何、细边框、百分比、零值和图标尺寸不做机械数字禁用。

主题所有者仅限 `base.css`、`tokens.css`、`folia.css`、`main.css` 的合法根/皮肤变量定义，以及 main.css 的 Tailwind `@theme` 变量。它们并非整文件豁免：普通 `.card {color:white}` 等新声明同样失败。JS 中主题调色板和 Naive UI overrides 由原所属模块维护，不属于 CSS 扫描范围。

Ui 依赖边界作用于生产 `components/ui/**/*.{vue,ts,js,mjs}`，测试文件可搭建业务 fixture。直接允许 Ui、utils、types、i18n、必要外部库，以及当前列明的 `useRequestScope`、`useAsyncAction`；新增通用 composable 允许项须说明真实调用方。该规则不检查所有传递依赖，不宣称禁止了一切业务副作用。

`ui-entry` 作用于 `components/ui/` 之外的生产源码，测试文件与 `components/ui/` 内部不受限制：后者需要直接引用同层文件，否则与 barrel 形成循环依赖。`components/ui/index.ts` 是控件清单的唯一真源，新增或下线控件必须同步登记，规则只检查调用方是否绕过入口，不检查清单是否完整。

`literal-geometry` 只约束把内容区限死在固定像素的写法：属性限于 `max-width`、`min-width`、`max-height`，值必须是纯像素长度且不为零。`width`、`height`、`min-height` 不在此列，图标几何、细边框、百分比、零值、`var()`、`calc()`、`min()` 等复合值，以及 `@media`、`@container` 的断点参数都允许直接表达。主表面撑满内容区的契约见 [ECL 设计规范](ECL_DESIGN_SYSTEM.md) 第 5.1 节。

### 2.1 页面根类检查

`pnpm check:page-root` 由 `scripts/check-page-root-class.mjs` 执行，与增量样式检查不同，**每次都核对 `src/views/**` 全量视图**，否则存量违规永远不会再次触发。

判定规则：

- 根元素 class 含 `ecl-page` 或 `tab-pane` 视为已落到公共骨架；
- 根元素是 `SectionLayout`、`FullscreenModal`、`Modal`、`ConfirmDialog`、`ErrorModal` 时由布局壳内部负责骨架，调用方不必重复声明；
- 其余一律不符合，包括自建页面根类和无法静态判定的动态 `:class`（数组、变量、含 `${}` 的模板字符串）。

存量页面登记在脚本的 `pendingMigration` 清单内，允许暂时不符合。**迁移到公共骨架后必须同步删除对应条目**：清单里已修复的条目会导致检查失败（`过期条目`），清单外出现新的不符合项同样失败。目标形态见 [ECL 设计规范](ECL_DESIGN_SYSTEM.md) 第 8 章「页面根类收敛清单」。

该检查只看模板根元素，不验证内部结构、宽度实际渲染结果或多根元素片段的语义，仍需按第 5 节做真实浏览器验收。

## 3. CI 和 Git 对象

`pnpm check` 已包含设计检查。CI 中必须提供：

- `ECL_DESIGN_BASE`：独立前端 PR 的 base SHA 或 push before SHA；手动运行由 `design_base` 输入指定。
- `ECL_DESIGN_TARGET`：实际受检提交（PR 为 checkout 的 merge commit）。
- 主仓库额外设置 `ECL_DESIGN_SUPERPROJECT=..`，将前后主仓库提交转换为真实 frontend gitlink。
- `ECL_DESIGN_DEFAULT_BRANCH`：用于新分支首次 push 的共同祖先查找。

两处工作流保留完整提交历史；主仓库模式缺少 gitlink 对象时，仅获取主仓库已记录的完整 SHA，不改变检出状态。前端源内容和例外均读取目标提交，不能借 CI 工作区中的另一份例外放行。

主仓库发行构建也执行 `pnpm check`，因此同步传入范围：标签构建比较当前主仓库提交与其父提交，此前增量由 main 的质量 CI 连续验证；手动构建要求填写主仓库 `design_base`。这不触发构建、推送或发布，也不改变已有发布资格检查。

新分支 push 的 before 全零时，查找目标和 `origin/<默认分支>` 的共同祖先，覆盖该分支全部新增变更。默认分支/共同祖先不存在、得到目标自身而无法确定首次变更范围，或其他 Git 对象缺失时失败并要求指定有效基线；不回退成空覆盖或自行接受全仓历史违规。手动 workflow 输入为所属仓库的基线提交，主仓库和前端 SHA 不混用。

输出明确说明工作区/前端提交/主仓库 gitlink 来源、前后摘要、解析文件数、变更文件数、新增命中及有效例外数。无相关样式变化可以通过，但仍报告范围并解析当前集合；历史不足或解析失败不得声称“无变化”。

## 4. 有期限的精确例外

`scripts/design-style-exceptions.json` 初始为空。例外必须通过当前功能评审确认，描述原因、所有者、边界和退出条件；不自动生成例外，不接受整文件哈希或目录忽略。

每个条目严格包含 `file`、`rule`、`context`、`property`、`value`、`reason`、`owner`、`expires` 八项字符串。`file` 为 src 内相对路径；`context` 为工具输出的 JSON 上下文；`value` 为精确声明值，important 声明包含 ` !important`。`expires` 使用 UTC 日历日期 `YYYY-MM-DD`，当日有效、次日起失效。多条同值声明不共享一个例外。

例如当前受检源码确有 `.brand {color:#123456}` 时，审阅后可使用如下结构；占位示例不能原样放入正式空文件：

```json
{
  "exceptions": [
    {
      "file": "src/styles/views/Brand.css",
      "rule": "literal-color",
      "context": "[\"css\",\".brand\"]",
      "property": "color",
      "value": "#123456",
      "reason": "示例：内容固有品牌图例，不随用户强调色变化；待资源化后移除",
      "owner": "frontend",
      "expires": "2026-12-01"
    }
  ]
}
```

不含行号使格式整理不致失效；文件、上下文、规则、属性和值必须精确匹配唯一现存命中。过期、重复、无理由、未知字段、宽路径、已删除或超出唯一范围都失败。删除例外对应的声明时，同步移除例外；延期需重新审阅。

## 5. 验证及局限

规则用例覆盖 CSS/SFC、多样式块、颜色变体、注释/字符串、渐变和 fallback、动效简写/长属性、几何像素与复合值、关键帧、合法值与例外。页面根类用例覆盖公共骨架、布局壳、自建根类、动态 class 与全量清单一致性。Git 用例通过真实临时仓库验证暂存/未暂存/新文件、删除/重命名、干净 checkout、独立提交和主仓库 gitlink；异常缺历史明确失败。ESLint 用例验证合法公共入口及多种反向导入写法。

调整工具、ESLint 或 CI 时执行受影响仓库全量 `pnpm check` 和构建，并核对 Git 事件接线。调整产品视觉时按主仓库第 6 节在真实浏览器查看布局、主题和相关状态；仅涉及原生能力或浏览器无法验证的行为时，再做对应原生验收。不能用静态令牌命中、测试数量或没有代码 diff 来宣称全站视觉统一、全部可访问性合规或远端 CI 通过。
