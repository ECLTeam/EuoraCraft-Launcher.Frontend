import type { TaskItem } from '@/composables/useTaskQueue'
import type { AccountListData, AuthlibServer, MinecraftAccount } from '@/types/accounts'
import type { SchematicPreviewData } from '@/types/api'
import type {
  GameResource,
  GameResourceType,
  MinecraftVersionCatalog,
  ScannedVersion,
  ScreenshotEntry,
  ServerEntry,
  WorldEntry,
} from '@/types/instances'
import type { ModSearchItem } from '@/types/mods'
import type { PluginInfo } from '@/types/plugins'
import type { InfoCardData } from '@/types/system'

export const showcaseConfig: Record<string, unknown> = {
  launcher: {
    version: '1.4.2-alpha.3+20260906',
    version_type: 'alpha',
    debug: true,
    api_proxy_mode: 'none',
    proxy_mode: 'none',
  },
  game: {
    minecraft_paths: [
      {
        name: '默认路径',
        path: 'Showcase/.minecraft',
        protected: true,
      },
    ],
    java_auto: true,
    java_path: 'Showcase/Java/bin/javaw.exe',
    memory_auto: false,
    memory_size: 4096,
    game_width: 1280,
    game_height: 720,
    jvm_args: ['-XX:+UseG1GC'],
    fullscreen: false,
    last_install_path: 'Showcase/.minecraft',
  },
  download: {
    mirror_source: 'official',
  },
  version_settings: {},
  ui: {
    locale: 'zh-CN',
    theme: {
      mode: 'system',
      primary_color: '#5B6FF5',
      blur_amount: 0,
      navigation_mode: 'sidebar',
      titlebar_hidden: true,
      background_opacity: 1,
    },
    background: {
      type: 'none',
      path: '',
      opacity: 1,
      blur: 0,
    },
  },
}

export const showcaseAccounts: AccountListData = {
  accounts: [
    {
      id: 'showcase-microsoft',
      alias: 'EuoraPlayer',
      type: 'microsoft',
      email: 'player@example.com',
      uuid: '8667ba71b85a4004af54457a9734eed7',
      skinUrl: `${import.meta.env.BASE_URL}img/skins/Alex.png`,
      isCurrent: true,
      capes: [{ id: 'migrator', name: 'Migrator Cape', state: 'ACTIVE', url: '' }],
    },
    {
      id: 'showcase-offline',
      alias: 'Builder',
      type: 'offline',
      uuid: 'showcase-offline-player',
      skinUrl: `${import.meta.env.BASE_URL}img/skins/Steve.png`,
      isCurrent: false,
    },
    {
      id: 'showcase-authlib',
      alias: 'ServerPlayer',
      type: 'authlib',
      auth_server: 'https://example.com/api/yggdrasil',
      uuid: 'showcase-authlib-player',
      skinUrl: `${import.meta.env.BASE_URL}img/skins/Ari.png`,
      isCurrent: false,
    },
  ],
  current: null,
}
showcaseAccounts.current = showcaseAccounts.accounts[0] ?? null

export const showcaseAuthlibServers: AuthlibServer[] = [
  {
    name: '示例认证服务器',
    url: 'https://example.com/api/yggdrasil',
    email: 'player@example.com',
    description: '仅用于展示 Authlib 账户表单，不会发起真实登录。',
  },
]

export const showcaseScannedVersions: ScannedVersion[] = [
  {
    id: '1.21.5-fabric',
    versionId: '1.21.5-Fabric 0.16.14',
    versionType: 'release',
    path: 'Showcase/.minecraft',
    displayName: '1.21.5 Fabric',
    primaryLoader: 'Fabric',
    vanillaName: '1.21.5',
    hasForge: false,
    hasNeoForge: false,
    hasFabric: true,
    hasQuilt: false,
    hasOptiFine: false,
    isBroken: false,
    jsonPath: 'Showcase/.minecraft/versions/1.21.5-Fabric/1.21.5-Fabric.json',
    sourceName: '默认路径',
  },
  {
    id: '1.20.1-forge',
    versionId: '1.20.1-Forge 47.3.22',
    versionType: 'release',
    path: 'Showcase/.minecraft',
    displayName: '1.20.1 Forge',
    primaryLoader: 'Forge',
    vanillaName: '1.20.1',
    hasForge: true,
    hasNeoForge: false,
    hasFabric: false,
    hasQuilt: false,
    hasOptiFine: true,
    isBroken: false,
    jsonPath: 'Showcase/.minecraft/versions/1.20.1-Forge/1.20.1-Forge.json',
    sourceName: '默认路径',
  },
  {
    id: '25w30a',
    versionId: '25w30a',
    versionType: 'snapshot',
    path: 'Showcase/.minecraft',
    displayName: '25w30a',
    primaryLoader: 'Vanilla',
    vanillaName: '25w30a',
    hasForge: false,
    hasNeoForge: false,
    hasFabric: false,
    hasQuilt: false,
    isBroken: false,
    jsonPath: 'Showcase/.minecraft/versions/25w30a/25w30a.json',
    sourceName: '默认路径',
  },
]

