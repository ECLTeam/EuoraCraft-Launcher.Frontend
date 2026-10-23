async function _verifySharedControls(page) {
  // 使用 playwright-cli run-code --filename frontend/scripts/verify-shared-controls.js 执行。
  await page.bringToFront()
  async function renderCurrentComponents(page) {
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__)
    return await page.evaluate(async () => {
      const { h, render, defineComponent, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { NConfigProvider, NButton, NInput, NSelect } = await import('/node_modules/.vite/deps/naive-ui.js')
      const names = [
        'Button',
        'Input',
        'Select',
        'Card',
        'Tag',
        'Slider',
        'Loading',
        'EmptyState',
        'Avatar',
        'Icon',
        'Progress',
        'MarkdownContent',
      ]
      const components = Object.fromEntries(
        await Promise.all(names.map(async (name) => [name, (await import(`/src/components/ui/${name}.vue`)).default]))
      )
      const { useTheme } = await import('/src/composables/useTheme.ts')
      const theme = useTheme()
      theme.setThemeId('classic', false)
      theme.setThemeMode('light', false)
      const row = (children) =>
        h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0' }, children)
      const label = (text) =>
        h('div', { style: 'font-size:12px;color:var(--ecl-text-secondary);margin:12px 0 6px' }, text)
      const options = [
        { label: '自动选择', value: 'auto', desc: '使用推荐设置' },
        { label: '手动指定', value: 'manual', desc: '选择其他选项' },
      ]
      const section = (title, children) =>
        h(
          'section',
          {
            style:
              'padding:16px 20px;border:1px solid var(--ecl-border);background:var(--ecl-surface);border-radius:8px;min-width:0',
          },
          [h('h2', { style: 'font-size:15px;margin:0 0 12px;color:var(--ecl-text)' }, title), ...children]
        )
      const Audit = defineComponent({
        setup() {
          const size = ref('md')
          const sliders = ref([25, 75])
          window.__controlAuditSize = size

          const selected = ref('auto')
          return () =>
            h(
              NConfigProvider,
              { theme: theme.naiveTheme.value, themeOverrides: theme.themeOverrides.value },
              {
                default: () =>
                  h(
                    'main',
                    {
                      style:
                        'position:fixed;inset:0;z-index:1000;overflow:auto;padding:24px;background:var(--ecl-canvas);color:var(--ecl-text)',
                      id: 'component-audit-content',
                    },
                    [
                      h('h1', { style: 'font-size:20px;margin:0 0 6px' }, '当前公共组件 · 实际渲染检查'),
                      h(
                        'p',
                        { style: 'margin:0 0 20px;font-size:13px;color:var(--ecl-text-secondary)' },
                        '直接加载当前 Vue 组件；这里只排列现有组件，没有修改它们的样式。'
                      ),
                      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start' }, [
                        section('按钮', [
                          label('自定义控件'),
                          row(
                            ['primary', 'secondary', 'outline', 'text'].map((variant) =>
                              h(
                                components.Button,
                                { variant, size: size.value },
                                () =>
                                  ({
                                    primary: '主要操作',
                                    secondary: '次要操作',
                                    outline: '描边按钮',
                                    text: '文字按钮',
                                  })[variant]
                              )
                            )
                          ),
                          row([
                            h(components.Button, { loading: true, size: size.value }, () => '正在处理'),
                            h(components.Button, { disabled: true, size: size.value }, () => '暂不可用'),
                          ]),
                          label('Naive UI 控件'),
                          row([
                            h(
                              NButton,
                              { type: 'primary', size: { sm: 'small', md: 'medium', lg: 'large' }[size.value] },
                              () => '主要操作'
                            ),
                            h(
                              NButton,
                              { size: { sm: 'small', md: 'medium', lg: 'large' }[size.value] },
                              () => '次要操作'
                            ),
                            h(
                              NButton,
                              { secondary: true, size: { sm: 'small', md: 'medium', lg: 'large' }[size.value] },
                              () => '次级按钮'
                            ),
                          ]),
                        ]),
                        section('输入框与选择框', [
                          label('自定义输入框 / Naive UI 输入框'),
                          row([
                            h('div', { style: 'width:210px' }, [
                              h(components.Input, { size: size.value, placeholder: '输入配置值' }),
                            ]),
                            h(NInput, {
                              size: { sm: 'small', md: 'medium', lg: 'large' }[size.value],
                              placeholder: '输入配置值',
                              style: 'width:210px',
                            }),
                          ]),
                          label('自定义：只读 / 禁用'),
                          row([
                            h('div', { style: 'width:210px' }, [
                              h(components.Input, { size: size.value, modelValue: '只读内容，可复制', readonly: true }),
                            ]),
                            h('div', { style: 'width:210px' }, [
                              h(components.Input, { size: size.value, modelValue: '禁用内容', disabled: true }),
                            ]),
                          ]),
                          label('自定义选择框 / Naive UI 选择框'),
                          row([
                            h(components.Select, {
                              size: size.value,
                              ariaLabel: '配置方式',
                              modelValue: selected.value,
                              'onUpdate:modelValue': (value) => (selected.value = value),
                              options,
                            }),
                            h(NSelect, {
                              size: { sm: 'small', md: 'medium', lg: 'large' }[size.value],
                              value: selected.value,
                              options,
                              style: 'width:210px',
                            }),
                          ]),
                        ]),
                        section('卡片', [
                          row([
                            h('div', { style: 'flex:1' }, [
                              h(components.Card, { title: '普通卡片' }, () => '这里是卡片正文。'),
                            ]),
                            h('div', { style: 'flex:1' }, [
                              h(components.Card, { title: '未传图标' }, () => '这里是另一张卡片。'),
                            ]),
                          ]),
                          label('交互卡片'),
                          h(
                            components.Card,
                            { title: '可点击卡片', interactive: true, hoverable: true },
                            () => '悬停查看反馈'
                          ),
                        ]),
                        section('滑块与标签', [
                          label('相同滑块：25 / 75'),
                          row([
                            h(components.Slider, {
                              modelValue: sliders.value[0],
                              'onUpdate:modelValue': (value) => (sliders.value[0] = value),
                              ariaLabel: '第一个滑块',
                            }),
                            h(components.Slider, {
                              modelValue: sliders.value[1],
                              'onUpdate:modelValue': (value) => (sliders.value[1] = value),
                              ariaLabel: '第二个滑块',
                            }),
                          ]),
                          label('标签：tiny / small / medium'),
                          row(
                            ['tiny', 'small', 'medium'].map((size) =>
                              h(components.Tag, { size, tone: 'success' }, () => '已完成')
                            )
                          ),
                          row(
                            ['default', 'primary', 'warning', 'error'].map((tone) =>
                              h(components.Tag, { tone }, () => tone)
                            )
                          ),
                        ]),
                        section('加载状态', [
                          row([
                            h(components.Loading, { mode: 'inline', label: '正在读取' }),
                            h(components.Loading, { mode: 'inline', size: 'sm' }),
                          ]),
                          h(components.Loading, { mode: 'block', label: '正在加载资源' }),
                        ]),
                        section('空状态', [
                          h(components.EmptyState, {
                            title: '暂无实例',
                            description: '安装游戏后，实例会显示在这里。',
                          }),
                        ]),
                        section('图标、头像与进度', [
                          row([
                            h(components.Icon, { name: 'game', size: 20 }),
                            h(components.Icon, { name: 'settings', size: 20 }),
                            h(components.Avatar, { name: '玩家', size: 32 }),
                            h(components.Avatar, { name: '玩家', size: 40 }),
                          ]),
                          h(components.Progress, { percentage: 42, showIndicator: true }),
                        ]),
                        section('Markdown 内容', [
                          h(components.MarkdownContent, {
                            content: '### 资源说明\n这是当前组件的**正文**，包含 [示例链接](https://example.com)。',
                          }),
                        ]),
                      ]),
                    ]
                  ),
              }
            )
        },
      })
      const host = document.createElement('div')
      host.id = 'component-audit-host'
      document.querySelector('#app').appendChild(host)
      const node = h(Audit)
      node.appContext = document.querySelector('#app').__vue_app__._context
      render(node, host)
      return { mounted: true }
    })
  }

  const assert = (value, message) => {
    if (!value) throw new Error(message)
  }
  if (!['localhost', '127.0.0.1'].includes(new URL(page.url()).hostname) || !page.url().includes('showcase=1'))
    throw new Error('需要本地展示模式')
  await renderCurrentComponents(page)
  const results = []
  for (const skin of ['classic', 'folia']) {
    for (const mode of ['light', 'dark']) {
      for (const [width, height] of [
        [960, 600],
        [1200, 800],
        [1600, 1000],
      ]) {
        await page.setViewportSize({ width, height })
        for (const [size, pixels] of [
          ['sm', 32],
          ['md', 36],
          ['lg', 40],
        ]) {
          await page.evaluate(
            async ({ skin, mode, size }) => {
              const { useTheme } = await import('/src/composables/useTheme.ts')
              const { nextTick } = await import('/node_modules/.vite/deps/vue.js')
              useTheme().setThemeId(skin, false)
              useTheme().setThemeMode(mode, false)
              window.__controlAuditSize.value = size
              await nextTick()
            },
            { skin, mode, size }
          )
          const metrics = await page.locator('#component-audit-content').evaluate((root) => ({
            heights: [...root.querySelectorAll('.ui-btn,.n-button,.ui-input,.n-input,.n-base-selection')].map((el) => ({
              type: el.className,
              height: el.getBoundingClientRect().height,
            })),
            readonly: [...root.querySelectorAll('.ui-input')]
              .filter((el) => el.readOnly)
              .map((el) => ({ opacity: getComputedStyle(el).opacity, cursor: getComputedStyle(el).cursor })),
            tagFonts: [...root.querySelectorAll('.ui-tag')].slice(0, 3).map((el) => getComputedStyle(el).fontSize),
            hintFont: getComputedStyle(root.querySelector('.empty-hint')).fontSize,
            overflow: root.scrollWidth > root.clientWidth + 1,
          }))
          const name = `${skin}/${mode}/${width}x${height}/${size}`
          for (const item of metrics.heights)
            assert(Math.abs(item.height - pixels) < 1, `${name}: ${JSON.stringify(item)}`)
          assert(
            metrics.readonly.every((item) => item.opacity === '1' && item.cursor === 'text'),
            `${name}: 只读状态错误`
          )
          assert(metrics.tagFonts.join(',') === '10px,11px,12px', `${name}: 标签字体错误`)
          assert(metrics.hintFont === '12px', `${name}: 空状态文字错误`)
          assert(!metrics.overflow, `${name}: 页面横向溢出`)
          results.push(name)
        }
      }
      const selector = page.locator('#component-audit-content .ui-select').first()
      const trigger = selector.locator('.n-base-selection-label')
      await trigger.focus()
      await trigger.press('Space')
      const menu = page.locator('.n-base-select-menu')
      await menu.waitFor({ state: 'visible' })
      await trigger.press('Escape')
      await menu.waitFor({ state: 'hidden' })
      await trigger.press('Enter')
      await menu.waitFor({ state: 'visible' })
      await trigger.press('ArrowDown')
      await trigger.press('Enter')
      await menu.waitFor({ state: 'hidden' })
      const slider = page.locator('#component-audit-content .ui-slider-input').first()
      await slider.focus()
      await slider.press('ArrowRight')
      const sliderState = await slider.evaluate((el) => ({
        value: el.value,
        fill: el.style.getPropertyValue('--ui-slider-percent'),
        outline: getComputedStyle(el).outlineStyle,
      }))
      assert(
        Math.abs(parseFloat(sliderState.fill) - Number(sliderState.value)) < 0.001 && sliderState.outline === 'solid',
        '滑块填充或焦点错误'
      )
    }
  }
  const radii = await page.evaluate(() => {
    const root = document.documentElement
    const before = [
      root.style.getPropertyValue('--ecl-radius-card'),
      root.style.getPropertyValue('--ecl-radius-control'),
    ]
    root.style.setProperty('--ecl-radius-card', '20px')
    root.style.setProperty('--ecl-radius-control', '4px')
    const result = {
      card: getComputedStyle(document.querySelector('#component-audit-content .ui-card')).borderRadius,
      control: getComputedStyle(document.querySelector('#component-audit-content .ui-btn')).borderRadius,
    }
    for (const [index, name] of ['--ecl-radius-card', '--ecl-radius-control'].entries()) {
      if (before[index]) root.style.setProperty(name, before[index])
      else root.style.removeProperty(name)
    }
    return result
  })
  assert(radii.card === '20px' && radii.control === '4px', '卡片与控件圆角未独立响应')
  await page.evaluate(async () => {
    window.__controlAuditSize.value = 'md'
    const { nextTick } = await import('/node_modules/.vite/deps/vue.js')
    await nextTick()
  })
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.screenshot({ path: 'output/playwright/shared-controls-after-dark.png', animations: 'disabled' })
  await page.evaluate(async () => {
    const { useTheme } = await import('/src/composables/useTheme.ts')
    useTheme().setThemeId('classic', false)
    useTheme().setThemeMode('light', false)
  })
  await page.screenshot({ path: 'output/playwright/shared-controls-after-light.png', animations: 'disabled' })
  return { passed: results.length, radii, cases: results }
}
