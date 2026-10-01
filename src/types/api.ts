import type {
  AccountListData,
  AccountTextures,
  AuthlibLoginConfigData,
  AuthlibServer,
  AuthProvider,
  DefaultSkin,
  ImageDataUrl,
  ImageListResult,
  ImageSaveUrlResult,
  ImageSelection,
  MicrosoftCompleteData,
  MicrosoftLoginConfigData,
  MicrosoftLoginData,
  MicrosoftLoginStatusEvent,
  MicrosoftPollData,
  MinecraftAccount,
  SelectResult,
  SkinModel,
  WardrobeImportResult,
  WardrobeItem,
  WardrobeKind,
} from '@/types/accounts'
import type {
  BackgroundConfig,
  ConfigSection,
  DownloadConfig,
  GameConfig,
  LauncherConfig,
  SystemMemoryInfo,
  ThemeConfig,
  WindowBounds,
  WindowMetadata,
} from '@/types/config'
import type { ConnectorMatchResult, ConnectorStatus, EasyTierStatus, NatTypeResult } from '@/types/connect'
import type {
  CrashAnalysisResult,
  CrashCandidateFile,
  GameInstance,
  GameInstancesChangedEvent,
  GameOperation,
  GameResource,
  GameResourceType,
  InstallProgress,
  InstallVersionResult,
  InstanceCategory,
  InstanceProfile,
  InstanceTargetPayload,
  JavaInstallation,
  LaunchInstanceResult,
  LaunchProgress,
  MinecraftVersion,
  MinecraftVersionCatalog,
  ScannedVersion,
  ScreenshotEntry,
  ServerEntry,
  ServerStatus,
  VersionRunStats,
  WorldEntry,
} from '@/types/instances'
import type {
  ModInfo,
  ModInstallResult,
  ModItem,
  ModpackTypeInfo,
  ModSearchResult,
  ModSourceConfig,
  ModVersion,
  ResourcePack,
  SaveEntry,
  ShaderPack,
} from '@/types/mods'
import type {
  PluginInfo,
  PluginPackagePreflight,
  PluginRoute,
  PluginSettingsData,
  PluginSlotItem,
  VueComponentDef,
  VueSlotItem,
} from '@/types/plugins'
import type {
  DebugMaintenanceResult,
  FileContent,
  FsEntry,
  ImageSaveAsPayload,
  InfoCardData,
  LauncherErrorEvent,
  LauncherInfo,
  LauncherPopupEvent,
  PathInfo,
  ProcessInstance,
  ProcessLogEntry,
  TerminalLogEntry,
  UpdateApplyResult,
  UpdateCheckResult,
  UpdateDownloadResult,
  UpdateProgressEvent,
  UpdateStatus,
  UserAgreement,
} from '@/types/system'
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errorCode?: string
  presentation?: 'message' | 'modal'
  errorId?: string
  title?: string
  detail?: string
  timestamp?: number
}

export type JsonDict = Record<string, unknown>

// ═══════════════════════════════════════════════════════════════════
//  应用配置
// ═══════════════════════════════════════════════════════════════════

export interface BackendEvents {
  'config:init': {
    launcher: LauncherConfig
    game: GameConfig
    download: DownloadConfig
    ui: ThemeConfig & {
      locale?: string
      background?: Partial<BackgroundConfig>
    }
  }
  'launcher:open_page': { page: 'games' | 'instances' | 'download' | 'settings' | 'more' }
  'launcher:visibility': {
    action: 'none' | 'minimize' | 'quit'
  }
  'launcher:notify': {
    type: 'info' | 'warning' | 'error'
    title: string
    message: string
    /** 事件来源；插件来源的警告/错误弹窗优先级被钳制在低区段。 */
    source?: 'launcher' | 'plugin'
  }
  'launcher:agreement_required': Record<string, never>
  'launcher:error': LauncherErrorEvent
  'launcher:popup': LauncherPopupEvent
  'launcher:log': TerminalLogEntry
  'process:instance_log': ProcessLogEntry
  'process:instances_changed': ProcessInstance[]
  'update:progress': UpdateProgressEvent
  'update:check_completed': UpdateCheckResult
  'game:install_progress': InstallProgress
  'game:launch_progress': LaunchProgress
  'game:operation_progress': GameOperation
  'game:versions_changed': { gamePath: string }
  'game:instances_changed': GameInstancesChangedEvent
  'mods:install_progress': { phase: 'resolving' | 'downloading'; projectId?: string; filename?: string }
  accounts_changed: AccountListData
  accounts_microsoft_login_status: MicrosoftLoginStatusEvent
  'plugin:status_changed': { name: string; action: string; result: string }
  'plugin:installed': { name: string }
  'plugin:css_injected': { plugin: string; css: string; key?: string | null }
  'plugin:script_injected': { plugin: string; script: string }
  'plugin:typescript_injected': { plugin: string; script: string }
  'plugin:html_injected': {
    plugin: string
    slot: string
    html: string
    key?: string | null
    priority?: number
    contextKey?: string
  }
  'config:updated': { section: string; data: unknown }
  'plugin:route_registered': { plugin: string; path: string; title: string; icon?: string }
  'plugin:vue_route_registered': {
    plugin: string
    path: string
    title: string
    component_name: string
    template: string
    script: string
    style: string
    icon?: string
  }
  'plugin:vue_slot_registered': {
    plugin: string
    slot: string
    component_name: string
    template: string
    script: string
    style: string
    contextKey?: string
  }
  'plugin:settings_changed': { plugin: string; key: string; old_value: unknown; new_value: unknown }
  'window:opened': WindowMetadata
  'window:ready': WindowMetadata
  'window:closed': Partial<WindowMetadata> & { label: string }
}

export type BackendEventName = keyof BackendEvents

// ═══════════════════════════════════════════════════════════════════
//  命令参数映射
// ═══════════════════════════════════════════════════════════════════