const releases = [
  { id: '1.21.8', type: 'release' as const, releaseTime: '2026-07-17T10:00:00Z' },
  { id: '1.21.7', type: 'release' as const, releaseTime: '2026-06-30T10:00:00Z' },
  { id: '1.21.6', type: 'release' as const, releaseTime: '2026-06-17T10:00:00Z' },
  { id: '1.21.5', type: 'release' as const, releaseTime: '2026-03-25T10:00:00Z' },
  { id: '1.20.1', type: 'release' as const, releaseTime: '2023-06-12T10:00:00Z' },
]
const snapshots = [
  { id: '26w29a', type: 'snapshot' as const, releaseTime: '2026-07-16T10:00:00Z' },
  { id: '26w28b', type: 'snapshot' as const, releaseTime: '2026-07-10T10:00:00Z' },
]
const aprilFools = [{ id: '25w14craftmine', type: 'april_fools' as const, releaseTime: '2025-04-01T10:00:00Z' }]
const oldBeta = [{ id: 'b1.7.3', type: 'old_beta' as const, releaseTime: '2011-07-08T10:00:00Z' }]
const oldAlpha = [{ id: 'a1.2.6', type: 'old_alpha' as const, releaseTime: '2010-12-03T10:00:00Z' }]

export const showcaseVersionCatalog: MinecraftVersionCatalog = {
  all: [...releases, ...snapshots, ...aprilFools, ...oldBeta, ...oldAlpha],
  release: releases,
  snapshot: snapshots,
  april_fools: aprilFools,
  old_beta: oldBeta,
  old_alpha: oldAlpha,
}

export const showcaseLoaderVersions: Record<string, string[]> = {
  fabric_versions: ['0.16.14', '0.16.13'],
  forge_versions: ['55.0.9', '55.0.8'],
  neoforge_versions: ['21.8.2-beta'],
  optifine_versions: ['HD_U_J1_pre2'],
  quilt_versions: ['0.28.1'],
}

export const showcasePlugins: PluginInfo[] = [
  {
    name: 'showcase-dashboard',
    title: '启动器数据面板',
    version: '1.2.0',
    description: '演示插件卡片、状态操作和宿主能力展示。',
    author: 'ECLTeam',
    icon: '',
    status: 'enabled',
    error: null,
    dependencies: {},
    services: ['dashboard'],
    is_system: false,
  },
  {
    name: 'showcase-theme',
    title: 'Aurora 主题',
    version: '0.8.3',
    description: '演示处于禁用状态的主题插件。',
    author: 'Community',
    icon: '',
    status: 'disabled',
    error: null,
    dependencies: {},
    services: ['theme'],
    is_system: false,
  },
  {
    name: 'ecl-system-bridge',
    title: 'ECL 系统桥接',
    version: '0.2.0',
    description: '启动器内置系统插件示例。',
    author: 'ECLTeam',
    icon: '',
    status: 'enabled',
    error: null,
    dependencies: {},
    services: ['system'],
    is_system: true,
  },
]

