"""使用真实 Chromium 排版验证模组行内容边界；需安装 Playwright 和 Google Chrome。"""

import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


class InstanceModListLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        frontend_path = Path(__file__).resolve().parents[2]
        styles_path = frontend_path / "src" / "styles"
        cls.styles = "\n".join(
            (styles_path / name).read_text(encoding="utf-8")
            for name in ("base.css", "views/instances/InstanceDetailModal.css", "folia.css")
        )
        state_source = (frontend_path / "src/components/instances/InstanceContentState.vue").read_text(encoding="utf-8")
        cls.styles += state_source.split("<style scoped>")[1].split("</style>")[0]
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel="chrome", headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_rows_keep_content_inside_and_last_item_can_be_scrolled_into_view(self):
        page = self.browser.new_page()
        try:
            for skin in ("classic", "folia"):
                for width in (960, 860, 800, 520):
                    for count in (1, 10, 272):
                        with self.subTest(skin=skin, width=width, count=count):
                            page.set_viewport_size({"width": width, "height": 600})
                            rows = "".join(self.mod_row(index) for index in range(count))
                            page.set_content(
                                f'<html data-ui-skin="{skin}"><head><style>{self.styles}</style></head>'
                                '<body><div class="mods-page" style="height:400px;width:100%">'
                                '<div class="mods-panel"><div class="mods-panel-content">'
                                '<div class="instance-content-state"><div class="mods-list">'
                                f"{rows}</div></div></div></div></div></body></html>"
                            )
                            overflow = page.locator(".mod-list-row").evaluate_all(
                                """rows => rows.flatMap((row, index) => {
                                    const box = row.getBoundingClientRect();
                                    const style = getComputedStyle(row);
                                    const top = box.top + parseFloat(style.paddingTop);
                                    const bottom = box.bottom - parseFloat(style.paddingBottom)
                                        - (parseFloat(style.borderBottomWidth) || 0);
                                    return [...row.children].filter(child => {
                                        const content = child.getBoundingClientRect();
                                        return content.top < top - 0.5 || content.bottom > bottom + 0.5;
                                    }).map(child => ({ index, className: child.className, height: box.height }));
                                })"""
                            )
                            self.assertEqual(overflow, [], f"模组内容溢出: {overflow[:3]}")
                            self.assertEqual(page.locator(".mod-list-row").count(), count)
                            last = page.locator(".mod-list-row").last
                            last.scroll_into_view_if_needed()
                            self.assertTrue(last.is_visible())
                            contained = last.evaluate(
                                """row => {
                                    const r = row.getBoundingClientRect();
                                    const list = row.parentElement.getBoundingClientRect();
                                    return r.top >= list.top - 1 && r.bottom <= list.bottom + 1;
                                }"""
                            )
                            self.assertTrue(contained, "滚动到末项后仍被列表边界裁切")
        finally:
            page.close()

    @staticmethod
    def mod_row(index):
        original = '<span class="mod-original-name">Original Mod Name</span>' if index % 2 == 0 else ""
        metadata = '<span class="mod-list-metadata">1.2.3 · Sample Author</span>' if index % 3 != 1 else ""
        return (
            '<article class="mod-list-row"><div class="mod-list-identity">'
            '<span class="mod-list-icon">图标</span><div class="mod-list-title">'
            f"<strong>模组长名称示例 {index}</strong>{original}"
            '<span class="mod-list-filename">fabric-sample-mod-1.21.1-1.2.3.jar</span>'
            f'{metadata}</div></div><div class="mod-list-loader">FABRIC</div>'
            '<div class="mod-list-actions">已启用 开关</div></article>'
        )


if __name__ == "__main__":
    unittest.main()
