export const queryKeys = {
  config: {
    root: ['config'] as const,
    all: ['config', 'all'] as const,
  },
  launcherInfo: ['launcher-info'] as const,
  accounts: ['accounts'] as const,
  pluginRegistry: ['plugin-registry'] as const,
  gameHome: {
    infoCard: ['game-home', 'info-card'] as const,
  },
  instanceInstall: {
    loaderVersions: (loader: string, gameVersion: string) =>
      ['instance-install', 'loader-versions', loader, gameVersion] as const,
    fabricApiVersions: (gameVersion: string) => ['instance-install', 'fabric-api-versions', gameVersion] as const,
  },
} as const