export const showcaseMods: ModSearchItem[] = [
  {
    id: 'modrinth:sodium',
    projectId: 'sodium',
    slug: 'sodium',
    title: 'Sodium',
    displayTitle: '钠',
    description: '现代化的 Minecraft 渲染优化 Mod。',
    author: 'CaffeineMC',
    downloads: 128_000_000,
    follows: 720_000,
    dateModified: '2026-07-18T12:00:00Z',
    source: 'modrinth',
    projectUrl: 'https://modrinth.com/mod/sodium',
    categories: ['optimization'],
    loaders: ['fabric', 'quilt'],
    gameVersions: ['1.21.5'],
    alternatives: [
      { source: 'modrinth', projectId: 'sodium', slug: 'sodium', projectUrl: 'https://modrinth.com/mod/sodium' },
      {
        source: 'curseforge',
        projectId: '394468',
        slug: 'sodium',
        projectUrl: 'https://www.curseforge.com/minecraft/mc-mods/sodium',
      },
    ],
    wiki: {
      id: '2785',
      title: '钠',
      englishName: 'Sodium',
      summary: '现代化的 Minecraft 渲染优化模组。',
      url: 'https://www.mcmod.cn/class/2785.html',
    },
  },
  {
    id: 'modrinth:iris',
    projectId: 'iris',
    slug: 'iris',
    title: 'Iris Shaders',
    displayTitle: 'Iris 光影',
    description: '支持现代光影包并与 Sodium 协同工作。',
    author: 'IrisShaders',
    downloads: 84_000_000,
    follows: 460_000,
    dateModified: '2026-07-16T12:00:00Z',
    source: 'modrinth',
    projectUrl: 'https://modrinth.com/mod/iris',
    categories: ['optimization'],
    loaders: ['fabric', 'quilt'],
    gameVersions: ['1.21.5'],
    alternatives: [
      { source: 'modrinth', projectId: 'iris', slug: 'iris', projectUrl: 'https://modrinth.com/mod/iris' },
    ],
  },
  {
    id: 'modrinth:fabric-api',
    projectId: 'fabric-api',
    slug: 'fabric-api',
    title: 'Fabric API',
    displayTitle: 'Fabric API',
    description: 'Fabric 生态常用的基础 API 集合。',
    author: 'FabricMC',
    downloads: 210_000_000,
    follows: 530_000,
    dateModified: '2026-07-20T12:00:00Z',
    source: 'modrinth',
    projectUrl: 'https://modrinth.com/mod/fabric-api',
    categories: ['library'],
    loaders: ['fabric'],
    gameVersions: ['1.21.5'],
    alternatives: [
      {
        source: 'modrinth',
        projectId: 'fabric-api',
        slug: 'fabric-api',
        projectUrl: 'https://modrinth.com/mod/fabric-api',
      },
    ],
  },
]

export const showcaseInfoCard: InfoCardData = {
  mode: 'rotate',
  tip_title: '你知道吗',
  announcement_title: '公告',
  tips: [
    '展示模式设置会保存在当前浏览器中，不会写入后端配置。',
    '可以在实例页体验搜索、筛选和安装流程。',
    '插件页提供启用、禁用和重载交互示例。',
  ],
  announcements: [
    {
      id: 'showcase-frontend-refactor',
      title: '前端重构展示模式',
      date: '2026-07-23',
      content:
        '当前界面由独立的 **Showcase Transport** 提供数据，可脱离 PyTauri 运行。\n\n- 支持 Markdown 公告\n- 点击公告卡片可以查看完整内容',
    },
  ],
  welcome: {
    title: '欢迎进入 ECL 展示模式',
    content: '这里可以安全查看和测试启动器的主要前端功能。',
  },
  interval: 8000,
}

export function createShowcaseAccount(
  alias: string,
  type: MinecraftAccount['type'] = 'offline',
  uuid?: string
): MinecraftAccount {
  return {
    id: `showcase-${type}-${Date.now()}`,
    alias,
    type,
    uuid: uuid || `showcase-${alias.toLowerCase().replace(/\s+/g, '-')}`,
    skinUrl: `${import.meta.env.BASE_URL}img/skins/Sunny.png`,
    isCurrent: false,
  }
}

// ===========================================================================
// Instance Workspace：存档 / 截图 / 服务器 / 资源 演示数据
// ===========================================================================

