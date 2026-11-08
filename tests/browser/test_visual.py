"""真实页面的视觉回归基线；锁定布局、宽度与间距。

静态检查只能证明声明符合约定，无法证明「看起来对」。本测试对基准页面截图并与
基线逐像素比对，捕获布局塌陷、宽度未撑满、间距失衡和溢出换行错位。

基线是平台相关的：字体渲染和滚动条宽度会随操作系统变化。基线在 Windows 上生成，
在其他平台比对失败时应重新生成并复核差异，不能直接覆盖。

入口：pnpm test:visual；新增或确认改动后用 --update 重建基线。
"""

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

from test_accessibility import prepare_page, start_server, stop_server

frontend = Path(__file__).resolve().parents[2]
baselines = Path(__file__).resolve().parent / "visual-baselines"

# 基准页面覆盖宿主的设置、插件管理和全屏任务页；外置联机页由真实插件验收覆盖。
scenarios = {
    "settings-appearance": {"route": "#/settings/appearance", "wait": ".appearance-settings"},
    "plugins": {"route": "#/more/plugins", "wait": ".plugins-panel"},
    "instance-detail": {
        "route": "#/versions",
        "wait": ".version-detail-modal",
        "click": 'button[title="详情与设置"], button[title="详情与个性化"]',
    },
}
themes = (("classic", "light"), ("classic", "dark"))
viewport = (1280, 800)

# 关闭动画与插入符，并隐藏调试工具浮层：它属于开发工具，不属于产品界面。
stabilize_css = """
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
.debug-tools-window { display: none !important; }
"""


def compare(baseline_path, actual_path, tolerance=8, max_ratio=0.001):
    """
    比对基线与实际截图，返回是否通过、说明和差异图。

    :param baseline_path: 已提交的基线截图
    :param actual_path: 本次截图
    :param tolerance: 单通道差值超过该值才算变化，避免抗锯齿噪声误报
    :param max_ratio: 允许的变化像素占比上限
    :return: (是否通过, 说明文字, 差异图或 None)
    """
    baseline = Image.open(baseline_path).convert("RGB")
    actual = Image.open(actual_path).convert("RGB")
    if baseline.size != actual.size:
        return False, f"尺寸不一致：基线 {baseline.size}，实际 {actual.size}", None
    difference = ImageChops.difference(baseline, actual)
    changed = difference.convert("L").point(lambda value: 255 if value > tolerance else 0)
    changed_count = changed.histogram()[255]
    ratio = changed_count / (baseline.size[0] * baseline.size[1])
    passed = ratio <= max_ratio
    detail = f"变化像素 {changed_count}（{ratio:.4%}，上限 {max_ratio:.2%}）"
    return passed, detail, (difference if not passed else None)


def capture(page, target, destination):
    """
    等目标区域稳定后截图，返回截图路径。

    :param page: 已就绪的页面
    :param target: 等待可见的区域选择器
    :param destination: 截图输出路径
    :return: 截图输出路径
    """
    page.locator(target).first.wait_for(state="visible")
    page.wait_for_timeout(700)
    page.evaluate("async () => { await document.fonts.ready }")
    page.screenshot(path=str(destination), animations="disabled", caret="hide")
    return destination


def run(update, url):
    """执行全部场景；返回失败项列表。"""
    process = None
    failures = []
    checked = 0
    try:
        if url is None:
            process, url = start_server()
        baselines.mkdir(parents=True, exist_ok=True)
        output = Path(__file__).resolve().parent / "visual-output"
        output.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=os.environ.get("PLAYWRIGHT_CHANNEL") or None)
            try:
                for skin, mode in themes:
                    context, page = prepare_page(browser, url, skin, mode, "zh-CN", *viewport)
                    try:
                        for name, scenario in scenarios.items():
                            page.goto(url + "/" + scenario["route"])
                            if scenario.get("click"):
                                page.locator(scenario["click"]).first.click()
                            # 样式注入只作用于当前文档，必须在每次导航后重新加入。
                            page.add_style_tag(content=stabilize_css)
                            actual = output / f"{name}-{skin}-{mode}.png"
                            capture(page, scenario["wait"], actual)
                            checked += 1
                            baseline = baselines / actual.name
                            if update:
                                Image.open(actual).save(baseline)
                                print(f"已更新基线：{baseline.name}")
                                continue
                            if not baseline.is_file():
                                failures.append(f"{actual.name}：缺少基线，请用 --update 生成")
                                continue
                            passed, detail, difference = compare(baseline, actual)
                            print(f"{'通过' if passed else '失败'}：{actual.name} — {detail}")
                            if not passed:
                                failures.append(f"{actual.name}：{detail}")
                                if difference is not None:
                                    difference.save(output / f"{actual.stem}-diff.png")
                    finally:
                        context.close()
            finally:
                browser.close()
        summary = {
            "checked": checked,
            "failures": failures,
            "viewport": list(viewport),
            "themes": [f"{skin}-{mode}" for skin, mode in themes],
        }
        (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"视觉回归：比对 {checked} 张，失败 {len(failures)} 张")
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return failures
    finally:
        if process is not None:
            stop_server(process)


def main():
    parser = argparse.ArgumentParser(description="真实页面视觉回归")
    parser.add_argument("--update", action="store_true", help="重建基线截图")
    parser.add_argument("--url", help="复用已运行的 showcase 服务地址")
    arguments = parser.parse_args()
    try:
        failures = run(arguments.update, arguments.url)
    except Exception as error:
        print(f"视觉回归执行失败：{type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
