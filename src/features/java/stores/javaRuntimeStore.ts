import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { javaApi } from '@/features/java/api/javaApi'
import type { JavaInstallation } from '@/types/instances'
import type { JavaInventory, JavaRuntime } from '@/types/java'

export function toJavaInstallations(runtimes: JavaRuntime[]): JavaInstallation[] {
  return runtimes
    .filter((runtime) => runtime.isEnabled && runtime.validationStatus === 'valid')
    .map((runtime) => ({
      path: runtime.executablePath,
      executable_path: runtime.executablePath,
      version: runtime.fullVersion,
      major_version: runtime.majorVersion,
      java_type: runtime.vendor || runtime.runtimeKind,
      vendor: runtime.vendor,
      runtime_kind: runtime.runtimeKind,
      arch: runtime.architecture,
      architecture: runtime.architecture,
      sources: runtime.discoverySources,
    }))
}

export const useJavaRuntimeStore = defineStore('javaRuntimes', () => {
  const inventory = ref<JavaInventory | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const isLoading = computed(() => status.value === 'loading')
  const runtimes = computed(() => inventory.value?.runtimes || [])
  const installations = computed(() => toJavaInstallations(runtimes.value))
  let generation = 0
  let pending: { force: boolean; request: Promise<JavaInventory> } | null = null

  async function load(force = false): Promise<JavaInventory> {
    if (!force && status.value === 'ready' && inventory.value) return inventory.value
    if (pending && (!force || pending.force)) return pending.request
    const revision = ++generation
    status.value = 'loading'
    error.value = ''
    const request = javaApi.inventory(force).then(
      (value) => {
        if (revision === generation) {
          inventory.value = value
          status.value = 'ready'
        }
        return value
      },
      (reason: unknown) => {
        if (revision === generation) {
          status.value = 'error'
          error.value = reason instanceof Error ? reason.message : String(reason)
        }
        throw reason
      }
    )
    pending = { force, request }
    void request.then(
      () => {
        if (pending?.request === request) pending = null
      },
      () => {
        if (pending?.request === request) pending = null
      }
    )
    return request
  }

  function invalidate() {
    generation++
    pending = null
    status.value = 'idle'
  }

  async function refreshAfterChange() {
    invalidate()
    return load()
  }

  return { inventory, status, error, isLoading, runtimes, installations, load, invalidate, refreshAfterChange }
})
