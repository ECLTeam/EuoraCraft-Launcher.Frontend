import { URLS } from '@/config/urls'

export type AboutActionLabelKey = 'github' | 'website' | 'mirror'

export interface AboutEntry {
  id: string
  name: string
  initials: string
  descriptionKey: string
  url: string
  actionLabelKey: AboutActionLabelKey
  imageUrl?: string
  iconName?: string
}

export interface TechnologyCategory {
  id: string
  titleKey: string
  entries: AboutEntry[]
}

const avatarUrl = (fileName: string): string => `/img/avatars/${fileName}`

const createGithubEntry = (
  id: string,
  name: string,
  initials: string,
  descriptionKey: string,
  url: string,
  imageFileName?: string
): AboutEntry => ({
  id,
  name,
  initials,
  descriptionKey,
  url,
  actionLabelKey: 'github',
  imageUrl: imageFileName ? avatarUrl(imageFileName) : undefined,
})

export const teamMembers: AboutEntry[] = [
  createGithubEntry('aebc08', 'AEBC08', 'A', 'aebc08', 'https://github.com/AEBC08', 'AEBC08.webp'),
  createGithubEntry('wuchang325', 'Wuchang325', 'W', 'wuchang325', 'https://github.com/Wuchang325', 'Wuchang325.webp'),
  createGithubEntry('rate', 'RATE', 'R', 'e2662020', 'https://github.com/e2662020', 'RATE.webp'),
  createGithubEntry('luyanci', 'YC酱luyancib', 'L', 'luyanci', 'https://github.com/Luyanci', 'luyanci.webp'),
]

export const specialThanksEntries: AboutEntry[] = [
  createGithubEntry(
    'qomicex-public',
    'Qomicex-Public',
    'QP',
    'qomicexPublic',
    URLS.qomicexPublic,
    'Qomicex-Public.webp'
  ),
  createGithubEntry(
    'the-mycelium-of-antan',
    'TheMyceliumOfAntan',
    'TM',
    'theMyceliumOfAntan',
    'https://github.com/TheMyceliumOfAntan',
    'TheMyceliumOfAntan.webp'
  ),
  {
    id: 'bangbang93',
    name: 'bangbang93',
    initials: 'BB',
    descriptionKey: 'bangbang93',
    url: URLS.bmclapi,
    actionLabelKey: 'mirror',
    iconName: 'search-engine',
    imageUrl: avatarUrl('bangbang93.png'),
  },
  {
    id: 'modrinth',
    name: 'Modrinth',
    initials: 'M',
    descriptionKey: 'modrinth',
    url: URLS.modrinth,
    actionLabelKey: 'website',
    iconName: 'external-site',
    imageUrl: avatarUrl('modrinth.svg'),
  },
  {
    id: 'curseforge',
    name: 'CurseForge',
    initials: 'C',
    descriptionKey: 'curseforge',
    url: URLS.curseforge,
    actionLabelKey: 'website',
    iconName: 'external-site',
    imageUrl: avatarUrl('curseforge.png'),
  },
  {
    id: 'mcmod',
    name: 'MCMOD百科',
    initials: 'MC',
    descriptionKey: 'mcmod',
    url: URLS.mcmod,
    actionLabelKey: 'website',
    iconName: 'external-site',
    imageUrl: avatarUrl('mcmod.png'),
  },
  createGithubEntry('hmcl', 'HMCL', 'H', 'hmcl', URLS.hmcl.repo, 'HMCL.webp'),
  createGithubEntry(
    'scaffolding-mc',
    'Scaffolding-MC',
    'S',
    'scaffolding',
    URLS.scaffoldingMC.repo,
    'Scaffolding-MC.png'
  ),
  createGithubEntry('pcl-ce', 'PCL-CE', 'PC', 'pclCe', URLS.pcl.repo, 'pclce.webp'),
]

const technologies = {
  pytaruix: createGithubEntry('pytaruix', 'PyTaruiX', 'PX', 'pytaruix', URLS.pytaruix.repo),
  easyTier: createGithubEntry('easy-tier', 'EasyTier', 'ET', 'easyTier', URLS.easyTier.repo),
  authlibInjector: createGithubEntry(
    'authlib-injector',
    'Authlib-Injector',
    'AI',
    'authlib',
    URLS.authlibInjector.repo
  ),
  vue: createGithubEntry('vue', 'Vue 3', 'V', 'vue3', URLS.vue.repo),
  vite: createGithubEntry('vite', 'Vite', 'V', 'vite', URLS.vite.repo),
  pinia: createGithubEntry('pinia', 'Pinia', 'P', 'pinia', URLS.pinia.repo),
  vueRouter: createGithubEntry('vue-router', 'Vue Router', 'VR', 'vueRouter', URLS.vueRouter.repo),
  vueI18n: createGithubEntry('vue-i18n', 'Vue I18n', 'VI', 'vueI18n', URLS.vueI18n.repo),
  valibot: createGithubEntry('valibot', 'Valibot', 'V', 'valibot', URLS.valibot.repo),
  typescript: createGithubEntry('typescript', 'TypeScript', 'TS', 'typescript', URLS.typescript.repo),
  naiveUi: createGithubEntry('naive-ui', 'Naive UI', 'N', 'naiveUi', URLS.naiveUi.repo),
  tailwind: createGithubEntry('tailwind', 'Tailwind CSS', 'T', 'tailwind', URLS.tailwind.repo),
  vueUse: createGithubEntry('vue-use', 'VueUse', 'VU', 'vueUse', URLS.vueUse.repo),
  skinview3d: createGithubEntry('skinview3d', 'skinview3d', 'S', 'skinview3d', URLS.skinview3d.repo),
  materialColors: createGithubEntry(
    'material-colors',
    'Material Color Utilities',
    'MC',
    'materialColors',
    'https://github.com/material-foundation/material-color-utilities'
  ),
  sass: createGithubEntry('sass-embedded', 'sass-embedded', 'SE', 'sass', 'https://github.com/sass/embedded-host-node'),
} satisfies Record<string, AboutEntry>