export type SchematicLocale = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ru-RU' | 'de-DE'

export interface CommandPayloadMap {
  system_ping: undefined
  launcher_errors_pending: undefined
  launcher_errors_ack: { error_ids: string[] }

  // 配置
  settings_get: { section?: ConfigSection; sections?: ConfigSection[] } | undefined
  settings_set: { section: ConfigSection; data: unknown }

  // 受控窗口
  window_list: undefined
  window_open: { descriptor_id: string; session_id?: string; instance_key?: string }
  window_focus: { label: string }
  window_close: { label: string }
  window_update_bounds: { label: string } & WindowBounds

  // 前端日志上报
  frontend_log: { level: 'warn' | 'error'; message: string; detail?: string; logger?: string }

  // 系统信息
  system_memory: undefined

  // 联机（当前仅声明前端契约，后端实现后直接接入）
  connector_nodes_get: undefined
  connector_nodes_set: { mode: 'automatic' | 'append' | 'custom'; nodes: string[] }
  connector_status: undefined
  launcher_preload_connector: undefined
  connector_host_port: { port: number }
  connector_host_instance: InstanceTargetPayload
  connector_join: { code: string }
  connector_leave: undefined
  connector_kick: { machine_id: string }
  connector_match_instances: undefined
  connector_easytier_status: undefined
  connector_easytier_download: undefined
  connector_detect_ports: undefined
  connector_search_mc_port: { ports: number[] }
  connector_nat_type: undefined

  // Java
  game_java_scan: { paths?: string[] } | undefined

  // 版本
  game_versions: { filter_type?: string; classified?: boolean; source?: 'official' | 'bmclapi' } | undefined
  game_loader_versions: {
    loader: 'fabric' | 'forge' | 'neoforge' | 'quilt'
    game_version: string
    source?: 'official' | 'bmclapi'
  }
  game_fabric_api_versions: {
    loader: 'fabric'
    game_version: string
  }
  game_scan: { paths?: string[]; force?: boolean }
  game_install: {
    version_id: string
    version_name?: string
    loader_type?: 'fabric' | 'forge' | 'neoforge' | 'quilt'
    loader_version?: string
    fabric_api_version?: string
    task_id?: string
    game_path: string
    java_path?: string
    source?: 'official' | 'bmclapi'
  }
  game_uninstall: { version_id: string; game_path: string }

  // 实例路径 ecl.json
  game_config_get: { game_path: string }
  game_config_set: { game_path: string; data: Record<string, unknown> }
  game_config_patch: { game_path: string; patch: Record<string, unknown> }

  // 账户
  accounts_list: undefined
  accounts_current: undefined
  accounts_auth_providers: undefined
  accounts_add_plugin: { provider_id: string; values: Record<string, string> }
  accounts_add_offline: { username: string; uuid?: string; skin?: string }
  accounts_default_skins: undefined
  accounts_set_offline_skin: { account_id: string; skin?: string }
  accounts_add_authlib: {
    server_url: string
    email: string
    password: string
  }
  accounts_select_authlib_profile: { account_id: string; profile_id: string }
  authlib_resolve_server: { server_url: string }
  accounts_microsoft_login_config: undefined
  accounts_authlib_login_config: undefined
  accounts_start_microsoft_login: undefined
  accounts_poll_microsoft_login: undefined
  accounts_cancel_microsoft_login: undefined
  accounts_complete_microsoft_login: undefined
  accounts_switch: { account_id: string }
  accounts_remove: { account_id: string }
  accounts_set_favorite: { account_id: string; favorite: boolean }
  accounts_set_pinned: { account_id: string; pinned: boolean }
  accounts_refresh_profile: { account_id: string }
  accounts_texture_urls: { account_id: string }
  wardrobe_list: undefined
  wardrobe_sync_account_skin: { account_id: string }
  wardrobe_import: {
    path: string
    kind: WardrobeKind
    name?: string
    model?: SkinModel
  }
  wardrobe_update: { item_id: string; name?: string; model?: SkinModel; favorite?: boolean }
  wardrobe_delete: { item_id: string }
  wardrobe_texture: { item_id: string }
  wardrobe_export: { item_id: string }
  wardrobe_apply_skin: { item_id: string; account_id: string }
  microsoft_reset_skin: { account_id: string }
  microsoft_set_cape: { account_id: string; cape_id: string }
  microsoft_reset_cape: { account_id: string }

  // Authlib
  authlib_servers: undefined

  // 用户协议
  user_agreement_get: undefined
  user_agreement_save: { accepted: boolean; uuid: string }
  user_agreement_clear: undefined
  // 文件 / 图片
  image_fetch_data_url: { url: string }
  image_save_url: { url: string }
  image_save_as: ImageSaveAsPayload
  image_read_file: { path: string }
  image_list_files: { path: string }
  background_video_open: undefined

  // 文件选择
  select_directory: undefined
  select_java: undefined
  select_image: { purpose?: 'background' | 'skin' | 'cape' | 'instance_icon' } | undefined
  select_background_video: undefined
  select_file:
    | {
        purpose?: 'crash-analysis' | 'modpack' | 'world-import' | 'theme-preset' | 'plugin-package'
      }
    | undefined
  select_files: { purpose?: 'resource-files' }
  select_save_file: {
    purpose:
      | 'crash-report'
      | 'launcher-logs'
      | 'world-export'
      | 'instance-export'
      | 'resource-manifest'
      | 'schematic-material-manifest'
      | 'screenshot'
      | 'mod-file'
      | 'instance-shortcut'
      | 'theme-preset'
    default_directory?: string
    default_name?: string
  }
  open_folder: { path: string }
  open_url: { url: string }

