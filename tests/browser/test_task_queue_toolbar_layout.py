import json
import unittest
from os import environ
from pathlib import Path

from playwright.sync_api import sync_playwright


class TaskQueueToolbarLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frontend = Path(__file__).resolve().parents[2]
        cls.styles = "\n".join(
            (cls.frontend / relative).read_text(encoding="utf-8")
            for relative in (
                "src/styles/base.css",
                "src/styles/tokens.css",
                "src/styles/folia.css",
                "src/styles/components/panels/TaskQueuePanel.css",
            )
        )
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(channel=environ.get("PLAYWRIGHT_CHANNEL", "chrome"))
        except Exception:
            cls.playwright.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_toolbar_has_readable_surface_and_reachable_controls_over_background(self):
        page = self.browser.new_page()
        try:
            for width, height in ((960, 600), (1200, 800), (1440, 1000)):
                page.set_viewport_size({"width": width, "height": height})
                for skin in ("classic", "folia"):
                    for mode in ("light", "dark"):
                        for opacity in (1, 0.6):
                            for locale in ("zh-CN", "zh-TW", "en-US", "ja-JP", "ru-RU", "de-DE"):
                                labels = json.loads(
                                    (self.frontend / f"src/i18n/locales/{locale}.json").read_text(encoding="utf-8")
                                )["taskQueue"]
                                for disabled in (False, True):
                                    with self.subTest(
                                        width=width,
                                        skin=skin,
                                        mode=mode,
                                        opacity=opacity,
                                        locale=locale,
                                        disabled=disabled,
                                    ):
                                        page.set_content(
                                            f"<html data-ui-skin='{skin}' data-theme='{mode}' "
                                            f"style='--card-opacity:{opacity}'><style>{self.styles}</style>"
                                            "<body style='margin:0;background:repeating-linear-gradient(45deg,"
                                            "#203040 0 24px,#f5e0b0 24px 48px)'>"
                                            "<main class='task-queue-wrapper'><div class='tq-content'><div class='tq-list'>"
                                            f"<div class='tq-toolbar'><span class='tq-status-text'>{labels['allFinished']}</span>"
                                            f"<button class='tq-clear-btn' {'disabled' if disabled else ''}>"
                                            + labels["clearFinishedTasks"].replace("{count}", "0" if disabled else "2")
                                            + "</button></div></div></div></main></body></html>"
                                        )
                                        result = page.locator(".tq-toolbar").evaluate("""toolbar => {
                                            const status=toolbar.querySelector('.tq-status-text');
                                            const button=toolbar.querySelector('button');
                                            const r=toolbar.getBoundingClientRect(),s=status.getBoundingClientRect(),b=button.getBoundingClientRect();
                                            const style=getComputedStyle(toolbar);
                                            return {background:style.backgroundColor,padding:parseFloat(style.paddingLeft),
                                              contained:s.left>=r.left&&s.right<=b.left&&b.right<=r.right&&b.bottom<=r.bottom,
                                              overflow:document.documentElement.scrollWidth>innerWidth,
                                              opacity:parseFloat(getComputedStyle(button).opacity)};
                                        }""")
                                        self.assertNotIn(result["background"], ("rgba(0, 0, 0, 0)", "transparent"))
                                        self.assertGreater(result["padding"], 0)
                                        self.assertTrue(result["contained"], result)
                                        self.assertFalse(result["overflow"], result)
                                        self.assertEqual(result["opacity"], 1, "禁用文字仍须保留可读底色，不整体淡出")
                                        if not disabled:
                                            page.locator("button").focus()
                                            outline = page.locator("button").evaluate(
                                                "button=>({visible:button.matches(':focus-visible'),width:parseFloat(getComputedStyle(button).outlineWidth)})"
                                            )
                                            self.assertTrue(outline["visible"])
                                            self.assertGreaterEqual(outline["width"], 1)
        finally:
            page.close()


if __name__ == "__main__":
    unittest.main()
