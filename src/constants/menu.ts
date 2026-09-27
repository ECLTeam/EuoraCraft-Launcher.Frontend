/**
 * 共享菜单项定义（SideBar.vue 和 TitleBar.vue 共用）
 * label 为 i18n key，使用时通过 t() 函数翻译
 */
export interface MenuItem {
  path: string
  labelKey: string // i18n key
  iconName: string
}

export const MENU_ITEMS: MenuItem[] = [
  { path: '/', labelKey: 'sidebar.game', iconName: 'game' },
  { path: '/versions', labelKey: 'sidebar.versions', iconName: 'cube' },
  { path: '/more', labelKey: 'sidebar.more', iconName: 'more' },
  { path: '/download', labelKey: 'download.title', iconName: 'download' },
  { path: '/plugins', labelKey: 'sidebar.plugins', iconName: 'puzzle' },
  { path: '/settings', labelKey: 'sidebar.settings', iconName: 'settings' },
]
