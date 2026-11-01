import unittest
from os import environ
from pathlib import Path

from playwright.sync_api import sync_playwright


class ButtonLoadingContrastTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        frontend = Path(__file__).resolve().parents[2]
        button_css = (frontend / "src/styles/components/ui/Button.css").read_text(encoding="utf-8")
        # Vue 编译 scoped :deep 时，子组件选择器不附加当前组件的作用域属性。
        cls.button_css = button_css.replace(":deep(.ui-loading)", ".ui-loading")
        cls.loading_css = (frontend / "src/styles/components/ui/Loading.css").read_text(encoding="utf-8")
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel=environ.get("PLAYWRIGHT_CHANNEL", "chrome"))

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_loading_ring_follows_each_button_foreground(self):
        page = self.browser.new_page()
        try:
            page.set_content(
                "<style>:root { --primary: #a54cf0; --primary-button: #8834cd; "
                "--accent: #a54cf0; --text-primary: #222; --text-secondary: #444; "
                "--text-on-error: #000; --error: #d95763; }</style>"
                f"<style>{self.loading_css}\n{self.button_css}</style>"
                + "".join(
                    f'<button class="ui-btn btn-{variant}"><span class="ui-loading">'
                    '<svg><circle class="ui-loading__ring-arc" /></svg></span>Loading</button>'
                    for variant in ("primary", "secondary", "outline", "text", "danger", "ghost")
                )
                + '<span class="standalone ui-loading"><svg><circle class="ui-loading__ring-arc" />'
                "</svg></span>"
            )
            for variant in ("primary", "secondary", "outline", "text", "danger", "ghost"):
                button = page.locator(f".btn-{variant}")
                foreground = button.evaluate("element => getComputedStyle(element).color")
                stroke = button.locator("circle").evaluate("element => getComputedStyle(element).stroke")
                self.assertEqual(stroke, foreground, variant)
            standalone = page.locator(".standalone circle").evaluate("element => getComputedStyle(element).stroke")
            self.assertEqual(standalone, "rgb(165, 76, 240)")
        finally:
            page.close()


if __name__ == "__main__":
    unittest.main()
