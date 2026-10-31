import {
  array,
  boolean,
  check,
  looseObject,
  number,
  optional,
  picklist,
  pipe,
  record,
  safeParse,
  string,
  union,
  unknown,
  type InferOutput,
} from 'valibot'
import { i18n } from '@/i18n'

const optionalString = optional(string())
const optionalNumber = optional(number())
const optionalBoolean = optional(boolean())
const videoOptions = looseObject({
  paused: optionalBoolean,
  muted: optionalBoolean,
  volume: optionalNumber,
  fit: optional(picklist(['cover', 'contain'])),
  pause_when_inactive: optionalBoolean,
})
const image = looseObject({
  type: optional(picklist(['default', 'none', 'custom', 'local', 'url', 'gradient'])),
  path: optionalString,
  image_base64: optionalString,
  mode: optional(picklist(['single', 'carousel', 'random'])),
  interval: optionalNumber,
  urls: optional(array(string())),
})
const video = looseObject({ path: optionalString, poster_path: optionalString, options: optional(videoOptions) })
const background = looseObject({
  ...image.entries,
  media_type: optional(picklist(['image', 'video'])),
  opacity: optionalNumber,
  blur: optionalNumber,
  image: optional(image),
  video: optional(video),
  poster_path: optionalString,
})
const appearance = looseObject({
  radius_window: optionalNumber,
  radius_card: optionalNumber,
  radius_control: optionalNumber,
  radius_dialog: optionalNumber,
  card_opacity: optionalNumber,
  font_family: optionalString,
  sidebar_font_family: optionalString,
  terminal_font_family: optionalString,
  log_font_family: optionalString,
})
const themeIds = [
  'classic',
  'folia',
  'catppuccin-latte',
  'catppuccin-frappe',
  'catppuccin-macchiato',
  'catppuccin-mocha',
] as const
const theme = looseObject({
  mode: optional(picklist(['light', 'dark', 'system'])),
  theme_id: optional(picklist(themeIds)),
  primary_color: optionalString,
  blur_amount: optionalNumber,
  navigation_mode: optional(picklist(['sidebar', 'top'])),
  window_chrome: optional(picklist(['custom', 'system_shadow', 'native'])),
  titlebar_hidden: optionalBoolean,
  transparent_bg: optionalBoolean,
  background_opacity: optionalNumber,
  appearance: optional(appearance),
  schedule: optional(looseObject({ enabled: optionalBoolean, dark_start: optionalString, dark_end: optionalString })),
})
const ui = looseObject({
  locale: optionalString,
  debug: optionalBoolean,
  flowDebug: optionalBoolean,
  debugTools: optional(
    pipe(
      unknown(),
      check((value) => typeof value === 'object' && value !== null && !Array.isArray(value)),
      looseObject({ visible: optionalBoolean, minimizedShape: optional(picklist(['rectangle', 'circle'])) })
    )
  ),
  theme: optional(theme),
  background: optional(background),
  windows: optional(
    record(
      string(),
      looseObject({
        x: optionalNumber,
        y: optionalNumber,
        width: optionalNumber,
        height: optionalNumber,
        monitor: optionalString,
      })
    )
  ),
  instanceManager: optional(
    looseObject({
      viewMode: optional(picklist(['card', 'list'])),
      sortKey: optional(picklist(['lastLaunchedAt', 'totalRunDurationSeconds', 'launchCount', 'name', 'gameVersion'])),
      sortDirection: optional(picklist(['asc', 'desc'])),
    })
  ),
})
const game = looseObject({
  minecraft_paths: optional(
    array(union([string(), looseObject({ name: string(), path: string(), protected: optionalBoolean })])),
    []
  ),
  java_auto: optionalBoolean,
  java_path: optionalString,
  memory_auto: optionalBoolean,
  memory_size: optionalNumber,
  lock_memory: optionalBoolean,
  process_priority: optional(picklist(['idle', 'below_normal', 'normal', 'above_normal', 'high'])),
  game_width: optionalNumber,
  game_height: optionalNumber,
  jvm_args: optional(array(string())),
  renderer: optional(picklist(['default', 'software', 'directx12', 'vulkan'])),
  fullscreen: optionalBoolean,
  instance_isolation_policy: optional(
    picklist(['disabled', 'modded_only', 'non_release_only', 'modded_or_non_release', 'all'])
  ),
  game_args_tail: optionalString,
  pre_launch_command: optionalString,
  wrapper_command: optionalString,
  post_exit_command: optionalString,
  env_vars: optionalString,
  window_title_template: optionalString,
  launcher_visibility: optional(picklist(['none', 'minimize', 'quit'])),
  prefer_high_performance_gpu: optionalBoolean,
  use_java_exe: optionalBoolean,
  disable_crash_analysis: optionalBoolean,
  last_install_path: optionalString,
  last_manage_path: optionalString,
  active_path: optionalString,
  qomicex_instances_path: optionalString,
})
const launcher = looseObject({
  debug: optionalBoolean,
  debug_log_level: optional(picklist(['debug', 'info', 'warning', 'error'])),
  showcase: optionalBoolean,
  disable_ssl_verify: optionalBoolean,
  api_proxy_mode: optional(picklist(['none', 'system', 'custom'])),
  api_proxy_url: optionalString,
  proxy_mode: optional(picklist(['none', 'system', 'custom'])),
  proxy_url: optionalString,
  request_timeout: optionalNumber,
  request_retries: optionalNumber,
})
const download = looseObject({
  mirror_source: optional(picklist(['official', 'bmclapi']), 'official'),
  mod_source: optional(picklist(['official', 'mcim'])),
  resourceInstallCache: optional(record(string(), looseObject({ gamePath: string(), versionId: string() }))),
  resourceSaveDirectories: optional(record(string(), string())),
})
const connector = looseObject({
  mode: optional(picklist(['automatic', 'append', 'custom']), 'automatic'),
  nodes: optional(array(string()), []),
})
const schema = looseObject({
  ui: optional(ui, {}),
  game: optional(game, {}),
  launcher: optional(launcher, {}),
  download: optional(download, {}),
  connector: optional(connector, {}),
})

export type SettingsSnapshot = InferOutput<typeof schema>
export type SettingsSection = 'ui' | 'game' | 'launcher' | 'download' | 'connector'

/** IPC 的外部值在进入共享配置数据层之前验证已知字段，并保留历史扩展字段。 */
export function parseSettingsSnapshot(value: unknown): SettingsSnapshot {
  const result = safeParse(schema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}