  // 实例
  game_instances: undefined
  game_version_stats: { game_path: string; version_id: string }
  game_version_settings_get: { game_path: string; version_id: string }
  game_version_settings_effective: { game_path: string; version_id: string }
  game_version_settings_set: { game_path: string; version_id: string; data: unknown }
  game_instance_profile_get: { game_path: string; version_id: string }
  game_instance_profile_patch: {
    game_path: string
    version_id: string
    patch: Partial<Omit<InstanceProfile, 'schemaVersion' | 'icon'>>
  }
  game_instance_profile_reset: { game_path: string; version_id: string; fields: string[] }
  game_instance_icon_set: {
    game_path: string
    version_id: string
    icon_type: 'auto' | 'builtin' | 'loader' | 'local'
    value?: string
    source_path?: string
  }
  game_instance_pin_order_set: { entries: Array<{ game_path: string; version_id: string }> }
  game_instance_categories_get: undefined
  game_instance_categories_upsert: { category_id?: string; name: string; color: string; order?: number }
  game_instance_categories_delete: { category_id: string }
  game_instance_shortcut_create: InstanceTargetPayload & { output_path?: string }
  game_instance_folder_open: InstanceTargetPayload & {
    folder: 'instance' | 'mods' | 'saves' | 'screenshots' | 'logs' | 'crash-reports'
  }
  game_instance_mods_list: InstanceTargetPayload
  game_instance_mod_toggle: InstanceTargetPayload & { filename: string }
  game_instance_mod_add: InstanceTargetPayload & { source_path: string }
  game_instance_mod_remove: InstanceTargetPayload & { filename: string }
  game_instance_mods_folder_open: InstanceTargetPayload
  game_instance_clone: InstanceTargetPayload & { new_version_id: string }
  game_instance_import: { game_path: string; source_path: string; new_version_id: string }
  game_instance_export: InstanceTargetPayload & {
    output_path: string
    pack_format: 'modrinth'
  }
  game_modpack_online_install: {
    source: 'modrinth' | 'curseforge' | 'ftb' | 'ftb'
    project_id: string
    file_id: string
    game_path: string
    new_version_id: string
  }
  game_instance_files_check: InstanceTargetPayload
  game_instance_files_repair: InstanceTargetPayload
  game_instance_delete: InstanceTargetPayload
  game_operation_get: { operation_id: string }
  game_operation_cancel: { operation_id: string }
  game_world_list: InstanceTargetPayload
  game_world_detail: InstanceTargetPayload & { world_id: string }
  game_world_patch: InstanceTargetPayload & {
    world_id: string
    patch: {
      difficulty?: number
      allowCommands?: boolean
      difficultyLocked?: boolean
      gameMode?: number
      raining?: boolean
      thundering?: boolean
      seed?: number
      spawn?: { x: number; y: number; z: number }
    }
  }
  game_world_copy: InstanceTargetPayload & { world_id: string; new_world_id: string }
  game_world_import: InstanceTargetPayload & { source_path: string }
  game_world_export: InstanceTargetPayload & { world_id: string; output_path: string }
  game_world_icon_set: InstanceTargetPayload & { world_id: string; source_path: string }
  game_world_delete: InstanceTargetPayload & { world_id: string }
  game_world_backup_list: InstanceTargetPayload & { world_id: string }
  game_world_backup_create: InstanceTargetPayload & { world_id: string }
  game_world_backup_restore: InstanceTargetPayload & { world_id: string; backup_id: string }
  game_world_backup_lock: InstanceTargetPayload & { world_id: string; backup_id: string; locked: boolean }
  game_world_backup_delete: InstanceTargetPayload & { world_id: string; backup_id: string }
  game_options_read: InstanceTargetPayload
  game_options_patch: InstanceTargetPayload & { patch: Record<string, number | string | boolean> }
  game_screenshot_list: InstanceTargetPayload
  game_screenshot_thumbnail: InstanceTargetPayload & { screenshot_id: string; size?: number }
  game_screenshot_copy: InstanceTargetPayload & { screenshot_id: string }
  game_screenshot_save_as: InstanceTargetPayload & { screenshot_id: string; output_path: string }
  game_screenshot_delete: InstanceTargetPayload & { screenshot_id: string }
  game_screenshot_set_cover: InstanceTargetPayload & { screenshot_id: string }
  game_screenshot_set_background: InstanceTargetPayload & { screenshot_id: string }
  game_server_list: InstanceTargetPayload
  game_server_upsert: InstanceTargetPayload & { server_id?: string; name: string; address: string; favorite?: boolean }
  game_server_delete: InstanceTargetPayload & { server_id: string }
  game_server_reorder: InstanceTargetPayload & { server_ids: string[] }
  game_server_status_refresh: { addresses: string[]; timeout?: number }
  game_resource_list: InstanceTargetPayload & { resource_type: GameResourceType; world_id?: string }
  game_resource_install: InstanceTargetPayload & {
    resource_type: GameResourceType
    source_paths: string[]
    world_id?: string
  }
  game_resource_toggle: InstanceTargetPayload & {
    resource_type: GameResourceType
    resource_id: string
    enabled: boolean
    world_id?: string
  }
  game_resource_delete: InstanceTargetPayload & {
    resource_type: GameResourceType
    resource_ids: string[]
    world_id?: string
  }
  game_resource_manifest_export: InstanceTargetPayload & {
    resource_type: GameResourceType
    output_path: string
    output_format: 'json' | 'csv'
    world_id?: string
  }
  game_schematic_material_manifest_export: InstanceTargetPayload & {
    session_id: string
    output_path: string
    output_format: 'json' | 'csv'
    locale: SchematicLocale
    missing_blocks: string[]
  }
  game_resource_search: {
    query: string
    game_version: string
    loader: string
    source?: 'modrinth' | 'curseforge'
    limit?: number
  }
  game_resource_identify: { sha512: string }
  game_resource_update_check: InstanceTargetPayload & {
    resource_type: GameResourceType
    game_version: string
    loader: string
    world_id?: string
  }
  game_resource_update: InstanceTargetPayload & {
    resource_type: GameResourceType
    resource_id: string
    update: Record<string, unknown>
    world_id?: string
  }
  game_schematic_preview: InstanceTargetPayload & { resource_type: GameResourceType; resource_id: string }
  game_schematic_assets: InstanceTargetPayload & { blocks: string[]; locale: SchematicLocale }
  game_schematic_session_open: InstanceTargetPayload & { resource_type: 'schematic'; resource_id: string }
  game_schematic_session_chunks: { session_id: string; coords: [number, number, number][] }
  game_schematic_session_close: { session_id: string }
  game_launch: {
    version_id: string
    game_path: string
    java_path?: string
    memory?: number
    lock_memory?: boolean
    process_priority?: 'idle' | 'below_normal' | 'normal' | 'above_normal' | 'high'
    width?: number
    height?: number
    fullscreen?: boolean
    jvm_args?: string[]
    game_args?: string[]
    version_isolation?: boolean
    quick_target?: { type: 'world'; world_id: string } | { type: 'server'; address: string }
    wrapper_command?: string
    post_exit_command?: string
    env_vars?: string
    window_title?: string
    launcher_visibility?: 'none' | 'minimize' | 'quit'
  }
  game_launch_cancel: undefined
  game_instance_stop: { instance_id: string }
  game_crash_list: { game_path: string; version_id: string }
  game_crash_analyze: { file_path: string; game_path: string; version_id: string }
  game_crash_output: { report_id: string }
  game_crash_export: { report_id: string; output_path?: string }

