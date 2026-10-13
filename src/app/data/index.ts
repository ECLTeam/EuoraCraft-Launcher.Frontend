// 领域查询的稳定公开入口，缓存与刷新由各领域定义和共享协调器维护。
export { configQuery, invalidateConfig, type SettingsSnapshot } from './configQueries'
export { accountsQuery, invalidateAccounts, setAccountsSnapshot } from './accountQueries'
export { launcherInfoQuery } from './runtimeQueries'
export { pluginRegistryQuery, invalidatePluginRegistry, type PluginRegistry } from './pluginQueries'
