// plugin-sdk 统一导出

export * from './api'
export * from './types'
export * from './events'
export * from './ui'
export * from './dom'
export * from './component'
export * from './router'
export * from './slots'
export * from './state'
export * from './theme'
export * from './hooks'
export * from './transpile'
export * as widgets from './widgets'

// createElement 与 $ 在 ui.ts 中从 dom.ts 再导出，通配符会产生同名歧义，
// 这里显式再导出一次以消除歧义，确保从根入口可直接导入。
export { createElement, $ } from './dom'