  export_logs: { output_path?: string }
  logs_get_history: undefined

  // 子进程实例
  process_instances: undefined
  process_input: { instance_id: string; data: string }
  process_stop: { instance_id: string; force?: boolean }
  debug_process_spawn: {
    name: string
    type: string
    args: string[]
    cwd?: string
    stdin?: boolean
  }

  // 插件
  plugin_list: undefined
  plugin_info: { plugin_name: string }
  plugin_enable: { plugin_name: string }
  plugin_disable: { plugin_name: string; force?: boolean }
  plugin_unload: { plugin_name: string }
  plugin_reload: { plugin_name: string; cascade?: boolean }
  plugin_install: {
    plugin_path: string
    confirm_unverified_source?: boolean
    allow_network?: boolean
  }
  plugin_package_inspect: { plugin_path: string }
  plugin_get_routes: { plugin_id?: string }
  plugin_get_slots: Record<string, never>
  plugin_get_vue_slots: Record<string, never>
  plugin_get_vue_components: Record<string, never>
  plugin_call_command: { command: string; params?: Record<string, unknown> }
  plugin_get_settings: { plugin_name: string }
  plugin_update_setting: { plugin_name: string; key: string; value: unknown }
  plugin_notify_sidebar_state: { collapsed: boolean }

  // Mod 管理（主框架）
  get_mods: { game_path?: string }
  toggle_mod: { game_path: string; filename: string }
  add_mod: { game_path: string; source_path: string }
  remove_mod: { game_path: string; filename: string }
  open_mods_folder: { game_path: string }

  // 整合包 / 资源
  detect_modpack_type: { file_path: string }
  import_modpack: {
    file_path: string
    game_path?: string
    version_name?: string
  }
  export_modpack: {
    game_path?: string
    output_path?: string
    format?: string
    name?: string
    version?: string
    author?: string
  }
  list_resourcepacks: { game_path?: string }
  list_shaderpacks: { game_path?: string }
  list_saves: { game_path?: string }
  remove_resourcepack: { game_path: string; filename: string }
  remove_shaderpack: { game_path: string; filename: string }
  delete_save: { game_path: string; save_name: string }
  open_resourcepacks_folder: { game_path: string }
  open_shaderpacks_folder: { game_path: string }
  open_saves_folder: { game_path: string }

  // 在线 Mod 搜索
  search_mods: {
    query: string
    source?: string
    game_version?: string
    loader_type?: string
    resource_type?: string
    limit?: number
    offset?: number
    sort?: string
  }
  mod_source_config: undefined
  get_mod_info: { mod_id: string; source: string; resource_type?: string }
  get_mod_versions: {
    mod_id: string
    source: string
    game_version?: string
    loader_type?: string
    resource_type?: string
  }
  download_mod: {
    mod_id: string
    source: 'modrinth' | 'curseforge' | 'ftb'
    file_id: string
    game_path: string
    instance_id: string
    game_version?: string
    loader_type?: string
    resource_type?: string
    world_id?: string
    task_id?: string
  }
  download_mod_to_path: {
    mod_id: string
    source: 'modrinth' | 'curseforge' | 'ftb'
    file_id: string
    save_path: string
    resource_type?: string
    task_id?: string
  }

  // 启动器信息 / 页信息卡
  launcher_info: undefined
  launcher_check_update: undefined
  launcher_update_status: undefined
  launcher_update_download: undefined
  launcher_update_apply: undefined
  info_card_get: undefined
  debug_reset_launcher_data: undefined
  debug_clear_plugins: undefined
  debug_devtools_open: undefined
  frontend_ready: { window_type?: 'main' | 'plugin'; session_id?: string } | undefined

  // 文件系统
  fs_read_dir: { path: string }
  fs_read_file: { path: string; mode?: 'text' | 'base64' }
  fs_exists: { path: string }

  // 文件路径
  file_resolve: { path: string }
}

export type CommandName = keyof CommandPayloadMap

// ═══════════════════════════════════════════════════════════════════
//  命令名单一权威来源（运行时字符串）
// ═══════════════════════════════════════════════════════════════════
// 前端所有 IPC 调用必须引用这里的字符串，禁止硬编码散落。
// 键与 CommandPayloadMap / CommandResponseMap 一一对应，
// 由下方 commandNamesAlignedWithPayloadMap 编译期断言强制同步。
// 后端对应权威：ECL/api/registry.py::COMMAND_NAMES。

