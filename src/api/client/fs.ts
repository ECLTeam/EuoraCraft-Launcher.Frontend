import type { FileContent, FsEntry, PathInfo } from '@/types/system'
import { call } from './commands'

const imageUrlCache = new Map<string, string>()
const pendingImageUrlRequests = new Map<string, { promise: Promise<string | null>; revision: number }>()
const imageUrlRevisions = new Map<string, number>()

function imagePathKey(path: string): string {
  const normalizedPath = path
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
  return /^[a-zA-Z]:\//.test(normalizedPath) ? normalizedPath.toLowerCase() : normalizedPath
}

function nextImageUrlRevision(key: string): number {
  const revision = (imageUrlRevisions.get(key) ?? 0) + 1
  imageUrlRevisions.set(key, revision)
  imageUrlCache.delete(key)
  pendingImageUrlRequests.delete(key)
  return revision
}

/**
 * 通过后端为本地图片签发 ecl-img 协议地址，前端直接以该地址加载原始字节。
 *
 * 地址由随机令牌绑定具体文件，协议处理器不接受任何客户端路径；浏览器按
 * ETag 协商缓存，文件替换或用户刷新时通过 revision 使会话缓存失效并换取
 * 新地址。不传输 base64，也不再依赖 Tauri Asset Protocol。
 *
 * @param path - 本地图片路径
 * @returns 可用于 <img src> 的协议地址，签发失败时返回 null
 */
async function resolveFileUrl(path: string): Promise<string | null> {
  const key = imagePathKey(path)
  const cached = imageUrlCache.get(key)
  if (cached) return cached

  let pending = pendingImageUrlRequests.get(key)
  if (!pending) {
    const revision = imageUrlRevisions.get(key) ?? 0
    const promise = call<{ url: string }>('image_url_resolve', { kind: 'local', path }).then((res) => {
      const url = res.success ? (res.data?.url ?? null) : null
      if (url && (imageUrlRevisions.get(key) ?? 0) === revision) imageUrlCache.set(key, url)
      return url
    })
    pending = { promise, revision }
    pendingImageUrlRequests.set(key, pending)
    const removeRequest = () => {
      if (pendingImageUrlRequests.get(key) === pending) pendingImageUrlRequests.delete(key)
    }
    void promise.then(removeRequest, removeRequest)
  }
  return pending.promise
}

function invalidateImageUrl(path?: string): void {
  if (path) {
    nextImageUrlRevision(imagePathKey(path))
    return
  }
  const keys = new Set([...imageUrlCache.keys(), ...pendingImageUrlRequests.keys(), ...imageUrlRevisions.keys()])
  for (const key of keys) nextImageUrlRevision(key)
}

export function createFs() {
  return {
    readDir(path: string) {
      return call<FsEntry[]>('fs_read_dir', { path })
    },
    readFile(path: string, mode: 'text' | 'base64' = 'text') {
      return call<FileContent>('fs_read_file', { path, mode })
    },
    exists(path: string) {
      return call<PathInfo>('fs_exists', { path })
    },
  }
}

export function createFile() {
  return {
    /** 将本地图片路径转为可在 <img> 中直接使用的协议地址 */
    async toUrl(path: string): Promise<string | null> {
      return resolveFileUrl(path)
    },

    /** 图片文件被替换、删除或用户明确刷新时，使会话缓存失效。 */
    invalidateUrl(path?: string): void {
      invalidateImageUrl(path)
    },

    /** 路径规整与存在性校验 */
    resolve(path: string) {
      return call<{ path: string }>('file_resolve', { path })
    },
  }
}
