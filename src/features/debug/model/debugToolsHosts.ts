import { shallowReactive } from 'vue'

/** 宿主在挂载/卸载时登记，工具始终只有一个组件实例。 */
export const debugToolsHosts = shallowReactive(new Map<string, HTMLElement>())
