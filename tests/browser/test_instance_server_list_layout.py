import re
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


class InstanceServerListLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frontend = Path(__file__).resolve().parents[2]
        component = (cls.frontend / "src/components/instances/InstanceServersTab.vue").read_text(encoding="utf-8")
        cls.styles = re.search(r"<style scoped>(.*?)</style>", component, re.S).group(1).replace(
            ":deep(.n-button__icon)", ".n-button__icon"
        )
        cls.styles += "*{box-sizing:border-box}body{margin:0}.n-button{height:28px;min-width:28px;white-space:nowrap}"
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(channel="chrome")
        except Exception:
            cls.playwright.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_rows_stay_inside_and_scroll_without_compression(self):
        page = self.browser.new_page()
        try:
            for width in (960, 860, 1440):
                for count in (1, 20, 272):
                    with self.subTest(width=width, count=count):
                        page.set_viewport_size({"width": width, "height": 600})
                        rows = "".join(self.server_row(index) for index in range(count))
                        page.set_content(
                            f"<style>{self.styles}</style><section class='servers-panel' style='width:{width - 260}px;height:400px'>"
                            "<header class='servers-toolbar'>工具栏</header><div class='instance-content-state' "
                            "style='display:flex;flex:1;min-height:0;flex-direction:column'><div class='servers-content'>"
                            f"<div class='server-list'>{rows}</div></div></div></section>"
                        )
                        issues = page.locator(".server-row").evaluate_all("""rows => rows.flatMap((row,index) => {
                            const r=row.getBoundingClientRect();
                            return [...row.children].filter(child => {
                                const c=child.getBoundingClientRect();
                                return c.left<r.left-1 || c.right>r.right+1 || c.top<r.top-1 || c.bottom>r.bottom+1;
                            }).map(child=>({index,cls:child.className,width:r.width,height:r.height}));
                        })""")
                        self.assertEqual(issues, [])
                        gaps = page.locator(".server-row").evaluate_all("""rows => rows.slice(1).map((row,index) =>
                            row.getBoundingClientRect().top - rows[index].getBoundingClientRect().bottom)""")
                        self.assertTrue(all(gap <= 1 for gap in gaps), "列表行之间不应存在独立卡片间距")
                        self.assertTrue(page.locator(".server-row").evaluate_all("rows=>rows.every(r=>r.getBoundingClientRect().height>=72)"))
                        self.assertTrue(page.locator(".server-row").evaluate_all("rows=>rows.every(r=>r.scrollWidth<=r.clientWidth+1)"))
                        last = page.locator(".server-row").last
                        last.scroll_into_view_if_needed()
                        self.assertTrue(last.evaluate("""row=>{
                            const r=row.getBoundingClientRect(),p=row.closest('.servers-content').getBoundingClientRect();
                            return r.top>=p.top-1 && r.bottom<=p.bottom+1;
                        }"""))
        finally:
            page.close()

    @staticmethod
    def server_row(index):
        badges = ("<div class='server-badges'><span class='server-badge players'>5/20</span>"
                  "<span class='server-badge latency'>30 ms</span><span class='server-badge version'>Fabric 1.20.1 "
                  + "VeryLongVersion" * 12 + "</span></div>") if index % 2 == 0 else ""
        return ("<article class='server-row'><div class='server-row-main'><div class='server-icon'>图标</div>"
                "<div class='server-info'><div class='server-name-row'><span class='server-name'>"
                + "超长服务器名称" * 20 + "</span><span class='server-fav'>★</span></div>"
                "<span class='server-address'>[2001:db8:abcd:1234:5678:abcd:1234:5678]:25565</span>"
                "<p class='server-motd'>" + "超长公告" * 30 + "</p></div></div><div class='server-status'>"
                "<span class='server-status-label'>在线</span>" + badges + "</div><div class='server-actions'>"
                "<button class='n-button server-connect'><span class='n-button__icon'>▶</span>"
                "<span class='server-connect-label'>启动并连接</span></button>"
                "<button class='n-button'>⧉</button><button class='n-button'>⚙</button><button class='n-button'>×</button>"
                "</div></article>")


if __name__ == "__main__":
    unittest.main()
