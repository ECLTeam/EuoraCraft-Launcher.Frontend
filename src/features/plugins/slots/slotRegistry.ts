import { computed, reactive } from 'vue'

export interface PluginSlotDescriptor {
  id: string
  page: string
  windowType: 'main' | 'theme-studio' | 'plugin' | 'any'
  purpose: string
  accepts: Array<'html' | 'vue'>
  cardinality: 'single' | 'multiple'
  layout: 'inline' | 'block' | 'overlay'
}

export interface PluginSlotHostRegistration {
  key: string
  slotId: string
  contextKey?: string
  contextData?: Record<string, unknown>
  element: HTMLElement
}

const knownIds = [
  'plugin-slot-content-bottom',
  'plugin-slot-content-top',
  'plugin-slot-game-launch-before',
  'plugin-slot-game-left',
  'plugin-slot-game-right-top',
  'plugin-slot-game-status-bottom',
  'plugin-slot-instance-detail-actions',
  'plugin-slot-instance-summary',
  'plugin-slot-modal-body-extra',
  'plugin-slot-modal-footer-extra',
  'plugin-slot-online-mods-search-after',
  'plugin-slot-page-bottom',
  'plugin-slot-plugin-page-bottom',
  'plugin-slot-plugin-page-top',
  'plugin-slot-plugins-list-bottom',
  'plugin-slot-plugins-toolbar-after',
  'plugin-slot-settings-about-bottom',
  'plugin-slot-settings-content-bottom',
  'plugin-slot-settings-content-top',
  'plugin-slot-settings-download-section-after',
  'plugin-slot-settings-game-section-after',
  'plugin-slot-settings-general-section-after',
  'plugin-slot-settings-nav-bottom',
  'plugin-slot-sidebar-bottom',
  'plugin-slot-sidebar-extra',
  'plugin-slot-sidebar-top',
  'plugin-slot-task-queue-item-actions',
  'plugin-slot-task-queue-top',
  'plugin-slot-titlebar-left',
  'plugin-slot-titlebar-right',
  'plugin-slot-titlebar-tray',
  'plugin-slot-version-detail-footer',
  'plugin-slot-version-detail-tab',
  'plugin-slot-versions-content-top',
  'plugin-slot-versions-list-toolbar',
  'plugin-slot-versions-manage-top',
] as const

function pageFor(id: string): string {
  if (id.includes('settings')) return 'settings'
  if (id.includes('versions') || id.includes('version-detail')) return 'versions'
  if (id.includes('instance')) return 'instances'
  if (id.includes('game-')) return 'game'
  if (id.includes('plugin-page') || id.includes('plugins')) return 'plugins'
  if (id.includes('online-mods')) return 'mods'
  return 'global'
}

/** 插件 SDK 按同一规则把插槽 id 归属到页面。 */
export const pageForSlotId = pageFor

export const pluginSlotDescriptors: PluginSlotDescriptor[] = knownIds.map((id) => ({
  id,
  page: pageFor(id),
  windowType: 'main',
  purpose: id.replace('plugin-slot-', '').replaceAll('-', ' '),
  accepts: ['html', 'vue'],
  cardinality:
    id === 'plugin-slot-task-queue-item-actions' || id.includes('instance-detail-actions') ? 'multiple' : 'single',
  layout: id.includes('titlebar') || id.includes('actions') ? 'inline' : 'block',
}))

const hosts = reactive(new Map<string, PluginSlotHostRegistration>())

export function registerPluginSlotHost(registration: PluginSlotHostRegistration): void {
  hosts.set(registration.key, registration)
}

export function unregisterPluginSlotHost(key: string): void {
  hosts.delete(key)
}

export function usePluginSlotRegistry() {
  const registrations = computed(() => [...hosts.values()])
  const descriptors = computed(() =>
    pluginSlotDescriptors.map((descriptor) => ({
      ...descriptor,
      instances: registrations.value.filter((host) => host.slotId === descriptor.id).length,
      occupied: registrations.value.filter(
        (host) => host.slotId === descriptor.id && host.element.childElementCount > 0
      ).length,
    }))
  )
  return { registrations, descriptors }
}
