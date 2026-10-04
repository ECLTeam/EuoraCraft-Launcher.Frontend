import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

describe('生产 CSS 兼容性', () => {
  it('保留当前 WebView2 支持的标准背景模糊声明', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ecl-css-build-'))
    try {
      await writeFile(join(directory, 'main.js'), "import './surface.css'")
      await writeFile(
        join(directory, 'surface.css'),
        '@theme{--color-review:#123456}.surface{backdrop-filter:var(--ecl-surface-backdrop);-webkit-backdrop-filter:var(--ecl-surface-backdrop)}'
      )
      const options = {
        configFile: false,
        root: directory,
        logLevel: 'silent',
        build: {
          write: false,
          rolldownOptions: { input: join(directory, 'main.js') },
        },
      }
      // 构建使用原生 Node 环境，避免 jsdom 的 Uint8Array 与 esbuild 跨 realm 冲突。
      const { stdout } = await promisify(execFile)(process.execPath, [
        '--input-type=module',
        '-e',
        `import { build, loadConfigFromFile } from 'vite';
const production = await loadConfigFromFile({ command: 'build', mode: 'production' });
const { target, cssMinify } = production.config.build;
const options = ${JSON.stringify(options)};
const result = await build({ ...options, css: { postcss: process.cwd() }, build: { ...options.build, target, cssMinify } });
const output = (Array.isArray(result) ? result : [result]).flatMap(chunk => chunk.output ?? []);
const css = output.find(chunk => chunk.type === 'asset' && chunk.fileName.endsWith('.css'));
process.stdout.write(String(css?.source ?? ''));`,
      ])
      expect(stdout).toMatch(/(?<!-)backdrop-filter:/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