export const COMMAND_NAMES = {
  system_ping: 'system_ping',
  launcher_errors_pending: 'launcher_errors_pending',
  launcher_errors_ack: 'launcher_errors_ack',
  settings_get: 'settings_get',
  settings_set: 'settings_set',
  window_list: 'window_list',
  window_open: 'window_open',
  window_focus: 'window_focus',
  window_close: 'window_close',
  window_update_bounds: 'window_update_bounds',
  frontend_log: 'frontend_log',
  system_memory: 'system_memory',
  connector_nodes_get: 'connector_nodes_get',
  connector_nodes_set: 'connector_nodes_set',
  connector_status: 'connector_status',
  launcher_preload_connector: 'launcher_preload_connector',
  connector_host_port: 'connector_host_port',
  connector_host_instance: 'connector_host_instance',
  connector_join: 'connector_join',
  connector_leave: 'connector_leave',
  connector_kick: 'connector_kick',
  connector_match_instances: 'connector_match_instances',
  connector_easytier_status: 'connector_easytier_status',
  connector_easytier_download: 'connector_easytier_download',
  connector_detect_ports: 'connector_detect_ports',
  connector_search_mc_port: 'connector_search_mc_port',
  connector_nat_type: 'connector_nat_type',
  game_java_scan: 'game_java_scan',
  game_versions: 'game_versions',
  game_loader_versions: 'game_loader_versions',
  game_fabric_api_versions: 'game_fabric_api_versions',
  game_scan: 'game_scan',
  game_install: 'game_install',
  game_uninstall: 'game_uninstall',
  game_config_get: 'game_config_get',
  game_config_set: 'game_config_set',
  game_config_patch: 'game_config_patch',
  accounts_list: 'accounts_list',
  accounts_current: 'accounts_current',
  accounts_auth_providers: 'accounts_auth_providers',
  accounts_add_plugin: 'accounts_add_plugin',
  accounts_add_offline: 'accounts_add_offline',
  accounts_default_skins: 'accounts_default_skins',
  accounts_set_offline_skin: 'accounts_set_offline_skin',
  accounts_add_authlib: 'accounts_add_authlib',
  accounts_select_authlib_profile: 'accounts_select_authlib_profile',
  authlib_resolve_server: 'authlib_resolve_server',
  accounts_microsoft_login_config: 'accounts_microsoft_login_config',
  accounts_authlib_login_config: 'accounts_authlib_login_config',
  accounts_start_microsoft_login: 'accounts_start_microsoft_login',
  accounts_poll_microsoft_login: 'accounts_poll_microsoft_login',
  accounts_cancel_microsoft_login: 'accounts_cancel_microsoft_login',
  accounts_complete_microsoft_login: 'accounts_complete_microsoft_login',
  accounts_switch: 'accounts_switch',
  accounts_remove: 'accounts_remove',
  accounts_set_favorite: 'accounts_set_favorite',
  accounts_set_pinned: 'accounts_set_pinned',
  accounts_refresh_profile: 'accounts_refresh_profile',
  accounts_texture_urls: 'accounts_texture_urls',
  wardrobe_list: 'wardrobe_list',
  wardrobe_sync_account_skin: 'wardrobe_sync_account_skin',
  wardrobe_import: 'wardrobe_import',
  wardrobe_update: 'wardrobe_update',
  wardrobe_delete: 'wardrobe_delete',
  wardrobe_texture: 'wardrobe_texture',
  wardrobe_export: 'wardrobe_export',
  wardrobe_apply_skin: 'wardrobe_apply_skin',
  microsoft_reset_skin: 'microsoft_reset_skin',
  microsoft_set_cape: 'microsoft_set_cape',
  microsoft_reset_cape: 'microsoft_reset_cape',
  authlib_servers: 'authlib_servers',
  user_agreement_get: 'user_agreement_get',
  user_agreement_save: 'user_agreement_save',
  user_agreement_clear: 'user_agreement_clear',
  image_fetch_data_url: 'image_fetch_data_url',
  image_save_url: 'image_save_url',
  image_save_as: 'image_save_as',
  image_read_file: 'image_read_file',
  image_list_files: 'image_list_files',
  background_video_open: 'background_video_open',
  select_directory: 'select_directory',
  select_java: 'select_java',
  select_image: 'select_image',
  select_background_video: 'select_background_video',
  select_file: 'select_file',
  select_files: 'select_files',
  select_save_file: 'select_save_file',
  open_folder: 'open_folder',
  open_url: 'open_url',
  game_instances: 'game_instances',
  game_version_stats: 'game_version_stats',
  game_version_settings_get: 'game_version_settings_get',
  game_version_settings_effective: 'game_version_settings_effective',
  game_version_settings_set: 'game_version_settings_set',
  game_instance_profile_get: 'game_instance_profile_get',
  game_instance_profile_patch: 'game_instance_profile_patch',
  game_instance_profile_reset: 'game_instance_profile_reset',
  game_instance_icon_set: 'game_instance_icon_set',
  game_instance_pin_order_set: 'game_instance_pin_order_set',
  game_instance_categories_get: 'game_instance_categories_get',
  game_instance_categories_upsert: 'game_instance_categories_upsert',
  game_instance_categories_delete: 'game_instance_categories_delete',
  game_instance_shortcut_create: 'game_instance_shortcut_create',
  game_instance_folder_open: 'game_instance_folder_open',
  game_instance_mods_list: 'game_instance_mods_list',
  game_instance_mod_toggle: 'game_instance_mod_toggle',
  game_instance_mod_add: 'game_instance_mod_add',
  game_instance_mod_remove: 'game_instance_mod_remove',
  game_instance_mods_folder_open: 'game_instance_mods_folder_open',
  game_instance_clone: 'game_instance_clone',
  game_instance_import: 'game_instance_import',
  game_instance_export: 'game_instance_export',
  game_modpack_online_install: 'game_modpack_online_install',
  game_instance_files_check: 'game_instance_files_check',
  game_instance_files_repair: 'game_instance_files_repair',
  game_instance_delete: 'game_instance_delete',
  game_operation_get: 'game_operation_get',
  game_operation_cancel: 'game_operation_cancel',
  game_world_list: 'game_world_list',
  game_world_detail: 'game_world_detail',
  game_world_patch: 'game_world_patch',
  game_world_copy: 'game_world_copy',
  game_world_import: 'game_world_import',
  game_world_export: 'game_world_export',
  game_world_icon_set: 'game_world_icon_set',
  game_world_delete: 'game_world_delete',
  game_world_backup_list: 'game_world_backup_list',
  game_world_backup_create: 'game_world_backup_create',
  game_world_backup_restore: 'game_world_backup_restore',
  game_world_backup_lock: 'game_world_backup_lock',
  game_world_backup_delete: 'game_world_backup_delete',
  game_options_read: 'game_options_read',
  game_options_patch: 'game_options_patch',
  game_screenshot_list: 'game_screenshot_list',
  game_screenshot_thumbnail: 'game_screenshot_thumbnail',
  game_screenshot_copy: 'game_screenshot_copy',
  game_screenshot_save_as: 'game_screenshot_save_as',
  game_screenshot_delete: 'game_screenshot_delete',
  game_screenshot_set_cover: 'game_screenshot_set_cover',
  game_screenshot_set_background: 'game_screenshot_set_background',
  game_server_list: 'game_server_list',
  game_server_upsert: 'game_server_upsert',
  game_server_delete: 'game_server_delete',
  game_server_reorder: 'game_server_reorder',
  game_server_status_refresh: 'game_server_status_refresh',
  game_resource_list: 'game_resource_list',
  game_resource_install: 'game_resource_install',
  game_resource_toggle: 'game_resource_toggle',
  game_resource_delete: 'game_resource_delete',
  game_resource_manifest_export: 'game_resource_manifest_export',
  game_schematic_material_manifest_export: 'game_schematic_material_manifest_export',
  game_resource_search: 'game_resource_search',
  game_resource_identify: 'game_resource_identify',
  game_resource_update_check: 'game_resource_update_check',
  game_resource_update: 'game_resource_update',
  game_schematic_preview: 'game_schematic_preview',
  game_schematic_assets: 'game_schematic_assets',
  game_schematic_session_open: 'game_schematic_session_open',
  game_schematic_session_chunks: 'game_schematic_session_chunks',
  game_schematic_session_close: 'game_schematic_session_close',
  game_launch: 'game_launch',
  game_launch_cancel: 'game_launch_cancel',
  game_instance_stop: 'game_instance_stop',
  game_crash_list: 'game_crash_list',
  game_crash_analyze: 'game_crash_analyze',
  game_crash_output: 'game_crash_output',
  game_crash_export: 'game_crash_export',
  export_logs: 'export_logs',
  logs_get_history: 'logs_get_history',
  process_instances: 'process_instances',
  process_input: 'process_input',
  process_stop: 'process_stop',
  debug_process_spawn: 'debug_process_spawn',
  plugin_list: 'plugin_list',
  plugin_info: 'plugin_info',
  plugin_enable: 'plugin_enable',
  plugin_disable: 'plugin_disable',
  plugin_unload: 'plugin_unload',
  plugin_reload: 'plugin_reload',
  plugin_install: 'plugin_install',
  plugin_package_inspect: 'plugin_package_inspect',
  plugin_get_routes: 'plugin_get_routes',
  plugin_get_slots: 'plugin_get_slots',
  plugin_get_vue_slots: 'plugin_get_vue_slots',
  plugin_get_vue_components: 'plugin_get_vue_components',
  plugin_call_command: 'plugin_call_command',
  plugin_get_settings: 'plugin_get_settings',
  plugin_update_setting: 'plugin_update_setting',
  plugin_notify_sidebar_state: 'plugin_notify_sidebar_state',
  get_mods: 'get_mods',
  toggle_mod: 'toggle_mod',
  add_mod: 'add_mod',
  remove_mod: 'remove_mod',
  open_mods_folder: 'open_mods_folder',
  detect_modpack_type: 'detect_modpack_type',
  import_modpack: 'import_modpack',
  export_modpack: 'export_modpack',
  list_resourcepacks: 'list_resourcepacks',
  list_shaderpacks: 'list_shaderpacks',
  list_saves: 'list_saves',
  remove_resourcepack: 'remove_resourcepack',
  remove_shaderpack: 'remove_shaderpack',
  delete_save: 'delete_save',
  open_resourcepacks_folder: 'open_resourcepacks_folder',
  open_shaderpacks_folder: 'open_shaderpacks_folder',
  open_saves_folder: 'open_saves_folder',
  search_mods: 'search_mods',
  mod_source_config: 'mod_source_config',
  get_mod_info: 'get_mod_info',
  get_mod_versions: 'get_mod_versions',
  download_mod: 'download_mod',
  download_mod_to_path: 'download_mod_to_path',
  launcher_info: 'launcher_info',
  launcher_check_update: 'launcher_check_update',
  launcher_update_status: 'launcher_update_status',
  launcher_update_download: 'launcher_update_download',
  launcher_update_apply: 'launcher_update_apply',
  info_card_get: 'info_card_get',
  debug_reset_launcher_data: 'debug_reset_launcher_data',
  debug_clear_plugins: 'debug_clear_plugins',
  debug_devtools_open: 'debug_devtools_open',
  frontend_ready: 'frontend_ready',
  fs_read_dir: 'fs_read_dir',
  fs_read_file: 'fs_read_file',
  fs_exists: 'fs_exists',
  file_resolve: 'file_resolve',
} as const

