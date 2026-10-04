import type { InstanceExternalSource } from '@/types/instances'
import type { VersionLaunchSettings } from './instanceSettings'

export interface InstanceProfileForm {
  alias: string
  description: string
  favorite: boolean
  pinned: boolean
  hidden: boolean
  categoryId: string
  tagsText: string
  preferredExternalSource: InstanceExternalSource
}

/** 按实例串行写入，待保存和失败快照由应用会话持有，切换 tab 不会丢失。 */
export function createInstanceSaveSession<T extends object>() {
  const drafts = new Map<string, T>()
  const pending = new Map<string, { snapshot: string; promise: Promise<void> }>()
  return {
    draft(key: string): T | undefined {
      const value = drafts.get(key)
      return value ? structuredClone(value) : undefined
    },
    enqueue(key: string, value: T, write: (snapshot: T) => Promise<void>): Promise<void> {
      const snapshot = structuredClone(value)
      const serialized = JSON.stringify(snapshot)
      const previous = pending.get(key)
      if (previous?.snapshot === serialized) return previous.promise
      drafts.set(key, snapshot)
      const promise = (previous?.promise ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => write(snapshot))
        .then(() => {
          if (drafts.get(key) === snapshot) drafts.delete(key)
        })
      pending.set(key, { snapshot: serialized, promise })
      const cleanup = () => {
        if (pending.get(key)?.promise === promise) pending.delete(key)
      }
      void promise.then(cleanup, cleanup)
      return promise
    },
  }
}

export const profileSaveSession = createInstanceSaveSession<InstanceProfileForm>()
export const settingsSaveSession = createInstanceSaveSession<VersionLaunchSettings>()