export const showcaseWorlds: WorldEntry[] = [
  {
    id: 'New World',
    name: '主要生存世界',
    path: 'Showcase/.minecraft/saves/New World',
    iconPath: null,
    gameMode: 'Survival',
    gameModeId: 0,
    difficulty: 'Normal',
    difficultyId: 2,
    difficultyLocked: false,
    allowCommands: false,
    version: '1.21.5',
    seed: '-4172144997902289642',
    spawn: { x: 128, y: 64, z: -256 },
    weather: { raining: false, thundering: false },
    lastPlayedAt: '2026-09-08T20:31:00Z',
    modifiedAt: '2026-09-08T20:31:00Z',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'Creative Flatland',
    name: '建筑超平坦',
    path: 'Showcase/.minecraft/saves/Creative Flatland',
    iconPath: null,
    gameMode: 'Creative',
    gameModeId: 1,
    difficulty: 'Peaceful',
    difficultyId: 0,
    difficultyLocked: false,
    allowCommands: true,
    version: '1.21.5',
    seed: '2484293',
    spawn: { x: 0, y: 4, z: 0 },
    weather: { raining: false, thundering: false },
    lastPlayedAt: '2026-08-27T14:02:00Z',
    modifiedAt: '2026-08-27T14:02:00Z',
    createdAt: '2026-06-15T09:30:00Z',
  },
  {
    id: 'Old Challenge',
    name: '1.20 老存档挑战',
    path: 'Showcase/.minecraft/saves/Old Challenge',
    iconPath: null,
    gameMode: 'Survival',
    gameModeId: 0,
    difficulty: 'Hard',
    difficultyId: 3,
    difficultyLocked: true,
    allowCommands: false,
    version: '1.20.1',
    seed: '8675309',
    spawn: { x: -32, y: 72, z: 96 },
    weather: { raining: true, thundering: false },
    lastPlayedAt: '2026-02-14T11:45:00Z',
    modifiedAt: '2026-02-14T11:45:00Z',
    createdAt: '2025-11-20T18:00:00Z',
  },
]

export interface ShowcaseWorldBackup {
  id: string
  createdAt?: string
  locked: boolean
  automatic: boolean
  size: number
}

/** 生成某存档的演示备份列表（index 区分不同存档） */
export function makeShowcaseWorldBackups(worldIndex: number): ShowcaseWorldBackup[] {
  if (worldIndex % 3 === 2) return []
  return [
    {
      id: `backup-auto-${worldIndex}-1`,
      createdAt: '2026-09-08T18:00:00Z',
      locked: false,
      automatic: true,
      size: 48_600_000,
    },
    {
      id: `backup-auto-${worldIndex}-2`,
      createdAt: '2026-09-07T18:00:00Z',
      locked: worldIndex % 2 === 0,
      automatic: true,
      size: 47_100_000,
    },
    {
      id: `backup-manual-${worldIndex}-1`,
      createdAt: '2026-09-01T09:12:00Z',
      locked: true,
      automatic: false,
      size: 45_800_000,
    },
  ]
}

export const showcaseServers: ServerEntry[] = [
  { id: 'srv-hypixel', name: 'Hypixel', address: 'mc.hypixel.net', icon: null, favorite: true, order: 0 },
  { id: 'srv-local', name: '本地开发服', address: '127.0.0.1:25565', icon: null, favorite: false, order: 1 },
  { id: 'srv-demo', name: 'ECL 演示生存服', address: 'demo.euoracraft.dev', icon: null, favorite: false, order: 2 },
]

export const showcaseScreenshots: ScreenshotEntry[] = [
  {
    id: 'shot-1',
    name: 'screenshot-2026-09-08-20.31.04',
    path: 'Showcase/.minecraft/screenshots/screenshot-2026-09-08-20.31.04.png',
    width: 1920,
    height: 1080,
    size: 1_820_000,
    modifiedAt: '2026-09-08T20:31:04Z',
    dateGroup: '2026-09-08',
  },
  {
    id: 'shot-2',
    name: 'screenshot-2026-09-08-20.29.51',
    path: 'Showcase/.minecraft/screenshots/screenshot-2026-09-08-20.29.51.png',
    width: 1920,
    height: 1080,
    size: 1_640_000,
    modifiedAt: '2026-09-08T20:29:51Z',
    dateGroup: '2026-09-08',
  },
  {
    id: 'shot-3',
    name: 'screenshot-2026-08-27-14.05.12',
    path: 'Showcase/.minecraft/screenshots/screenshot-2026-08-27-14.05.12.png',
    width: 2560,
    height: 1440,
    size: 2_960_000,
    modifiedAt: '2026-08-27T14:05:12Z',
    dateGroup: '2026-08-27',
  },
]

