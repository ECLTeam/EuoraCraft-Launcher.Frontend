// ============================================================
// 外部链接统一管理
// 所有外部 URL 集中在此，方便维护和批量替换
// ============================================================

export const URLS = {
  /** 项目文档 */
  docs: 'https://docs.eclteam.top',

  /** 用户协议 */
  userAgreement: 'https://euoracraft.zient.top/guide/user-agreement/',

  /** GitHub 组织 */
  githubOrg: 'https://github.com/ECLTeam',

  /** 提交问题（Issue） */
  issues: 'https://github.com/ECLTeam/EuoraCraft-Launcher/issues',

  /** Qomicex-Public GitHub 组织 */
  qomicexPublic: 'https://github.com/Qomicex-Public',

  /** 头像服务 */
  avatarApi: 'https://api.mcheads.org/head',

  /** 镜像源 */
  bmclapi: 'https://bmclapi2.bangbang93.com',

  // ---- 技术栈链接 ----

  pytauri: {
    repo: 'https://github.com/WSH032/pytauri',
    license: 'https://github.com/WSH032/pytauri/blob/main/LICENSE',
  },
  vue: {
    repo: 'https://github.com/vuejs/core',
    license: 'https://github.com/vuejs/core/blob/main/LICENSE',
  },
  vite: {
    repo: 'https://github.com/vitejs/vite',
    license: 'https://github.com/vitejs/vite/blob/main/LICENSE',
  },
  tauri: {
    repo: 'https://github.com/tauri-apps/tauri',
    license: 'https://github.com/tauri-apps/tauri/blob/dev/LICENSE_APACHE-2.0',
  },
  naiveUi: {
    repo: 'https://github.com/tusen-ai/naive-ui',
    license: 'https://github.com/tusen-ai/naive-ui/blob/main/LICENSE',
  },
  authlibInjector: {
    repo: 'https://github.com/yushijinhun/authlib-injector',
    license: 'https://github.com/yushijinhun/authlib-injector/blob/develop/LICENSE',
  },
  pinia: {
    repo: 'https://github.com/vuejs/pinia',
    license: 'https://github.com/vuejs/pinia/blob/v4/LICENSE',
  },
  vueRouter: {
    repo: 'https://github.com/vuejs/router',
    license: 'https://github.com/vuejs/router/blob/main/LICENSE',
  },
  vueI18n: {
    repo: 'https://github.com/intlify/vue-i18n',
    license: 'https://github.com/intlify/vue-i18n/blob/master/LICENSE',
  },
  vueUse: {
    repo: 'https://github.com/vueuse/vueuse',
    license: 'https://github.com/vueuse/vueuse/blob/main/LICENSE',
  },
  tailwind: {
    repo: 'https://github.com/tailwindlabs/tailwindcss',
    license: 'https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE',
  },
  valibot: {
    repo: 'https://github.com/fabian-hiller/valibot',
    license: 'https://github.com/fabian-hiller/valibot/blob/main/LICENSE.md',
  },
  typescript: {
    repo: 'https://github.com/microsoft/TypeScript',
    license: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt',
  },
  skinview3d: {
    repo: 'https://github.com/bs-community/skinview3d',
    license: 'https://github.com/bs-community/skinview3d/blob/master/LICENSE',
  },
  easyTier: {
    repo: 'https://github.com/EasyTier/EasyTier',
    license: 'https://github.com/EasyTier/EasyTier/blob/main/LICENSE',
  },
  easyTierPyo3: {
    repo: 'https://github.com/ECLTeam/EasyTier-PyO3',
    license: 'https://github.com/ECLTeam/EasyTier-PyO3/blob/main/LICENSE',
  },
  scaffoldingMC: {
    repo: 'https://github.com/Scaffolding-MC/Scaffolding-MC',
    license: 'https://github.com/Scaffolding-MC/Scaffolding-MC/blob/main/LICENSE',
  },
  hmcl: {
    repo: 'https://github.com/HMCL-dev/HMCL',
    license: 'https://github.com/HMCL-dev/HMCL/blob/main/LICENSE',
  },
  pcl: {
    repo: 'https://github.com/PCL-Community/PCL-CE',
    license: 'https://github.com/PCL-Community/PCL-CE/blob/dev/LICENSE',
  },
  modrinth: 'https://modrinth.com',
  curseforge: 'https://www.curseforge.com/minecraft',
  mcmod: 'https://www.mcmod.cn',
} as const

/** 头像 URL 构建 */
export function getAvatarUrl(uuid: string, size = 64): string {
  const cleanUuid = uuid.replace(/-/g, '')
  return `${URLS.avatarApi}/${cleanUuid}/${size}`
}
