// 从 @iconify-json/tabler 提取 ICON_MAP 实际用到的图标子集，生成 tabler-subset.ts。
// 用法: node scripts/gen-tabler-subset.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsJson = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@iconify-json/tabler/icons.json'), 'utf-8'))
const iconifyTs = fs.readFileSync(path.join(root, 'src/components/ui/iconify.ts'), 'utf-8')

// 提取 ICON_MAP 中的 Tabler 图标名（形如 `short: 'icon-name',`，键可带引号如 `'chevron-left': 'chevron-left',`）
const names = new Set()
for (const m of iconifyTs.matchAll(/^\s+'?[\w-]+'?:\s*'([\w-]+)',/gm)) {
  names.add(m[1])
}
names.add('help-circle') // getIconName 兜底

const subsetIcons = {}
for (const [name, data] of Object.entries(iconsJson.icons)) {
  if (names.has(name)) subsetIcons[name] = data
}
const subsetAliases = {}
for (const [name, alias] of Object.entries(iconsJson.aliases ?? {})) {
  if (names.has(alias.parent ?? '')) subsetAliases[name] = alias
}

const out = `// 自动生成：由 scripts/gen-tabler-subset.mjs 从 @iconify-json/tabler 提取仅 ICON_MAP 使用的图标子集（勿手改）。
export const icons = ${JSON.stringify({ prefix: 'tabler', icons: subsetIcons, aliases: subsetAliases, width: 24, height: 24 })}
`
const outPath = path.join(root, 'src/components/ui/tabler-subset.ts')
// 按项目 Prettier 配置格式化，保证产物能直接通过 `pnpm format:check`
const prettierConfig = await prettier.resolveConfig(outPath)
const formatted = await prettier.format(out, { ...prettierConfig, parser: 'typescript' })
fs.writeFileSync(outPath, formatted)
console.log(
  `names=${names.size} subsetIcons=${Object.keys(subsetIcons).length} aliases=${Object.keys(subsetAliases).length} outputBytes=${Buffer.byteLength(formatted)}`
)
