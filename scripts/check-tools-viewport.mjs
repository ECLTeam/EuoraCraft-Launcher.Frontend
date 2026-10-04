import assert from 'node:assert/strict'

// 在隔离的原生 WebView2 中打开空闲工具页、窗口约 960×600 后运行。
const response = await fetch('http://127.0.0.1:9333/json')
const targets = await response.json()
const target = targets.find((item) => item.type === 'page')
assert(target, '未找到原生 WebView2 页面')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})
try {
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('工具页视口检查超时')), 10_000)
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id !== 1) return
      clearTimeout(timeout)
      resolve(message)
    })
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(() => {
            const area = document.querySelector('.connect-scroll-area');
            if (!area) throw Error('请先打开工具页');
            const view = area.getBoundingClientRect();
            const bounds = [];
            for (const selector of ['.custom-download-card', '.custom-download-actions', '.connect-nat-card', '.connect-nat-action', '.connect-nat-body']) {
              const element = document.querySelector(selector);
              if (!element) throw Error('缺少工具控件：' + selector);
              const box = element.getBoundingClientRect();
              if (box.width <= 0 || box.height <= 0 || box.top < view.top - 1 || box.bottom > view.bottom + 1 || box.left < view.left - 1 || box.right > view.right + 1) {
                throw Error('工具被挤出默认窗口：' + selector);
              }
              const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
              if (!hit || (!element.contains(hit) && !hit.contains(element))) throw Error('工具被遮挡：' + selector);
              bounds.push({selector, top: box.top, bottom: box.bottom});
            }
            return {viewport: {width: innerWidth, height: innerHeight}, bounds};
          })()`,
        },
      })
    )
  })
  assert(
    !result.error && !result.result.exceptionDetails,
    JSON.stringify(result.error ?? result.result.exceptionDetails)
  )
  console.log('工具页首屏完整可见：', result.result.result.value)
} finally {
  socket.close()
}