/**
 * 编译期断言：`COMMAND_NAMES` 的键与 `CommandPayloadMap` 的键完全一致（双向）。
 *
 * 新增命令时若忘记补进 `COMMAND_NAMES`（或反向多写），这里会退化为 false，
 * `pnpm typecheck` 直接报错。运行时恒为 true，无任何逻辑含义。
 */
export const commandNamesAlignedWithPayloadMap: CommandName extends keyof typeof COMMAND_NAMES
  ? keyof typeof COMMAND_NAMES extends CommandName
    ? true
    : false
  : false = true

// ═══════════════════════════════════════════════════════════════════
//  命令响应映射
// ═══════════════════════════════════════════════════════════════════

export interface CommandResponseMap {
  system_ping: { status: string; message: string }
  launcher_errors_pending: LauncherErrorEvent[]
  launcher_errors_ack: { removed: number }

  settings_get: unknown
  settings_set: void

  window_list: WindowMetadata[]
  window_open: WindowMetadata
  window_focus: void
  window_close: void
  window_update_bounds: WindowMetadata

  frontend_log: void

  system_memory: SystemMemoryInfo

  connector_nodes_get: { mode: 'automatic' | 'append' | 'custom'; nodes: string[] }
  connector_nodes_set: { mode: 'automatic' | 'append' | 'custom'; nodes: string[] }
  connector_status: ConnectorStatus
  launcher_preload_connector: void
  connector_host_port: { roomCode: string }
  connector_host_instance: { status: string }
  connector_join: { mcHost: string; mcPort: number }
  connector_leave: { status: string }
  connector_kick: { status: string }
  connector_match_instances: ConnectorMatchResult
  connector_easytier_status: EasyTierStatus
  connector_easytier_download: EasyTierStatus
  connector_detect_ports: { ports: number[] }
  connector_search_mc_port: { port: number | null }
  connector_nat_type: NatTypeResult