const backendRuntimeEntries: AboutEntry[] = [
  createGithubEntry('python', 'Python 3', 'PY', 'pythonDesc', 'https://github.com/python/cpython'),
  createGithubEntry('aiofiles', 'aiofiles', 'AF', 'aiofilesDesc', 'https://github.com/Tinche/aiofiles'),
  createGithubEntry('anyio', 'AnyIO', 'A', 'anyioDesc', 'https://github.com/agronholm/anyio'),
  createGithubEntry(
    'python-dotenv',
    'python-dotenv',
    'DE',
    'pythonDotenvDesc',
    'https://github.com/theskumar/python-dotenv'
  ),
  createGithubEntry('pydantic', 'Pydantic 2', 'P', 'pydanticDesc', 'https://github.com/pydantic/pydantic'),
  createGithubEntry('httpx', 'HTTPX', 'H', 'httpxDesc', 'https://github.com/encode/httpx'),
  createGithubEntry('mcstatus', 'mcstatus', 'MS', 'mcstatusDesc', 'https://github.com/py-mine/mcstatus'),
  createGithubEntry('psutil', 'psutil', 'PS', 'psutilDesc', 'https://github.com/giampaolo/psutil'),
  createGithubEntry('packaging', 'packaging', 'PG', 'packagingDesc', 'https://github.com/pypa/packaging'),
  createGithubEntry('easy-tier-pyo3', 'EasyTier-PyO3', 'EP', 'easyTierPyo3Desc', URLS.easyTierPyo3.repo),
]

const frontendUtilityEntries: AboutEntry[] = [
  createGithubEntry('iconify', 'Iconify', 'I', 'iconify', 'https://github.com/iconify/iconify'),
  createGithubEntry('dompurify', 'DOMPurify', 'DP', 'dompurify', 'https://github.com/cure53/DOMPurify'),
  createGithubEntry('marked', 'Marked', 'M', 'marked', 'https://github.com/markedjs/marked'),
  createGithubEntry('sucrase', 'Sucrase', 'S', 'sucrase', 'https://github.com/alangpierce/sucrase'),
  createGithubEntry(
    'tanstack-query',
    '@tanstack/vue-query',
    'TQ',
    'tanstackQuery',
    'https://github.com/TanStack/query'
  ),
]

