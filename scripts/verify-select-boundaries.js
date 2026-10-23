async function _verifySelectBoundaries(page) {
  // playwright-cli run-code --filename scripts/verify-select-boundaries.js
  // 展示模式的实例设置路由或隔离的原生启动器窗口；不修改账户、实例和配置。
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
  if (await page.locator('.n-base-select-menu:visible').count()) {
    await page.locator('.version-settings-page .settings-summary').click()
    await page.waitForTimeout(200)
  }
  await page.evaluate(async () => {
    const { h, render, defineComponent, reactive } = await import('/node_modules/.vite/deps/vue.js')
    const { NConfigProvider, NSelect } = await import('/node_modules/.vite/deps/naive-ui.js')
    const { useTheme } = await import('/src/composables/useTheme.ts')
    const theme = useTheme()
    const state = reactive({ corner: 'right-bottom', long: false, value: null })
    window.__selectBoundaryAudit = { theme, state }
    const Fixture = defineComponent({
      setup: () => () =>
        h(
          NConfigProvider,
          { theme: theme.naiveTheme.value, themeOverrides: theme.themeOverrides.value },
          {
            default: () =>
              h(
                'div',
                {
                  id: 'select-boundary-audit',
                  style: `position:fixed;z-index:1000;${state.corner.includes('right') ? 'right' : 'left'}:8px;${state.corner.includes('bottom') ? 'bottom' : 'top'}:8px;width:94px`,
                },
                [
                  h(NSelect, {
                    value: state.value,
                    'onUpdate:value': (value) => (state.value = value),
                    consistentMenuWidth: false,
                    options: Array.from({ length: 30 }, (_, index) => ({
                      value: String(index),
                      label: state.long ? `Option ${index} ${'long-path/'.repeat(80)}` : `Selection option ${index}`,
                    })),
                  }),
                ]
              ),
          }
        ),
    })
    const host = document.createElement('div')
    ;(document.querySelector('.fullscreen-modal[aria-modal="true"]') || document.querySelector('#app')).append(host)
    const vnode = h(Fixture)
    vnode.appContext = document.querySelector('#app').__vue_app__._context
    render(vnode, host)
    window.__selectBoundaryCleanup = () => {
      render(null, host)
      host.remove()
    }
  })
  const results = []
  async function assertMenu(name) {
    const menu = page.locator('.n-base-select-menu:visible:not(.fade-in-scale-up-transition-leave-active)')
    await menu.waitFor()
    await page.waitForTimeout(350)
    const geometry = await menu.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const follower = element.parentElement.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        followerWidth: follower.width,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        placement: element.parentElement.getAttribute('v-placement'),
      }
    })
    if (
      geometry.left < -1 ||
      geometry.right > geometry.viewportWidth + 1 ||
      geometry.top < -1 ||
      geometry.bottom > geometry.viewportHeight + 1 ||
      Math.abs(geometry.width - geometry.followerWidth) > 1
    ) {
      throw new Error(`${name}: ${JSON.stringify(geometry)}`)
    }
    results.push({ name, ...geometry })
    return menu
  }
  for (const [width, height] of [
    [960, 600],
    [1100, 720],
    [1600, 1000],
  ]) {
    await page.setViewportSize({ width, height })
    for (const skin of ['classic', 'folia']) {
      for (const mode of ['light', 'dark']) {
        await page.evaluate(
          ({ skin, mode }) => {
            const { theme } = window.__selectBoundaryAudit
            theme.setThemeId(skin, false)
            theme.setThemeMode(mode, false)
            theme.setPrimaryColor('#d87557', false)
            theme.setAppearance({ card_opacity: mode === 'dark' ? 65 : 100 }, false)
            theme.setBlurAmount(skin === 'folia' ? 12 : 0, false)
            theme.setBackgroundImage(mode === 'dark' ? '/img/item/grass.png' : '', '', false)
            theme.setBackgroundOpacity(0.6, false)
          },
          { skin, mode }
        )
        for (const corner of ['left-top', 'right-top', 'left-bottom', 'right-bottom']) {
          for (const long of [false, true]) {
            await page.evaluate(
              ({ corner, long }) => Object.assign(window.__selectBoundaryAudit.state, { corner, long }),
              { corner, long }
            )
            await page.locator('#select-boundary-audit .n-select').click()
            const menu = await assertMenu(`${width}x${height}/${skin}/${mode}/${corner}/${long}`)
            const last = menu.locator('.n-base-select-option').last()
            await last.scrollIntoViewIfNeeded()
            await last.click()
            if ((await page.evaluate(() => window.__selectBoundaryAudit.state.value)) !== '29') {
              throw new Error('列表末项不可选择')
            }
          }
        }
        const sidebar = page.locator('.vdm-tab-button.active')
        if (await sidebar.count()) {
          const colors = []
          for (const color of ['#d87557', '#27976b']) {
            await page.evaluate((color) => window.__selectBoundaryAudit.theme.setPrimaryColor(color, false), color)
            await page.waitForTimeout(180)
            colors.push(await sidebar.evaluate((element) => getComputedStyle(element).backgroundColor))
          }
          if (colors[0] === colors[1] || colors.some((color) => color.includes('91, 111, 245'))) {
            throw new Error(`激活底色未跟随主色：${colors}`)
          }
        }
      }
    }
  }
  await page.evaluate(() => window.__selectBoundaryCleanup())
  // 实际版本设置的所有下拉框：滚动后仍在窗口中，且上下翻转有效。
  const selects = page.locator('.version-settings-page .n-select:visible')
  const settingsCount = await selects.count()
  if (settingsCount === 0) throw new Error('未打开版本设置页面')
  for (const [width, height] of [
    [960, 600],
    [1100, 720],
    [1600, 1000],
  ]) {
    await page.setViewportSize({ width, height })
    for (let index = 0; index < settingsCount; index++) {
      await selects.nth(index).scrollIntoViewIfNeeded()
      await selects.nth(index).click()
      await assertMenu(`version-settings/${width}/${index}`)
      await page.locator('.version-settings-page .settings-summary').click()
    }
  }
  return { passed: results.length, settingsCount, placements: [...new Set(results.map((result) => result.placement))] }
}