export const showcaseResources: Record<Exclude<GameResourceType, 'mod'>, GameResource[]> = {
  resourcepack: [
    {
      id: 'rp-faithful',
      type: 'resourcepack',
      path: 'Showcase/.minecraft/resourcepacks/Faithful-32x.zip',
      name: 'Faithful 32x',
      version: '1.21.5',
      enabled: true,
      size: 12_600_000,
      modifiedAt: '2026-07-02T10:00:00Z',
      sha512: null,
      source: 'local',
    },
    {
      id: 'rp-vanilla-tweaks',
      type: 'resourcepack',
      path: 'Showcase/.minecraft/resourcepacks/VanillaTweaks.zip',
      name: 'Vanilla Tweaks',
      enabled: false,
      size: 3_400_000,
      modifiedAt: '2026-05-18T10:00:00Z',
      sha512: null,
      source: 'local',
    },
  ],
  shaderpack: [
    {
      id: 'sp-bsl',
      type: 'shaderpack',
      path: 'Showcase/.minecraft/shaderpacks/BSL-Shaders-8.4.zip',
      name: 'BSL Shaders 8.4',
      enabled: true,
      size: 5_100_000,
      modifiedAt: '2026-07-20T10:00:00Z',
      sha512: null,
      source: 'local',
    },
    {
      id: 'sp-complementary',
      type: 'shaderpack',
      path: 'Showcase/.minecraft/shaderpacks/Complementary-Reimagined.zip',
      name: 'Complementary Reimagined',
      enabled: false,
      size: 4_300_000,
      modifiedAt: '2026-06-11T10:00:00Z',
      sha512: null,
      source: 'local',
    },
  ],
  datapack: [
    {
      id: 'dp-terralith',
      type: 'datapack',
      path: 'Showcase/.minecraft/saves/New World/datapacks/Terralith.zip',
      name: 'Terralith',
      version: '2.5',
      enabled: true,
      size: 8_200_000,
      modifiedAt: '2026-06-30T10:00:00Z',
      sha512: null,
      source: 'local',
    },
  ],
  schematic: [
    {
      id: 'sch-base-tower',
      type: 'schematic',
      path: 'Showcase/.minecraft/schematics/生存基地主塔.litematic',
      name: '生存基地主塔',
      version: '1.21.5',
      enabled: true,
      size: 480_000,
      modifiedAt: '2026-08-15T10:00:00Z',
      sha512: null,
      source: 'local',
    },
  ],
}

/** 极小演示原理图：8×1×8 石砖/深板岩棋盘平台，供 3D 预览渲染 */
export const showcaseSchematicPreview: SchematicPreviewData = {
  type: 'litematic',
  size: [8, 1, 8],
  regions: [
    {
      name: 'platform',
      size: [8, 1, 8],
      position: [0, 0, 0],
      palette: [
        { name: 'minecraft:air', properties: {}, color: [0, 0, 0] },
        { name: 'minecraft:stone_bricks', properties: {}, color: [126, 126, 126] },
        { name: 'minecraft:deepslate', properties: {}, color: [94, 84, 76] },
      ],
      indices: Array.from({ length: 64 }, (_, i) => (i % 2) + 1),
    },
  ],
}

/** 典型 options.txt 条目（实例设置页签演示用） */
export const showcaseGameOptions = [
  { key: 'renderDistance', value: 12, type: 'int', min: 2, max: 32 },
  { key: 'maxFps', value: 120, type: 'int', min: 10, max: 260 },
  { key: 'guiScale', value: 2, type: 'int', min: 0, max: 4 },
  { key: 'musicVolume', value: 0.4, type: 'float', min: 0, max: 1 },
  { key: 'mouseSensitivity', value: 0.5, type: 'float', min: 0, max: 1 },
  { key: 'fullscreen', value: false, type: 'bool' },
  { key: 'lang', value: 'zh_cn', type: 'string' },
] as const

// ── 按资源类型区分的在线搜索演示数据 ──

interface SearchItemSeed {
  id: string
  title: string
  displayTitle: string
  description: string
  author: string
  downloads: number
  categories: string[]
}

