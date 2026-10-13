export const queryKeys = {
  config: {
    root: ['config'] as const,
    all: ['config', 'all'] as const,
  },
  launcherInfo: ['launcher-info'] as const,
  accounts: ['accounts'] as const,
  pluginRegistry: ['plugin-registry'] as const,
  instanceCategories: ['instances', 'categories'] as const,
  javaInventory: ['java', 'inventory'] as const,
  workspace: (root: string, instance: string, isolation: boolean, resource: string, detail = '') =>
    ['workspace', root, instance, isolation, resource, detail] as const,
  gameHome: {
    announcements: ['game-home', 'announcements'] as const,
  },
  instanceInstall: {
    loaderVersions: (loader: string, gameVersion: string) =>
      ['instance-install', 'loader-versions', loader, gameVersion] as const,
    fabricApiVersions: (gameVersion: string) => ['instance-install', 'fabric-api-versions', gameVersion] as const,
  },
} as const