  game_java_scan: JavaInstallation[]

  game_versions: MinecraftVersion[] | MinecraftVersionCatalog
  game_loader_versions: string[]
  game_fabric_api_versions: string[]
  game_scan: ScannedVersion[]
  game_install: InstallVersionResult
  game_uninstall: void

  game_config_get: Record<string, unknown>
  game_config_set: void
  game_config_patch: Record<string, unknown>

  accounts_list: AccountListData
  accounts_current: MinecraftAccount | null
  accounts_auth_providers: AuthProvider[]
  accounts_add_plugin: MinecraftAccount
  accounts_add_offline: MinecraftAccount
  accounts_default_skins: DefaultSkin[]
  accounts_set_offline_skin: AccountListData
  accounts_add_authlib: MinecraftAccount
  accounts_select_authlib_profile: MinecraftAccount
  authlib_resolve_server: string
  accounts_microsoft_login_config: MicrosoftLoginConfigData
  accounts_authlib_login_config: AuthlibLoginConfigData
  accounts_start_microsoft_login: MicrosoftLoginData
  accounts_poll_microsoft_login: MicrosoftPollData
  accounts_cancel_microsoft_login: void
  accounts_complete_microsoft_login: MicrosoftCompleteData
  accounts_switch: void
  accounts_remove: void
  accounts_refresh_profile: void
  accounts_texture_urls: AccountTextures
  accounts_set_favorite: AccountListData
  accounts_set_pinned: AccountListData
  wardrobe_list: WardrobeItem[]
  wardrobe_sync_account_skin: WardrobeImportResult
  wardrobe_import: WardrobeImportResult
  wardrobe_update: WardrobeItem
  wardrobe_delete: void
  wardrobe_texture: { dataUrl: string; mime: 'image/png' }
  wardrobe_export: SelectResult
  wardrobe_apply_skin: MinecraftAccount
  microsoft_reset_skin: MinecraftAccount
  microsoft_set_cape: MinecraftAccount
  microsoft_reset_cape: MinecraftAccount
  authlib_servers: AuthlibServer[]

  user_agreement_get: UserAgreement
  user_agreement_save: UserAgreement
  user_agreement_clear: void

  image_fetch_data_url: ImageDataUrl
  image_save_url: ImageSaveUrlResult
  image_save_as: SelectResult
  image_read_file: ImageDataUrl
  image_list_files: ImageListResult
  background_video_open: { url: string }

  select_directory: SelectResult
  select_java: SelectResult
  select_image: ImageSelection
  select_background_video: SelectResult
  select_file: SelectResult
  select_files: { paths: string[] }
  select_save_file: SelectResult
  open_folder: void
  open_url: void