function makeShowcaseSearchItem(resourceType: string, seed: SearchItemSeed): ModSearchItem {
  return {
    id: `modrinth:${seed.id}`,
    projectId: seed.id,
    slug: seed.id,
    title: seed.title,
    displayTitle: seed.displayTitle,
    description: seed.description,
    author: seed.author,
    downloads: seed.downloads,
    follows: Math.round(seed.downloads / 180),
    dateModified: '2026-08-30T12:00:00Z',
    source: 'modrinth',
    projectUrl: `https://modrinth.com/${resourceType}/${seed.id}`,
    categories: seed.categories,
    loaders: [],
    gameVersions: ['1.21.5', '1.20.1'],
    alternatives: [],
  }
}

/** 各资源类型的在线搜索演示结果；mod 复用 showcaseMods */
export const showcaseSearchItemsByType: Record<string, ModSearchItem[]> = {
  mod: showcaseMods,
  resourcepack: [
    makeShowcaseSearchItem('resourcepack', {
      id: 'faithful-32x',
      title: 'Faithful 32x',
      displayTitle: 'Faithful 32x',
      description: '经典高分辨率原版风格资源包。',
      author: 'Vattic',
      downloads: 42_000_000,
      categories: ['faithful', '16x'],
    }),
    makeShowcaseSearchItem('resourcepack', {
      id: 'vanilla-tweaks',
      title: 'Vanilla Tweaks',
      displayTitle: 'Vanilla Tweaks',
      description: '可自由组合的原版微调资源包。',
      author: 'VanillaTweaks',
      downloads: 18_000_000,
      categories: ['vanilla'],
    }),
  ],
  shaderpack: [
    makeShowcaseSearchItem('shaderpack', {
      id: 'bsl-shaders',
      title: 'BSL Shaders',
      displayTitle: 'BSL 光影',
      description: '柔和光影与可玩性兼顾的通用光影包。',
      author: 'Capt Tatsu',
      downloads: 36_000_000,
      categories: ['vanilla-like', 'performance'],
    }),
    makeShowcaseSearchItem('shaderpack', {
      id: 'complementary-reimagined',
      title: 'Complementary Reimagined',
      displayTitle: 'Complementary 重构版',
      description: '保持原版观感的光影重构方案。',
      author: 'EminGT',
      downloads: 28_000_000,
      categories: ['vanilla-like'],
    }),
  ],
  datapack: [
    makeShowcaseSearchItem('datapack', {
      id: 'terralith',
      title: 'Terralith',
      displayTitle: 'Terralith',
      description: '原版风格的地形与生物群系扩展数据包。',
      author: 'Starmute',
      downloads: 15_000_000,
      categories: ['worldgen'],
    }),
    makeShowcaseSearchItem('datapack', {
      id: 'chunky',
      title: 'Chunky',
      displayTitle: 'Chunky',
      description: '预生成区块，提升服务器运行效率。',
      author: 'pop4959',
      downloads: 9_200_000,
      categories: ['utility'],
    }),
  ],
  world: [
    makeShowcaseSearchItem('world', {
      id: 'midnight-survival',
      title: 'Midnight Survival',
      displayTitle: '午夜生存存档',
      description: '生存 300 天的进阶存档，含自动化农场。',
      author: 'ShowcaseBuilder',
      downloads: 1_800_000,
      categories: ['survival'],
    }),
    makeShowcaseSearchItem('world', {
      id: 'skyblock-classic',
      title: 'Skyblock Classic',
      displayTitle: '经典空岛生存',
      description: '重制版经典空岛地图，含挑战清单。',
      author: 'ShowcaseBuilder',
      downloads: 6_400_000,
      categories: ['skyblock', 'map'],
    }),
  ],
}

/** 共享 .minecraft 目录的演示模组：Fabric 与 Forge 各一（非隔离目录混装属正常情况） */
export const showcaseInstanceMods = [
  {
    filename: 'sodium-fabric.jar',
    name: 'Sodium',
    version: '0.6.13',
    author: 'CaffeineMC',
    loader_type: 'Fabric',
    game_version: '1.21.5',
    enabled: true,
  },
  {
    filename: 'jei-1.20.1-forge-15.3.0.4.jar',
    name: 'Just Enough Items (JEI)',
    version: '15.3.0.4',
    author: 'mezz',
    loader_type: 'Forge',
    game_version: '1.20.1',
    enabled: true,
  },
]

// ===========================================================================
// Demo Task Queue
// ===========================================================================