const engineeringEntries: AboutEntry[] = [
  createGithubEntry(
    'vite-plugin-vue',
    '@vitejs/plugin-vue',
    'VP',
    'vitePluginVue',
    'https://github.com/vitejs/vite-plugin-vue'
  ),
  createGithubEntry(
    'unplugin-auto-import',
    'unplugin-auto-import',
    'UA',
    'unpluginAutoImport',
    'https://github.com/unplugin/unplugin-auto-import'
  ),
  createGithubEntry(
    'unplugin-vue-components',
    'unplugin-vue-components',
    'UC',
    'unpluginVueComponents',
    'https://github.com/unplugin/unplugin-vue-components'
  ),
  createGithubEntry(
    'vite-plugin-checker',
    'vite-plugin-checker',
    'VC',
    'vitePluginChecker',
    'https://github.com/fi3ework/vite-plugin-checker'
  ),
  createGithubEntry(
    'vite-plugin-vue-devtools',
    'vite-plugin-vue-devtools',
    'VD',
    'vitePluginVueDevtools',
    'https://github.com/webfansplz/vite-plugin-vue-devtools'
  ),
  createGithubEntry(
    'vite-plugin-inspect',
    'vite-plugin-inspect',
    'VI',
    'vitePluginInspect',
    'https://github.com/antfu-collective/vite-plugin-inspect'
  ),
  createGithubEntry('vitest', 'Vitest', 'VT', 'vitest', 'https://github.com/vitest-dev/vitest'),
  createGithubEntry('vue-test-utils', '@vue/test-utils', 'VU', 'vueTestUtils', 'https://github.com/vuejs/test-utils'),
  createGithubEntry('jsdom', 'jsdom', 'JS', 'jsdomDesc', 'https://github.com/jsdom/jsdom'),
  createGithubEntry('pinia-testing', '@pinia/testing', 'PT', 'piniaTestingDesc', 'https://github.com/vuejs/pinia'),
  createGithubEntry('vue-tsc', 'vue-tsc', 'VS', 'vueTsc', 'https://github.com/vuejs/language-tools'),
  createGithubEntry('eslint', 'ESLint', 'ES', 'eslint', 'https://github.com/eslint/eslint'),
  createGithubEntry(
    'eslint-plugin-vue',
    'eslint-plugin-vue',
    'EV',
    'eslintPluginVueDesc',
    'https://github.com/vuejs/eslint-plugin-vue'
  ),
  createGithubEntry(
    'typescript-eslint',
    'typescript-eslint',
    'TE',
    'typescriptEslintDesc',
    'https://github.com/typescript-eslint/typescript-eslint'
  ),
  createGithubEntry('prettier', 'Prettier', 'PR', 'prettier', 'https://github.com/prettier/prettier'),
  createGithubEntry('postcss', 'PostCSS', 'PC', 'postcss', 'https://github.com/postcss/postcss'),
  createGithubEntry('autoprefixer', 'Autoprefixer', 'AP', 'autoprefixer', 'https://github.com/postcss/autoprefixer'),
  createGithubEntry('pnpm', 'pnpm', 'PN', 'pnpmDesc', 'https://github.com/pnpm/pnpm'),
  createGithubEntry('ruff', 'Ruff', 'R', 'ruff', 'https://github.com/astral-sh/ruff'),
  createGithubEntry('pyinstaller', 'PyInstaller', 'PI', 'pyinstaller', 'https://github.com/pyinstaller/pyinstaller'),
  createGithubEntry('nuitka', 'Nuitka', 'N', 'nuitka', 'https://github.com/Nuitka/Nuitka'),
  createGithubEntry('pytest', 'pytest', 'PY', 'pytest', 'https://github.com/pytest-dev/pytest'),
  createGithubEntry(
    'pytest-asyncio',
    'pytest-asyncio',
    'PA',
    'pytestAsyncio',
    'https://github.com/pytest-dev/pytest-asyncio'
  ),
  createGithubEntry(
    'python-semantic-release',
    'python-semantic-release',
    'PSR',
    'pythonSemanticRelease',
    'https://github.com/python-semantic-release/python-semantic-release'
  ),
  createGithubEntry('tomlkit', 'tomlkit', 'TK', 'tomlkit', 'https://github.com/sdispater/tomlkit'),
  createGithubEntry('debugpy', 'debugpy', 'DB', 'debugpy', 'https://github.com/microsoft/debugpy'),
  createGithubEntry('ipython', 'IPython', 'IP', 'ipython', 'https://github.com/ipython/ipython'),
  createGithubEntry('pip-tools', 'pip-tools', 'PT', 'pipTools', 'https://github.com/jazzband/pip-tools'),
]

const fontAndIconEntries: AboutEntry[] = [
  {
    id: 'harmonyos-sans-sc',
    name: 'HarmonyOS Sans SC',
    initials: 'HS',
    descriptionKey: 'harmonyOsSans',
    url: 'https://developer.huawei.com/consumer/cn/design/resource/',
    actionLabelKey: 'website',
    iconName: 'external-site',
  },
  createGithubEntry('maple-mono', 'Maple Mono', 'MM', 'mapleMono', 'https://github.com/subframe7536/maple-font'),
  createGithubEntry('tabler-icons', 'Tabler Icons', 'TI', 'tablerIcons', 'https://github.com/tabler/tabler-icons'),
]

export const technologyCategories: TechnologyCategory[] = [
  {
    id: 'runtime-frameworks',
    titleKey: 'runtimeFrameworks',
    entries: [technologies.pytaruix, technologies.easyTier],
  },
  { id: 'backend-runtime', titleKey: 'backendRuntime', entries: backendRuntimeEntries },
  { id: 'account-authentication', titleKey: 'accountAuthentication', entries: [technologies.authlibInjector] },
  {
    id: 'frontend-frameworks',
    titleKey: 'frontendFrameworks',
    entries: [
      technologies.vue,
      technologies.vite,
      technologies.pinia,
      technologies.vueRouter,
      technologies.vueI18n,
      technologies.valibot,
      technologies.typescript,
    ],
  },
  {
    id: 'ui-styling',
    titleKey: 'uiStyling',
    entries: [technologies.naiveUi, technologies.tailwind, technologies.materialColors, technologies.sass],
  },
  {
    id: 'frontend-utilities',
    titleKey: 'frontendUtilities',
    entries: [technologies.vueUse, ...frontendUtilityEntries],
  },
  { id: 'rendering', titleKey: 'rendering', entries: [technologies.skinview3d] },
  { id: 'fonts-icons', titleKey: 'fontsAndIcons', entries: fontAndIconEntries },
  { id: 'engineering', titleKey: 'engineering', entries: engineeringEntries },
]
