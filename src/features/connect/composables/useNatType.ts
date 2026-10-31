import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import { pinia } from '@/app/stores'
import { connectorApi } from '@/features/connect/api/connectorApi'
import type { NatTypeResult } from '@/types/connect'
import { getErrorMessage } from '@/utils/error'

/** NAT 结果缓存有效期：超过后再次打开弹窗会重新探测。 */
const cacheTtlMs = 10 * 60 * 1000

export type NatDetectionState = 'idle' | 'detecting' | 'success' | 'error'

/** 后端 NAT 探测的失败分类，文案由调用方翻译。 */
export type NatDetectionFailureKind = 'timeout' | 'busy' | 'probeFailed' | 'other'

function classifyFailure(cause: unknown): NatDetectionFailureKind {
  if (cause instanceof BackendCommandError) {
    if (cause.errorCode === 'CONNECTOR_NAT_TYPE_TIMEOUT') return 'timeout'
    if (cause.errorCode === 'CONNECTOR_NAT_TYPE_BUSY') return 'busy'
    if (cause.errorCode === 'CONNECTOR_NAT_TYPE_FAILED') return 'probeFailed'
  }
  return 'other'
}

const defineNatDetection = defineStore('natDetection', () => {
  const state = ref<NatDetectionState>('idle')
  const result = ref<NatTypeResult | null>(null)
  const detectedAt = ref<number | null>(null)
  const failureKind = ref<NatDetectionFailureKind | null>(null)
  const failureMessage = ref('')
  /** 进行中的探测，重复调用复用同一请求，避免并发触发后端「已有检测在进行」。 */
  let pendingDetection: Promise<NatTypeResult | null> | null = null

  /**
   * 判断缓存是否仍在有效期内。
   *
   * 依赖当前时间，因此是普通函数而非 computed：做成 computed 会得到不随时间
   * 更新、可能长期为 true 的误导性结果。
   *
   * @returns 存在结果且未超过有效期时为 true
   */
  function isCacheFresh(): boolean {
    if (result.value === null || detectedAt.value === null) return false
    return Date.now() - detectedAt.value < cacheTtlMs
  }

  /**
   * 探测本机 NAT 类型，必要时复用缓存或进行中的请求。
   *
   * 探测失败会清空缓存：失败即不存在可复用的结论，避免下次打开继续展示旧结果。
   *
   * @param force - 为 true 时忽略缓存重新探测
   * @returns 探测结果；失败或复用失败请求时返回 null
   */
  function detect(force = false): Promise<NatTypeResult | null> {
    if (pendingDetection) return pendingDetection
    if (!force && isCacheFresh()) return Promise.resolve(result.value)
    state.value = 'detecting'
    failureKind.value = null
    failureMessage.value = ''
    const request = connectorApi
      .natType()
      .then((value) => {
        result.value = value
        detectedAt.value = Date.now()
        state.value = 'success'
        return value
      })
      .catch((cause: unknown) => {
        result.value = null
        detectedAt.value = null
        failureKind.value = classifyFailure(cause)
        failureMessage.value = getErrorMessage(cause)
        state.value = 'error'
        return null
      })
      .finally(() => {
        pendingDetection = null
      })
    pendingDetection = request
    return request
  }

  /**
   * 清空缓存与失败状态。
   *
   * 主要供测试隔离使用；正常流程不需要手动重置。
   */
  function reset(): void {
    state.value = 'idle'
    result.value = null
    detectedAt.value = null
    failureKind.value = null
    failureMessage.value = ''
    pendingDetection = null
  }

  return { state, result, detectedAt, failureKind, failureMessage, isCacheFresh, detect, reset }
})

/**
 * 读取应用唯一的 NAT 探测缓存。
 *
 * 缓存挂在 Pinia 单例上，切换页面或标签不会丢失；结果 10 分钟内复用。
 */
export function useNatType() {
  const store = defineNatDetection(pinia)
  return {
    ...storeToRefs(store),
    isCacheFresh: store.isCacheFresh,
    detect: store.detect,
    reset: store.reset,
  }
}