/** Interface for pre-populating the task queue in showcase mode */
export interface DemoTaskDef {
  type: 'install' | 'download'
  name: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'canceled'
  progress: number
  message: string
  versionId: string
  loaderType: string
  subtasks?: { id: string; name: string; status: 'pending' | 'running' | 'completed' | 'error'; message: string }[]
  /** 下载指标：进度模式/已完成量/总量/文件数/速度，用于演示实时下载卡 */
  progressType?: 'bytes' | 'files'
  done?: number
  total?: number
  totalFiles?: number
  downloadedFiles?: number
  speed?: number
}

/** Demo task definitions for showcase mode */
export const showcaseDemoTasks: DemoTaskDef[] = [
  {
    type: 'download',
    name: '下载 Minecraft 1.21.5',
    status: 'running',
    progress: 65,
    message: '正在下载 client.jar (12.4 MB / 18.9 MB)',
    versionId: '1.21.5',
    loaderType: 'Vanilla',
    progressType: 'bytes',
    done: 13.4 * 1024 * 1024,
    total: 18.9 * 1024 * 1024,
    totalFiles: 128,
    downloadedFiles: 83,
    speed: 3.2 * 1024 * 1024,
    subtasks: [
      { id: 'sub1', name: '下载 JSON 索引', status: 'completed', message: '已完成' },
      { id: 'sub2', name: '下载 client.jar', status: 'running', message: '65%' },
      { id: 'sub3', name: '下载资源文件', status: 'pending', message: '等待中' },
      { id: 'sub4', name: '下载库文件', status: 'pending', message: '等待中' },
    ],
  },
  {
    type: 'install',
    name: '安装 Forge 55.0.9',
    status: 'pending',
    progress: 0,
    message: '等待 Minecraft 1.21.5 下载完成...',
    versionId: '1.21.5',
    loaderType: 'Forge',
  },
  {
    type: 'install',
    name: '安装 OptiFine HD U J1',
    status: 'completed',
    progress: 100,
    message: '安装完成，已注入到 1.21.5',
    versionId: '1.21.5',
    loaderType: 'OptiFine',
  },
  {
    type: 'download',
    name: '删除旧实例 1.16.5',
    status: 'error',
    progress: 34,
    message: '部分文件被其他进程占用，无法删除',
    versionId: '1.16.5',
    loaderType: 'Vanilla',
  },
  {
    type: 'install',
    name: '更新插件 世界备份 v2.0.1',
    status: 'pending',
    progress: 0,
    message: '队列中，等待当前任务完成',
    versionId: '',
    loaderType: '',
  },
  {
    type: 'download',
    name: '下载光影包 SEUS v11',
    status: 'canceled',
    progress: 12,
    message: '用户取消了下载',
    versionId: '',
    loaderType: '',
  },
  {
    type: 'install',
    name: '安装 Fabric API 0.16.10',
    status: 'completed',
    progress: 100,
    message: '已安装到 1.21.5 Fabric',
    versionId: '1.21.5',
    loaderType: 'Fabric',
  },
]

/** Load demo tasks into the global task queue (call once in showcase mode) */
export function loadShowcaseTasks(globalTaskQueue: {
  addTask: (task: { type: 'install' | 'download'; name: string; versionId: string; loaderType: string }) => string
  updateTask: (
    id: string,
    updates: Partial<
      Pick<
        TaskItem,
        | 'status'
        | 'progress'
        | 'message'
        | 'subtasks'
        | 'progressType'
        | 'done'
        | 'total'
        | 'totalFiles'
        | 'downloadedFiles'
        | 'speed'
      >
    >
  ) => void
  addSubtask: (
    id: string,
    subtask: { id: string; name: string; status: 'pending' | 'running' | 'completed' | 'error'; message: string }
  ) => void
}): void {
  for (const def of showcaseDemoTasks) {
    const taskId = globalTaskQueue.addTask({
      type: def.type,
      name: def.name,
      versionId: def.versionId,
      loaderType: def.loaderType,
    })
    globalTaskQueue.updateTask(taskId, {
      status: def.status,
      progress: def.progress,
      message: def.message,
      progressType: def.progressType,
      done: def.done,
      total: def.total,
      totalFiles: def.totalFiles,
      downloadedFiles: def.downloadedFiles,
      speed: def.speed,
    })
    if (def.subtasks) {
      for (const sub of def.subtasks) {
        globalTaskQueue.addSubtask(taskId, sub)
      }
    }
  }
}
