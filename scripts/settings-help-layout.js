async function verifySettingsHelp(page) {
  // 使用 playwright-cli run-code --filename scripts/settings-help-layout.js 执行。
  // 仅连接本地展示模式，配置只写入该浏览器会话的演示存储。
  const origin = new URL(page.url()).origin
  if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('需要本地预览地址')
  const storageKey = 'euoracraft-launcher:showcase-config:v1'
  const previous = await page.evaluate((key) => localStorage.getItem(key), storageKey)
  const results = []
  let checkpoint = ''
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const configure = async (theme, mode, locale, effects) => {
    await page.evaluate(
      ({ storageKey, theme, mode, locale, effects }) => {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            config: {
              launcher: { debug: false },
              ui: {
                locale,
                theme: {
                  theme_id: theme,
                  mode,
                  transparent_bg: effects,
                  blur_amount: effects ? 10 : 0,
                  appearance: { card_opacity: effects ? 70 : 100 },
                },
                background: {
                  opacity: effects ? 0.7 : 1,
                  image: {
                    type: effects ? 'custom' : 'none',
                    image_base64: effects
                      ? 'data:image/svg+xml,' +
                        encodeURIComponent(
                          '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600"><rect width="960" height="600" fill="#45679a"/><circle cx="700" cy="200" r="300" fill="#8c659b"/></svg>'
                        )
                      : '',
                  },
                },
              },
            },
          })
        )
      },
      { storageKey, theme, mode, locale, effects }
    )
  }
  const verify = async (route, name) => {
    checkpoint = `${name}: 进入页面`
    await page.goto(`${origin}/?showcase=1&helpCheck=${encodeURIComponent(name)}#/settings/${route}`)
    await page.locator('.setting-item').first().waitFor({ state: 'visible' })
    const buttons = page.locator('.setting-help')
    assert((await buttons.count()) > 0, `${name}: 缺少详情入口`)
    for (const [index, button] of [buttons.first(), buttons.last()].entries()) {
      checkpoint = `${name}: 按钮 ${index + 1} Enter 打开`
      await button.scrollIntoViewIfNeeded()
      await button.focus()
      await button.press('Enter')
      const content = page.locator('.setting-details')
      await content.waitFor({ state: 'visible' })
      assert((await button.getAttribute('aria-expanded')) === 'true', `${name}: 展开状态错误`)
      const bounds = await content.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: innerWidth,
          height: innerHeight,
          overflow: element.scrollWidth > element.clientWidth + 1,
        }
      })
      assert(
        bounds.left >= 0 && bounds.top >= 0 && bounds.right <= bounds.width && bounds.bottom <= bounds.height,
        `${name}: 详情超出窗口 ${JSON.stringify(bounds)}`
      )
      assert(!bounds.overflow, `${name}: 详情横向溢出`)
      await content.focus()
      await page.keyboard.press('Escape')
      await content.waitFor({ state: 'hidden' })
      assert((await button.getAttribute('aria-expanded')) === 'false', `${name}: Esc 未关闭详情`)
      assert(await button.evaluate((element) => document.activeElement === element), `${name}: 焦点未恢复`)
      await page.keyboard.press('Space')
      checkpoint = `${name}: 按钮 ${index + 1} Space 打开`
      await content.waitFor({ state: 'visible' })
      await button.click()
      await content.waitFor({ state: 'hidden' })
    }
    const overlaps = await page.locator('.setting-item').evaluateAll((rows) =>
      rows.flatMap((row) => {
        const info = row.querySelector('.setting-info')
        const control = row.querySelector('.setting-control')
        if (!info || !control) return []
        const text = info.getBoundingClientRect()
        const input = control.getBoundingClientRect()
        return text.right > input.left + 1 || info.scrollWidth > info.clientWidth + 1 ? [info.textContent?.trim()] : []
      })
    )
    assert(overlaps.length === 0, `${name}: 说明挤压控件 ${JSON.stringify(overlaps)}`)
    results.push(name)
  }
  try {
    for (const theme of ['classic', 'folia']) {
      for (const mode of ['light', 'dark']) {
        for (const [width, height] of [
          [960, 600],
          [1200, 800],
          [1600, 1000],
        ]) {
          await page.setViewportSize({ width, height })
          await configure(theme, mode, 'zh-CN', width === 960)
          for (const route of ['launcher', 'game', 'appearance']) {
            await verify(route, `${theme}/${mode}/${width}×${height}/${route}`)
          }
        }
      }
    }
    await page.setViewportSize({ width: 960, height: 600 })
    for (const locale of ['zh-TW', 'en-US', 'ja-JP', 'de-DE', 'ru-RU']) {
      await configure('folia', 'dark', locale, true)
      for (const route of ['launcher', 'game', 'appearance']) await verify(route, `${locale}/960×600/${route}`)
    }
    return { passed: results.length, cases: results }
  } catch (error) {
    await page.screenshot({ path: 'output/playwright/settings-help-failure.png' })
    throw new Error(`${checkpoint}; 已通过 ${results.length} 项; ${error.message}`)
  } finally {
    await page.evaluate(
      ({ key, value }) => {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      },
      { key: storageKey, value: previous }
    )
  }
}
