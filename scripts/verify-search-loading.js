async function _verifySearchLoading(page) {
  // 连接 Showcase 开发页面后，以 playwright-cli run-code --filename scripts/verify-search-loading.js 执行。
  // 直接渲染生产组件，仅暂停演示搜索响应，验证初次加载及保留旧结果时的真实排版。
  await page.reload()
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
  await page.evaluate(async () => {
    const { default: backend } = await import('/src/api/client/index.ts')
    if (!backend.runtime.isShowcase) throw new Error('此回归只允许在 Showcase 演示数据中运行')
    const { h, render, defineComponent } = await import('/node_modules/.vite/deps/vue.js')
    const { NConfigProvider } = await import('/node_modules/.vite/deps/naive-ui.js')
    const { default: OnlineModSearch } = await import('/src/components/mods/OnlineModSearch.vue')
    const { modApi } = await import('/src/features/mods/api/modApi.ts')
    const { useTheme } = await import('/src/composables/useTheme.ts')
    const theme = useTheme()
    const originalSearch = modApi.search
    const pending = []
    let paused = true
    modApi.search = async (payload) => {
      if (paused) await new Promise((resolve) => pending.push(resolve))
      return originalSearch(payload)
    }
    const host = document.createElement('div')
    host.id = 'search-loading-audit'
    document.body.append(host)
    const Audit = defineComponent({
      setup: () => () =>
        h(
          NConfigProvider,
          {
            theme: theme.naiveTheme.value,
            themeOverrides: theme.themeOverrides.value,
          },
          {
            default: () =>
              h(
                'main',
                {
                  style: 'position:fixed;inset:24px;display:flex;flex-direction:column;z-index:10000',
                },
                [h(OnlineModSearch, { resourceType: 'mod' })]
              ),
          }
        ),
    })
    const vnode = h(Audit)
    vnode.appContext = document.querySelector('#app').__vue_app__._context
    window.__searchLoadingAudit = {
      pause: () => {
        paused = true
      },
      release: () => {
        paused = false
        pending.splice(0).forEach((resolve) => resolve())
      },
      restore: () => {
        render(null, host)
        host.remove()
        modApi.search = originalSearch
        paused = false
        pending.splice(0).forEach((resolve) => resolve())
      },
    }
    render(vnode, host)
  })

  const spinner = page.locator('#search-loading-audit .mods-results-spin')
  let checked = 0
  try {
    await spinner.locator('[role="status"]').waitFor({ state: 'attached' })
    for (const hasResults of [false, true]) {
      if (hasResults) {
        await page.evaluate(() => window.__searchLoadingAudit.release())
        await spinner.locator('[role="status"]').waitFor({ state: 'hidden' })
        await spinner.locator('.mod-row').first().waitFor()
        await page.evaluate(() => window.__searchLoadingAudit.pause())
        await page.locator('#search-loading-audit .instance-selector-actions button').first().click()
        await spinner.locator('[role="status"]').waitFor({ state: 'attached' })
      }
      for (const skin of ['classic', 'folia']) {
        for (const mode of ['light', 'dark']) {
          await page.evaluate(
            async ({ skin, mode }) => {
              const { useTheme } = await import('/src/composables/useTheme.ts')
              const theme = useTheme()
              theme.setThemeId(skin, false)
              theme.setThemeMode(mode, false)
            },
            { skin, mode }
          )
          for (const [width, height] of [
            [960, 600],
            [1100, 720],
            [1600, 1000],
          ]) {
            await page.setViewportSize({ width, height })
            const geometry = await spinner.evaluate((element) => {
              const panel = element.closest('.mods-results-panel').getBoundingClientRect()
              const box = element.getBoundingClientRect()
              const indicator = element.querySelector('.ui-loading__indicator')
              const ring = indicator.querySelector('svg').getBoundingClientRect()
              const label = indicator.querySelector('.ui-loading__label').getBoundingClientRect()
              return {
                height: box.height,
                centered: Math.abs(ring.top + ring.height / 2 - (panel.top + panel.height / 2)) < 1,
                inside: [ring, label].every(
                  (rect) =>
                    rect.top >= panel.top &&
                    rect.bottom <= panel.bottom &&
                    rect.left >= panel.left &&
                    rect.right <= panel.right
                ),
                rows: element.querySelectorAll('.mod-row').length,
                transparent: getComputedStyle(indicator).backgroundColor === 'rgba(0, 0, 0, 0)',
              }
            })
            if (
              geometry.height <= 0 ||
              !geometry.centered ||
              !geometry.inside ||
              !geometry.transparent ||
              (hasResults ? geometry.rows === 0 : geometry.rows !== 0)
            ) {
              throw new Error(JSON.stringify({ hasResults, skin, mode, width, height, geometry }))
            }
            checked++
          }
        }
      }
    }
    return { checked, states: ['empty-loading', 'retained-results-loading'], passed: true }
  } finally {
    await page.evaluate(() => window.__searchLoadingAudit.restore())
  }
}