  game_instances: GameInstance[]
  game_version_stats: VersionRunStats
  game_version_settings_get: Record<string, unknown>
  game_version_settings_effective: Record<string, unknown>
  game_version_settings_set: Record<string, unknown>
  game_instance_profile_get: InstanceProfile
  game_instance_profile_patch: InstanceProfile
  game_instance_profile_reset: InstanceProfile
  game_instance_icon_set: InstanceProfile
  game_instance_pin_order_set: void
  game_instance_categories_get: InstanceCategory[]
  game_instance_categories_upsert: InstanceCategory
  game_instance_categories_delete: void
  game_instance_folder_open: { path: string }
  game_instance_mods_list: ModItem[]
  game_instance_mod_toggle: { enabled: boolean }
  game_instance_mod_add: { filename: string }
  game_instance_mod_remove: void
  game_instance_mods_folder_open: { path: string }
  game_instance_clone: GameOperation
  game_instance_import: GameOperation
  game_instance_export: GameOperation
  game_modpack_online_install: GameOperation
  game_instance_files_check: {
    issues: Array<{ kind: string; path: string; size?: number; message?: string }>
    downloadBytes: number
    canRepair: boolean
  }
  game_instance_files_repair: GameOperation
  game_instance_delete: void
  game_instance_shortcut_create: { path: string; iconPath: string }
  game_operation_get: GameOperation
  game_operation_cancel: boolean
  game_world_list: WorldEntry[]
  game_world_detail: WorldEntry
  game_world_patch: WorldEntry
  game_world_copy: GameOperation
  game_world_import: GameOperation
  game_world_export: GameOperation
  game_world_icon_set: { path: string }
  game_world_delete: void
  game_world_backup_list: Array<{ id: string; createdAt?: string; locked: boolean; automatic: boolean; size: number }>
  game_world_backup_create: GameOperation
  game_world_backup_restore: GameOperation
  game_world_backup_lock: { id: string; locked: boolean }
  game_world_backup_delete: void
  game_options_read: {
    path: string
    options: Array<{ key: string; value: number | string | boolean; type: string; min?: number; max?: number }>
    ignoredCount: number
  }
  game_options_patch: { path: string; updated: number }
  game_screenshot_list: ScreenshotEntry[]
  game_screenshot_thumbnail: { path: string; sourcePath: string }
  game_screenshot_copy: void
  game_screenshot_save_as: { path: string }
  game_screenshot_delete: void
  game_screenshot_set_cover: InstanceProfile
  game_screenshot_set_background: { path: string }
  game_server_list: ServerEntry[]
  game_server_upsert: ServerEntry
  game_server_delete: void
  game_server_reorder: ServerEntry[]
  game_server_status_refresh: ServerStatus[]
  game_resource_list: GameResource[]
  game_resource_install: GameOperation
  game_resource_toggle: { id: string; enabled: boolean }
  game_resource_delete: { deleted: string[]; failed: Array<{ resourceId: string; message: string }> }
  game_resource_manifest_export: { path: string }
  game_schematic_material_manifest_export: { path: string }
  game_resource_search: { source: string; items: unknown[] }
  game_resource_identify: {
    matched: boolean
    ambiguous?: boolean
    source?: string
    projectId?: string
    versionId?: string
  }
  game_resource_update_check: Array<Record<string, unknown>>
  game_resource_update: GameOperation
  game_schematic_preview: SchematicPreviewData
  game_schematic_assets: SchematicAssetsBundle
  game_schematic_session_open: SchematicSessionData
  game_schematic_session_chunks: SchematicChunkBatch
  game_schematic_session_close: { closed: boolean }
  game_launch: LaunchInstanceResult
  game_launch_cancel: void
  export_logs: { path: string }
  logs_get_history: { logs: TerminalLogEntry[] }

  process_instances: { instances: ProcessInstance[] }
  process_input: { sent: boolean }
  process_stop: { stopped: boolean }
  debug_process_spawn: { instanceId: string }
  game_instance_stop: void
  game_crash_list: CrashCandidateFile[]
  game_crash_analyze: CrashAnalysisResult
  game_crash_output: { name: string; content: string }
  game_crash_export: { path: string }

  plugin_list: PluginInfo[]
  plugin_info: PluginInfo
  plugin_enable: void
  plugin_disable: void
  plugin_unload: void
  plugin_reload: void
  plugin_install: { status: string; message?: string } | undefined
  plugin_package_inspect: PluginPackagePreflight
  plugin_get_routes: PluginRoute[]
  plugin_get_slots: Record<string, PluginSlotItem[]>
  plugin_get_vue_slots: Record<string, VueSlotItem[]>
  plugin_get_vue_components: Record<string, VueComponentDef>
  plugin_call_command: unknown
  plugin_get_settings: PluginSettingsData
  plugin_update_setting: void
  plugin_notify_sidebar_state: void

  get_mods: ModItem[]
  toggle_mod: { enabled: boolean }
  add_mod: { filename: string }
  remove_mod: void
  open_mods_folder: SelectResult

  detect_modpack_type: ModpackTypeInfo
  import_modpack: void
  export_modpack: void
  list_resourcepacks: ResourcePack[]
  list_shaderpacks: ShaderPack[]
  list_saves: SaveEntry[]
  remove_resourcepack: void
  remove_shaderpack: void
  delete_save: void
  open_resourcepacks_folder: void
  open_shaderpacks_folder: void
  open_saves_folder: void

  search_mods: ModSearchResult
  mod_source_config: ModSourceConfig
  get_mod_info: ModInfo
  get_mod_versions: ModVersion[]
  download_mod: ModInstallResult
  download_mod_to_path: { filename: string }

  launcher_info: LauncherInfo
  launcher_check_update: UpdateCheckResult
  launcher_update_status: UpdateStatus
  launcher_update_download: UpdateDownloadResult
  launcher_update_apply: UpdateApplyResult
  info_card_get: InfoCardData
  debug_reset_launcher_data: DebugMaintenanceResult
  debug_clear_plugins: DebugMaintenanceResult
  debug_devtools_open: { open: boolean }
  frontend_ready: WindowMetadata | void

  fs_read_dir: FsEntry[]
  fs_read_file: FileContent
  fs_exists: PathInfo
  file_resolve: SelectResult
}

export interface SchematicRegionData {
  name: string
  size: number[]
  position: number[]
  palette: SchematicPaletteEntry[]
  indices: number[]
}

export interface SchematicPaletteEntry {
  name: string
  properties: Record<string, string>
  color: [number, number, number]
}

export interface SchematicAssetsBundle {
  blockstates: Record<string, unknown>
  models: Record<string, unknown>
  textures: Record<string, string>
  animated: string[]
  missingBlocks: string[]
  blockNames?: Record<string, string>
}

export interface SchematicSessionData {
  sessionId: string
  type: 'litematic' | 'schem'
  size: [number, number, number]
  chunkSize: number
  palette: SchematicPaletteEntry[]
  materialCounts: Record<string, number>
  chunks: [number, number, number][]
}

export interface SchematicChunkBatch {
  chunks: Array<{ coord: [number, number, number]; indices: string }>
}

export interface SchematicPreviewData {
  type: 'litematic' | 'schem'
  size: number[]
  regions: SchematicRegionData[]
}
