import assert from 'node:assert/strict'

// 在隔离的原生 WebView2 中打开工具页、窗口约 960×600 后运行；检查纵向顺序和滚动可达性。
const response = await fetch(process.env.ECL_CDP_URL || 'http://127.0.0.1:9333/json')
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
          awaitPromise: true,
          expression: `(async () => {
            const area = document.querySelector('.connect-scroll-area');
            if (!area) throw Error('请先打开工具页');
            const originalScroll = area.scrollTop;
            const view = area.getBoundingClientRect();
            const cardSelectors = ['.custom-download-card', '.skin-avatar-card', '.connect-nat-card'];
            const cards = cardSelectors.map(selector => {
              const card = document.querySelector(selector);
              if (!card) throw Error('缺少工具：' + selector);
              const box = card.getBoundingClientRect();
              return {selector, left: box.left, right: box.right, top: box.top, bottom: box.bottom};
            });
            for (let index = 1; index < cards.length; index++) {
              if (cards[index].top < cards[index - 1].bottom || Math.abs(cards[index].left - cards[0].left) > 1 || Math.abs(cards[index].right - cards[0].right) > 1) {
                throw Error('工具没有依次纵向铺满内容区');
              }
            }
            if (area.scrollWidth > area.clientWidth + 1) throw Error('工具页出现横向溢出');
            const bounds = [];
            try {
              for (const selector of ['.custom-download-card .card-header', '.custom-download-actions', '.skin-avatar-card .card-header', '.skin-avatar-actions', '.connect-nat-action', '.connect-nat-body']) {
                const element = document.querySelector(selector);
                if (!element) throw Error('缺少工具控件：' + selector);
                element.scrollIntoView({block: 'center', behavior: 'instant'});
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const box = element.getBoundingClientRect();
                if (box.width <= 0 || box.height <= 0 || box.top < view.top - 1 || box.bottom > view.bottom + 1 || box.left < view.left - 1 || box.right > view.right + 1) {
                  throw Error('工具控件不能通过滚动完整到达：' + selector);
                }
                const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                if (!hit || (!element.contains(hit) && !hit.contains(element))) throw Error('工具被遮挡：' + selector);
                bounds.push({selector, top: box.top, bottom: box.bottom});
              }
            } finally { area.scrollTop = originalScroll; }
            return {viewport: {width: innerWidth, height: innerHeight}, cards, bounds};
          })()`,
        },
      })
    )
  })
  assert(
    !result.error && !result.result.exceptionDetails,
    JSON.stringify(result.error ?? result.result.exceptionDetails)
  )
  console.log('工具页纵向排列且操作滚动可达：', result.result.result.value)
} finally {
  socket.close()
}
