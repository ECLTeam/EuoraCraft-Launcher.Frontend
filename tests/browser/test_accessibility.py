"""扫描实际 Vue 页面；生成原始证据，由主仓库统一校验发现与例外。"""

import argparse
import base64
import importlib.metadata
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


frontend = Path(__file__).resolve().parents[2]
scenarios = ("settings", "tasks", "account-login", "instance", "permissions", "update")
themes = (("classic", "light"), ("classic", "dark"), ("folia", "light"), ("folia", "dark"))
locales = ("zh-CN", "zh-TW", "en-US", "ja-JP", "ru-RU", "de-DE")


def write_report(target, value):
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as directory:
        temporary = Path(directory) / "report.json"
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)


def revision(directory):
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=directory, text=True).strip()


def start_server():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    command = shutil.which("pnpm")
    if command is None:
        raise RuntimeError("pnpm is required")
    process = subprocess.Popen(
        [command, "exec", "vite", "--mode", "showcase", "--host", "127.0.0.1", "--port", str(port)],
        cwd=frontend, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        start_new_session=os.name != "nt",
    )
    url = f"http://127.0.0.1:{port}"
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("Vite exited before becoming ready")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return process, url
        except OSError:
            time.sleep(0.25)
    stop_server(process)
    raise RuntimeError("Vite startup timed out")


def stop_server(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, timeout=10, check=False)
    else:
        import signal
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def prepare_page(browser, url, skin, mode, locale, width=1200, height=800):
    context = browser.new_context(viewport={"width": width, "height": height}, color_scheme=mode)
    # 外部网络不参与验收，也不上传展示账户等合成数据。
    context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
    config = {"version": 1, "config": {"launcher": {"debug": False}, "ui": {
        "locale": locale, "theme": {"mode": mode, "theme_id": skin, "blur_amount": 0},
    }}}
    context.add_init_script("localStorage.setItem('euoracraft-launcher:showcase-config:v1', "
                            + json.dumps(json.dumps(config, ensure_ascii=False)) + ");")
    page = context.new_page()
    page.set_default_timeout(15000)
    page.goto(url + "/#/settings/launcher")
    page.locator("#main-content .page-container").wait_for()
    page.get_by_role("switch").first.wait_for()
    translations = json.loads((frontend / f"src/i18n/locales/{locale}.json").read_text(encoding="utf-8"))
    page.get_by_role("switch", name=translations["settings"]["disableSslVerify"], exact=True).wait_for()
    page.wait_for_function("([skin, mode]) => document.documentElement.dataset.uiSkin === skin && "
                           "document.documentElement.dataset.theme === mode", arg=[skin, mode])
    page.evaluate("async () => { await document.fonts.ready }")
    return context, page


def verify_engine(browser):
    """验证扫描与补充测量确实会拒绝已知失败，防止空运行冒充验收。"""
    page = browser.new_page()
    try:
        page.set_content('<html lang="en"><head><title>Engine check</title></head><body style="background:white">'
                         '<button></button><p id="good" style="color:black">Readable</p>'
                         '<p id="bad" style="color:#aaaaaa">Unacceptable contrast</p></body></html>')
        page.add_script_tag(path=str(frontend / "node_modules/axe-core/axe.min.js"))
        failed = page.evaluate("async () => (await axe.run(document)).violations.map(rule => rule.id)")
        assert "button-name" in failed
        result = {"incomplete": [{"id": "color-contrast", "nodes": [{"target": ["#good"]}, {"target": ["#bad"]}]}]}
        review_contrast(page, result)
        assert result["incomplete"][0]["nodes"][0]["contrast_review"]["status"] == "measured"
        assert result["incomplete"][0]["nodes"][1]["contrast_review"]["status"] == "failed"
        result["violations"] = []
        stabilize_targets(page, result)
        node = result["incomplete"][0]["nodes"][0]
        original = node["governance_target"]
        assert node["target"] == ["#good"]
        page.locator("#good").evaluate("element => element.id='next-generated-id'")
        node["target"] = ["#next-generated-id"]
        stabilize_targets(page, result)
        assert node["governance_target"] == original
    finally:
        page.close()


