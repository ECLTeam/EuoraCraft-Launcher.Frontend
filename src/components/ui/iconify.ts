import { addCollection } from '@iconify/vue/offline'
import { icons } from './tabler-subset'

/** 短名 → Tabler 图标名（全部经 Iconify 官方 API 验证存在） */
export const ICON_MAP: Record<string, string> = {
  // 导航
  game: 'device-gamepad-2',
  'game-controller': 'device-gamepad-2',
  cube: 'cube',
  folder: 'folder',
  'folder-open': 'folder-open',
  settings: 'settings',
  puzzle: 'puzzle',
  plugin: 'puzzle',
  bug: 'bug',
  activity: 'activity',
  toolbox: 'briefcase-2',
  wifi: 'wifi',
  network: 'network',
  menu: 'menu-2',
  help: 'help-circle',

  // 操作
  close: 'x',
  'x-mark': 'x',
  spinner: 'loader-2',
  loading: 'loader-2',
  add: 'plus',
  plus: 'plus',
  delete: 'trash',
  trash: 'trash',
  search: 'search',
  download: 'download',
  'cloud-download': 'cloud-download',
  play: 'player-play',
  'player-play': 'player-play',
  pause: 'player-pause',
  stop: 'player-stop',
  power: 'power',
  refresh: 'refresh',
  'rotate-2': 'rotate-2',
  check: 'check',
  brush: 'brush',
  list: 'list',
  copy: 'copy',
  clipboard: 'clipboard',
  link: 'link',
  login: 'login-2',
  logout: 'logout-2',
  minus: 'minus',
  edit: 'edit',
  upload: 'upload',
  'cloud-upload': 'cloud-upload',
  'file-download': 'file-download',
  save: 'device-floppy',
  bolt: 'bolt',
  star: 'star',
  'star-filled': 'star-filled',
  pin: 'pin',
  'pin-filled': 'pin-filled',
  tags: 'tags',
  'eye-off': 'eye-off',
  'filter-off': 'filter-off',
  'sort-ascending': 'sort-ascending',
  'sort-descending': 'sort-descending',
  'layout-grid': 'layout-grid',
  clock: 'clock',
  hourglass: 'hourglass',
  rocket: 'rocket',

  // 方向
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevrons-left': 'chevrons-left',
  'chevrons-right': 'chevrons-right',
  'arrow-right': 'chevron-right',
  'arrow-left': 'chevron-left',
  'rotate-left': 'rotate-2',
  'rotate-right': 'rotate-clockwise-2',

  // 文件
  'file-text': 'file-text',
  'external-link': 'external-link',
  globe: 'globe',
  server: 'server',
  photo: 'photo',
  image: 'photo',
  sparkles: 'sparkles',
  palette: 'palette',
  layers: 'layers-union',
  more: 'apps',
  archive: 'archive',
  calendar: 'calendar',

  // 通知/状态
  info: 'info-circle',
  bell: 'bell',
  lightbulb: 'bulb',

  // 品牌/链接
  github: 'brand-github',
  'brand-github': 'brand-github',
  'external-site': 'world',
  'search-engine': 'world',
  'file-source': 'file-code',

  // 消息类型
  success: 'circle-check',
  error: 'circle-x',
  warning: 'alert-circle',
  'alert-circle': 'alert-circle',
  'alert-triangle': 'alert-triangle',

  // 窗口
  minimize: 'minus',
  maximize: 'maximize',
  restore: 'arrows-minimize',
  moon: 'moon',
  sun: 'sun',

  // 终端
  terminal: 'terminal-2',
  eraser: 'eraser',
  'auto-scroll': 'arrow-bar-to-down',

  // 子进程实例视图
  cpu: 'cpu',
  send: 'send',
  keyboard: 'keyboard',

  // 加载器
  lab: 'flask',
  fire: 'flame',
  grid: 'layout-grid',
  eye: 'eye',
  happy: 'mood-smile',

  // 账户
  user: 'user',
  users: 'users',
  'user-x': 'user-x',
  crown: 'crown',
  shield: 'shield',
  circle: 'circle',
  package: 'package',
  packages: 'packages',
  shirt: 'shirt',
  wardrobe: 'hanger-2',
}

/** 短名解析，未知短名回退 help-circle（插件自定义图标名兜底，与旧行为一致） */
export function getIconName(name: string): string {
  return ICON_MAP[name] || 'help-circle'
}

// 只打包 tabler-subset.ts 中实际用到的图标子集（约 20KB），
// 保证 Icon 组件完全离线渲染（不触发 Iconify 网络 API）。
addCollection(icons)
