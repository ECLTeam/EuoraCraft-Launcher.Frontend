async function _verifyJavaManagerLayout(page) {
  // 在本地 showcase 页面通过 playwright-cli run-code --filename 执行。
  if (!['localhost', '127.0.0.1'].includes(new URL(page.url()).hostname) || !page.url().includes('showcase=1'))
    throw Error('需要本地展示模式')
  await page.bringToFront()
  const assert = (ok, text) => {
    if (!ok) throw Error(text)
  }
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
  await page.evaluate(async () => {
    const { javaApi } = await import('/src/features/java/api/javaApi.ts')
    const { useJavaRuntimeStore } = await import('/src/features/java/stores/javaRuntimeStore.ts')
    const { useTheme } = await import('/src/composables/useTheme.ts')
    const { useDebugToolsWindowStore } = await import('/src/features/debug/stores/debugToolsWindowStore.ts')
    const { i18n } = await import('/src/i18n/index.ts')
    i18n.global.locale.value = 'zh-CN'
    useDebugToolsWindowStore().close()
    const runtime = {
      runtimeId: 'a'.repeat(24),
      executablePath:
        'D:\\Projects\\EuoraCraft-Launcher\\EuoraCraft-Launcher\\ECL_data\\runtimes\\java\\installed\\temurin-25-4c95451cea98556d\\jdk-25.0.4.1+1-jre\\bin\\java.exe',
      javaHomePath: 'D:/Java',
      vendor: 'Eclipse Adoptium',
      runtimeKind: 'JRE',
      majorVersion: 25,
      fullVersion: '25.0.4.1',
      architecture: 'x64',
      origin: 'managed',
      isEnabled: true,
      validationStatus: 'valid',
      discoverySources: [],
      references: [],
      isInUse: false,
    }
    const originals = { inventory: javaApi.inventory, catalog: javaApi.catalog }
    let rows = [runtime]
    javaApi.inventory = async () => ({
      runtimes: structuredClone(rows),
      platform: 'windows',
      architecture: 'x64',
      managedRootPath: 'D:/Java',
      cleanupPendingCount: 0,
    })
    javaApi.catalog = async () => ({
      availableMajorVersions: [17, 21, 25],
      recommendedMajorVersion: 25,
      majorVersion: 25,
      platform: 'windows',
      architecture: 'x64',
      packages: [
        {
          packageId: 'b'.repeat(24),
          releaseName: 'jdk-25.0.4.1+1',
          runtimeKind: 'JRE',
          architecture: 'x64',
          downloadBytes: 50000000,
        },
      ],
    })
    window.__javaLayoutRows = async (count) => {
      rows = Array.from({ length: count }, (_, index) => ({
        ...runtime,
        runtimeId: String(index).padStart(24, '0'),
        fullVersion: `25.0.4.${index + 1}`,
        vendor: index === count - 1 && count > 1 ? 'Last runtime' : runtime.vendor,
      }))
      const store = useJavaRuntimeStore()
      store.invalidate()
      await store.load()
    }
    window.__javaLayoutRestore = () => Object.assign(javaApi, originals)
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 800, 600)
    gradient.addColorStop(0, '#e2b8a7')
    gradient.addColorStop(0.5, '#bed7e4')
    gradient.addColorStop(1, '#cdb3d6')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 800, 600)
    for (let x = 0; x < 800; x += 80) {
      ctx.fillStyle = x % 160 === 0 ? '#ffffff66' : '#d3b49a66'
      ctx.fillRect(x, 0, 40, 600)
    }
    useTheme().setBackgroundImage(canvas.toDataURL(), undefined, false)
    await window.__javaLayoutRows(1)
    location.hash = '/settings/java'
  })
  await page.locator('.java-runtime-row').waitFor({ state: 'visible' })
  const cases = []
  async function measure(label) {
    const result = await page.evaluate(() => {
      const rect = (el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
      }
      const viewport = document.querySelector('.section-layout__viewport'),
        card = document.querySelector('.java-settings-card'),
        content = document.querySelector('.java-manager-content')
      return {
        viewport: rect(viewport),
        card: rect(card),
        horizontal: content.scrollWidth > content.clientWidth + 1,
        outerScroll: viewport.scrollHeight > viewport.clientHeight + 1,
        row: (() => {
          const row = document.querySelector('.java-runtime-row')
          if (!row) return null
          return {
            height: row.getBoundingClientRect().height,
            heading: rect(row.querySelector('.java-runtime-heading')),
            actions: rect(row.querySelector('.java-runtime-actions')),
          }
        })(),
        badButtons: [...document.querySelectorAll('.java-manager-toolbar button,.java-runtime-actions button')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return (
              r.width &&
              (r.left < content.getBoundingClientRect().left - 20 ||
                r.right > content.getBoundingClientRect().right + 20)
            )
          })
          .map((el) => el.textContent),
      }
    })
    assert(
      Math.abs(result.card.height - result.viewport.height) < 2 &&
        Math.abs(result.card.width - result.viewport.width) < 2,
      label + ': card does not fill viewport ' + JSON.stringify(result)
    )
    assert(
      !result.horizontal && !result.outerScroll && !result.badButtons.length,
      label + ': overflow ' + JSON.stringify(result)
    )
    if (result.row && !label.startsWith('de-') && !label.startsWith('ru-')) {
      assert(result.row.height <= 72, label + ': list row too tall ' + result.row.height)
      assert(
        result.row.actions.left > result.row.heading.left && result.row.actions.top < result.row.heading.bottom,
        label + ': actions not beside information'
      )
    }
    cases.push(label)
  }
  try {
    for (const skin of ['classic', 'folia'])
      for (const mode of ['light', 'dark'])
        for (const blur of [false, true])
          for (const [width, height] of [
            [960, 600],
            [1200, 800],
            [1600, 1000],
          ]) {
            await page.setViewportSize({ width, height })
            await page.evaluate(
              async ({ skin, mode, blur }) => {
                const { useTheme } = await import('/src/composables/useTheme.ts')
                const theme = useTheme()
                theme.setThemeId(skin, false)
                theme.setThemeMode(mode, false)
                theme.setTransparentBg(true, false)
                theme.setAppearance({ card_opacity: 70 }, false)
                theme.setBlurLayerEnabled(blur, false)
              },
              { skin, mode, blur }
            )
            await measure(`${skin}/${mode}/blur-${blur}/${width}x${height}`)
          }
    await page.setViewportSize({ width: 960, height: 600 })
    const pathTrigger = page.locator('.java-runtime-path-trigger').first()
    await pathTrigger.focus()
    await pathTrigger.press('Enter')
    await page.locator('.java-runtime-full-path').waitFor({ state: 'visible' })
    assert(
      (await page.locator('.java-runtime-full-path').innerText()) === (await pathTrigger.getAttribute('title')),
      'Full path is not available'
    )
    await measure('path popover')
    await pathTrigger.press('Escape')
    await page.locator('.java-runtime-full-path').waitFor({ state: 'hidden' })
    const more = page.locator('.java-runtime-more').first()
    await more.focus()
    await more.press('Enter')
    await page.locator('.n-dropdown-menu').waitFor({ state: 'visible' })
    assert((await page.locator('.n-dropdown-menu').innerText()).includes('移除安装'), 'Missing removal action')
    await page.keyboard.press('Escape')
    await page.locator('.n-dropdown-menu').waitFor({ state: 'hidden' })
    await page.evaluate(() => window.__javaLayoutRows(16))
    const toolbarTop = await page.locator('.java-manager-toolbar').evaluate((el) => el.getBoundingClientRect().top)
    await page.locator('.java-runtime-row').last().locator('.java-runtime-more').scrollIntoViewIfNeeded()
    const bottom = await page
      .locator('.java-runtime-row')
      .last()
      .locator('.java-runtime-actions')
      .evaluate((el) => el.getBoundingClientRect().bottom)
    const contentBottom = await page
      .locator('.java-manager-content')
      .evaluate((el) => el.getBoundingClientRect().bottom)
    assert(bottom <= contentBottom + 1, 'Last item actions unreachable')
    assert(
      Math.abs(
        toolbarTop - (await page.locator('.java-manager-toolbar').evaluate((el) => el.getBoundingClientRect().top))
      ) < 1,
      'Toolbar scrolled away'
    )
    await measure('long list with last item reached')
    await page.locator('.java-manager-content').evaluate((el) => {
      el.scrollTop = 0
    })
    await page.locator('.java-manager-content input').fill('not-a-runtime')
    await page.locator('.java-manager-empty').waitFor({ state: 'visible' })
    await measure('search empty')
    await page.locator('.java-manager-content input').fill('')
    await page.evaluate(() => window.__javaLayoutRows(0))
    await page.locator('.java-manager-empty').waitFor({ state: 'visible' })
    await measure('empty inventory')
    for (const locale of ['de-DE', 'ru-RU']) {
      await page.evaluate(async (locale) => {
        const { i18n } = await import('/src/i18n/index.ts')
        i18n.global.locale.value = locale
        await window.__javaLayoutRows(1)
      }, locale)
      await measure(locale)
    }
    await page.evaluate(async () => {
      const { i18n } = await import('/src/i18n/index.ts')
      i18n.global.locale.value = 'zh-CN'
    })
    await page.locator('.java-manager-tabs button').nth(1).click()
    await page.locator('.java-package-row').waitFor({ state: 'visible' })
    await measure('download view')
    await page.locator('.java-manager-tabs button').first().click()
    await page.locator('.java-runtime-row').waitFor({ state: 'visible' })
    await page.evaluate(async () => {
      const { useTheme } = await import('/src/composables/useTheme.ts')
      const theme = useTheme()
      theme.setThemeId('classic', false)
      theme.setThemeMode('light', false)
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'java-layout/compact-classic-light.png', animations: 'disabled' })
    await page.evaluate(async () => {
      const { useTheme } = await import('/src/composables/useTheme.ts')
      const theme = useTheme()
      theme.setThemeId('folia', false)
      theme.setThemeMode('dark', false)
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'java-layout/compact-folia-dark.png', animations: 'disabled' })
    return { passed: cases.length, cases }
  } finally {
    await page.evaluate(() => window.__javaLayoutRestore())
  }
}