def open_scenario(page, scenario, locale):
    translations = json.loads((frontend / f"src/i18n/locales/{locale}.json").read_text(encoding="utf-8"))
    if scenario == "settings":
        return page.locator(".page-container")
    if scenario == "tasks":
        page.locator(".titlebar-btn-task").click()
        return page.locator(".task-queue-wrapper")
    if scenario == "account-login":
        page.goto(page.url.split("#", 1)[0] + "#/")
        page.locator(".account-actions button").first.click()
        page.get_by_role("button", name=translations["game"]["addAccount"], exact=True).click()
        page.locator('[data-account-type="offline"]').click()
        return page.locator(".account-step-content")
    if scenario == "instance":
        page.goto(page.url.split("#", 1)[0] + "#/versions")
        page.locator('button[title="详情与设置"], button[title="详情与个性化"]').first.click()
        return page.locator(".version-detail-modal")
    if scenario == "permissions":
        page.evaluate("""async () => {
          const fixtures = await import('/src/api/transport/showcase/fixtures.ts');
          fixtures.showcasePlugins[0].installation_id = 'a'.repeat(32);
          const {pluginManagementApi} = await import('/src/features/plugins/api/pluginManagementApi.ts');
          pluginManagementApi.list = async () => structuredClone(fixtures.showcasePlugins);
          pluginManagementApi.permissions = async () => ({installation_id:'a'.repeat(32),
            content_digest:'b'.repeat(64), revision:0, grant_epoch:1, error_code:null,
            required_satisfied:false, items:[{capability:'instances.read', required:true,
              decision:'deny', implemented:true, resource_refs:[], selected_resource_refs:[],
              requested_resource_refs:[], expires_at:null, grant_epoch:1}]});
          pluginManagementApi.permissionResources = async () => ({catalog_revision:1,
            items:[{resource_id:'c'.repeat(32),kind:'instance_root',label:'Example games',
              parent_ref:null,version_id:null,available:true,selected:false,is_default:true}],next_cursor:null});
          const {usePluginStore}=await import('/src/features/plugins/stores/pluginStore.ts');
          await usePluginStore().load(true);
        }""")
        # Hash navigation keeps the in-memory test fixture and real component intact.
        page.evaluate("location.hash = '#/more/plugins'")
        page.get_by_role("button", name=translations["plugins"]["permissions"], exact=True).first.click()
        page.locator(".plugin-permissions [role='checkbox']").wait_for()
        return page.locator(".plugin-permissions")
    if scenario == "update":
        page.evaluate("""async () => {
          const {useUpdateCheck}=await import('/src/features/settings/composables/useUpdateCheck.ts');
          const update=useUpdateCheck();
          update.setStartupCheckResult({status:'update_available', current_version:'0.0.1',
            channel:'beta', latest_version:'0.0.2-beta.1', latest_url:'https://example.invalid/release',
            latest_notes:'# Update\\n\\n- Keyboard and accessibility checks', message:null});
          update.updateDialogVisible.value=true;
        }""")
        return page.locator(".update-result-modal")
    raise RuntimeError("Unknown scenario")


def scan(page, name, target, output_directory=None):
    target.wait_for(state="visible")
    # 等待真实过渡和懒加载结束，不通过重写 CSS 隐藏对比度或焦点问题。
    page.wait_for_timeout(600)
    page.add_script_tag(path=str(frontend / "node_modules/axe-core/axe.min.js"))
    dialog = target.locator("xpath=ancestor-or-self::*[@role='dialog'][1]")
    scope = dialog if dialog.count() else page.locator("body")
    result = scope.evaluate("""async element => await axe.run(element, {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}
    })""")
    review_contrast(page, result)
    stabilize_targets(page, result)
    screenshot = (output_directory or frontend.parent / "build/governance") / "accessibility" / f"{name}.png"
    screenshot.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(screenshot), animations="disabled")
    return {"name": name, "elements": target.locator("*").count(), "passes": result["passes"],
            "violations": result["violations"], "incomplete": result["incomplete"],
            "viewport": page.viewport_size, "url": page.url.split("#", 1)[-1],
            "screenshot": f"accessibility/{name}.png", "scan_context": "active-dialog" if dialog.count() else "page"}


