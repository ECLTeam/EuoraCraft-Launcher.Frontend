async function _verifySearchPagination(page) {
  // 在 Showcase 开发页面运行：playwright-cli run-code --filename scripts/verify-search-pagination.js。
  // 使用生产搜索组件和有顺序约束的演示响应，不访问真实资源平台。
  await page.reload()
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
  await page.evaluate(async () => {
    const { default: backend } = await import('/src/api/client/index.ts')
    if (!backend.runtime.isShowcase) throw new Error('此回归只允许在 Showcase 演示数据中运行')
    const { h, render, defineComponent } = await import('/node_modules/.vite/deps/vue.js')
    const { NConfigProvider } = await import('/node_modules/.vite/deps/naive-ui.js')
    const { default: Search } = await import('/src/components/mods/OnlineModSearch.vue')
    const { modApi } = await import('/src/features/mods/api/modApi.ts')
    const { useTheme } = await import('/src/composables/useTheme.ts')
    const { i18n } = await import('/src/i18n/index.ts')
    i18n.global.locale.value = 'zh-CN'
    const original = { search: modApi.search, sourceConfig: modApi.sourceConfig }
    const sample = (await original.search({ source: 'modrinth', resource_type: 'mod', limit: 20, offset: 0 })).items[0]
    if (!sample) throw new Error('演示数据中缺少搜索条目')
    let establishedPage = 0
    modApi.sourceConfig = async () => ({ curseforge: { available: true } })
    modApi.search = async (request) => {
      const source = request.source || 'all'
      const aggregated = source === 'all'
      const currentPage = aggregated ? request.page || 1 : Math.floor((request.offset || 0) / 20) + 1
      if (aggregated) {
        if (request.refresh) establishedPage = 0
        if (currentPage > establishedPage + 1) throw new Error(`非法跳页：${establishedPage} → ${currentPage}`)
        establishedPage = Math.max(establishedPage, currentPage)
      }
      return {
        items: Array.from({ length: 20 }, (_, index) => ({
          ...sample,
          groupId: `${source}-${currentPage}-${index}`,
          displayTitle: `${source}-page-${currentPage}-${index}`,
        })),
        sources: {},
        query: request.query || '',
        total: aggregated ? 240 : 260,
        ...(aggregated
          ? {
              page: currentPage,
              pageCount: currentPage,
              sessionId: 'pagination-qa',
              hasMore: currentPage < 12,
              totalExact: currentPage === 12,
            }
          : {}),
      }
    }
    const theme = useTheme()
    const host = document.createElement('div')
    host.id = 'search-pagination-audit'
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
                  style:
                    'position:fixed;top:24px;bottom:24px;left:244px;right:24px;display:flex;flex-direction:column;z-index:1000',
                },
                [h(Search, { resourceType: 'mod' })]
              ),
          }
        ),
    })
    const vnode = h(Audit)
    vnode.appContext = document.querySelector('#app').__vue_app__._context
    window.__searchPaginationRestore = () => {
      render(null, host)
      host.remove()
      Object.assign(modApi, original)
    }
    render(vnode, host)
  })
  const host = page.locator('#search-pagination-audit')
  async function expectPage(source, number) {
    await page.waitForFunction(
      ({ source, number }) =>
        document
          .querySelector('#search-pagination-audit .mod-row-name')
          ?.textContent.trim()
          .startsWith(`${source}-page-${number}-`),
      { source, number }
    )
  }
  async function chooseSource(label) {
    await host.locator('.search-filters .n-select').first().click()
    await page.locator('.n-base-select-menu:visible').getByText(label, { exact: true }).click()
  }
  try {
    await expectPage('all', 1)
    await host.locator('.mods-pagination button').nth(4).click()
    await expectPage('all', 11)
    await host.locator('.mods-pagination button').nth(1).click()
    await expectPage('all', 1)
    await chooseSource('Modrinth')
    await expectPage('modrinth', 1)
    await host.locator('.mods-pagination button').nth(4).click()
    await expectPage('modrinth', 11)
    await host.locator('.mods-pagination button').nth(4).click()
    await expectPage('modrinth', 13)
    await chooseSource('CurseForge')
    await expectPage('curseforge', 1)
    let checked = 0
    for (const skin of ['classic', 'folia'])
      for (const mode of ['light', 'dark']) {
        for (const locale of ['zh-CN', 'zh-TW', 'en-US', 'de-DE', 'ja-JP', 'ru-RU']) {
          await page.evaluate(
            async ({ skin, mode, locale }) => {
              const { useTheme } = await import('/src/composables/useTheme.ts')
              const { i18n } = await import('/src/i18n/index.ts')
              const theme = useTheme()
              theme.setThemeId(skin, false)
              theme.setThemeMode(mode, false)
              i18n.global.locale.value = locale
            },
            { skin, mode, locale }
          )
          for (const [width, height] of [
            [960, 600],
            [1100, 720],
            [1600, 1000],
          ]) {
            await page.setViewportSize({ width, height })
            await host.locator('.mods-pagination').scrollIntoViewIfNeeded()
            const fits = await host.locator('.mods-pagination').evaluate((element) => {
              const box = element.getBoundingClientRect()
              return [...element.querySelectorAll('button')].every((button) => {
                const rect = button.getBoundingClientRect()
                return (
                  rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom
                )
              })
            })
            if (!fits) throw new Error(JSON.stringify({ skin, mode, locale, width, height }))
            checked++
          }
        }
      }
    return { flow: 'all:1→11→1, modrinth:1→11→13, curseforge:1', layouts: checked, passed: true }
  } finally {
    await page.evaluate(() => window.__searchPaginationRestore())
  }
}