def stabilize_targets(page, result):
    """保留原始 axe 定位，为含组件生成 ID 的节点另存唯一结构定位。"""
    for rule in result["violations"] + result["incomplete"]:
        for node in rule["nodes"]:
            target = node["target"]
            if len(target) != 1 or not isinstance(target[0], str) or "#" not in target[0]:
                continue
            selector = page.locator(target[0]).evaluate("""element => {
              const parts=[];
              for(let current=element;current;current=current.parentElement){
                const tag=current.tagName.toLowerCase();
                const peers=current.parentElement ? [...current.parentElement.children].filter(e=>e.tagName===current.tagName) : [current];
                parts.unshift(tag+':nth-of-type('+(peers.indexOf(current)+1)+')');
              }
              const selector=parts.join(' > ');
              if(document.querySelectorAll(selector).length!==1 || document.querySelector(selector)!==element)
                throw new Error('Structural target is not unique');
              return selector;
            }""")
            node["governance_target"] = [selector]


def review_contrast(page, result):
    """为 axe 无法计算的背景保存保守的像素测量；仍保留人工复核要求。"""
    nodes = [node for rule in result["incomplete"] if rule["id"] == "color-contrast" for node in rule["nodes"]]
    targets = [node["target"][0] for node in nodes if len(node["target"]) == 1 and isinstance(node["target"][0], str)]
    measurements = page.evaluate("""targets => targets.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return {selector, status:'unresolved'};
      if (element.closest('[disabled], [aria-disabled="true"]')) return {selector, status:'disabled'};
      const runs = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        if (!text.textContent.trim()) continue;
        const parent = text.parentElement, style = getComputedStyle(parent);
        if (style.visibility !== 'visible' || style.display === 'none') continue;
        let opacity = 1;
        for (let e=parent;e;e=e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
        const range = document.createRange(); range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          let left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom);
          for(let e=parent.parentElement;e;e=e.parentElement) {
            const s=getComputedStyle(e),r=e.getBoundingClientRect();
            if(s.overflowX!=='visible'){left=Math.max(left,r.left);right=Math.min(right,r.right)}
            if(s.overflowY!=='visible'){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}
          }
          if(right-left<1||bottom-top<1||opacity===0)continue;
          const hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);
          if(hit&&!parent.contains(hit)&&!hit.contains(parent))continue;
          const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.667 && Number(style.fontWeight)>=700);
          runs.push({left,top,right,bottom,color:style.color,opacity,required:large?3:4.5});
        }
      }
      return {selector,status:runs.length?'measure':'not-visible',runs};
    })""", targets)
    hidden_text = page.add_style_tag(content="* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }")
    try:
        background = base64.b64encode(page.screenshot(animations="disabled", caret="hide")).decode("ascii")
    finally:
        hidden_text.evaluate("element => element.remove()")
    reviewed = page.evaluate("""async ({measurements,background}) => {
      const img=new Image();img.src='data:image/png;base64,'+background;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const palette=document.createElement('canvas').getContext('2d');
      const linear=x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4};
      const lum=c=>0.2126*linear(c[0])+0.7152*linear(c[1])+0.0722*linear(c[2]);
      return measurements.map(entry=>{
        if(entry.status!=='measure')return entry;
        let minimum=Infinity, required=4.5, failure=false;
        for(const run of entry.runs){
          palette.clearRect(0,0,1,1);palette.fillStyle=run.color;palette.fillRect(0,0,1,1);
          const fg=palette.getImageData(0,0,1,1).data,alpha=fg[3]/255*run.opacity;
          for(let y=Math.ceil(run.top);y<Math.floor(run.bottom);y++)for(let x=Math.ceil(run.left);x<Math.floor(run.right);x++){
            const i=(y*canvas.width+x)*4,bg=[pixels[i],pixels[i+1],pixels[i+2]];
            const shown=bg.map((v,j)=>fg[j]*alpha+v*(1-alpha));
            const a=lum(shown),b=lum(bg),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
            if(ratio<minimum){minimum=ratio;required=run.required}
            if(ratio<run.required)failure=true;
          }
        }
        if(!Number.isFinite(minimum))return {selector:entry.selector,status:'unresolved'};
        return {selector:entry.selector,status:failure?'failed':'measured',minimum_ratio:minimum,required_ratio:required,
          method:'text-rect-background-pixels-v1'};
      });
    }""", {"measurements": measurements, "background": background})
    by_selector = {item["selector"]: item for item in reviewed}
    for node in nodes:
        if len(node["target"]) == 1 and isinstance(node["target"][0], str):
            node["contrast_review"] = by_selector.get(node["target"][0], {"status": "unresolved"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--report", default=str(frontend.parent / "build/governance/frontend-accessibility.json"))
    arguments = parser.parse_args()
    output = Path(arguments.report).resolve()
    process = None
    envelope = {"schema_version": 1, "kind": "axe", "scope": "frontend-accessibility", "status": "failed"}
    try:
        if arguments.url:
            url = arguments.url.rstrip("/")
            if not url.startswith(("http://127.0.0.1:", "http://localhost:")):
                raise RuntimeError("Only a local showcase server is accepted")
        else:
            process, url = start_server()
        cases = []
        expected = [f"{scenario}-{skin}-{mode}-zh-CN-1200x800" for skin, mode in themes for scenario in scenarios]
        expected += [f"settings-classic-light-{locale}-960x600" for locale in locales]
        expected += ["settings-folia-dark-de-DE-1440x1000"]
        envelope["payload"] = {"expected_cases": expected, "cases": cases}
        with sync_playwright() as playwright:
            launch_options = {"channel": os.environ["PLAYWRIGHT_CHANNEL"]} if os.environ.get("PLAYWRIGHT_CHANNEL") else {}
            browser = playwright.chromium.launch(**launch_options)
            try:
                verify_engine(browser)
                for skin, mode in themes:
                    for scenario in scenarios:
                        print(f"Scanning {scenario} / {skin} / {mode}", flush=True)
                        context, page = prepare_page(browser, url, skin, mode, "zh-CN")
                        try:
                            target = open_scenario(page, scenario, "zh-CN")
                            name = f"{scenario}-{skin}-{mode}-zh-CN-1200x800"
                            cases.append(scan(page, name, target, output.parent))
                        finally:
                            context.close()
                for locale, skin, mode, width, height in [
                    *((locale, "classic", "light", 960, 600) for locale in locales),
                    ("de-DE", "folia", "dark", 1440, 1000),
                ]:
                    context, page = prepare_page(browser, url, skin, mode, locale, width, height)
                    try:
                        name = f"settings-{skin}-{mode}-{locale}-{width}x{height}"
                        cases.append(scan(page, name, page.locator(".page-container"), output.parent))
                    finally:
                        context.close()
                repository = frontend.parent if (frontend.parent / "ECL/tooling/governance.py").is_file() else frontend
                gitlinks = {"frontend": revision(frontend)}
                if repository != frontend:
                    tree = subprocess.check_output(["git", "ls-tree", "-r", "HEAD"], cwd=repository, text=True)
                    for line in tree.splitlines():
                        if line.startswith("160000 "):
                            attributes, path = line.split("\t", 1)
                            if path != "frontend":
                                gitlinks[path] = attributes.split()[2]
                metadata = {"revision": revision(repository), "gitlinks": gitlinks,
                            "tool": "axe-core", "tool_version": json.loads((frontend / "node_modules/axe-core/package.json").read_text())["version"],
                            "platform": sys.platform, "scanned_at": datetime.now(timezone.utc).isoformat(),
                            "browser": browser.version, "playwright": importlib.metadata.version("playwright")}
            finally:
                browser.close()
        envelope.update(status="complete", exit_code=0, metadata=metadata, payload={"expected_cases": expected, "cases": cases})
        print(f"Accessibility scenarios scanned: {len(cases)}")
        return 0
    except Exception as error:
        print(f"Accessibility scan failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    finally:
        write_report(output, envelope)
        if process is not None:
            stop_server(process)


if __name__ == "__main__":
    raise SystemExit(main())
