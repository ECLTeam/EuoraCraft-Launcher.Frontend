import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { useTargetOperationRefresh } from './useTargetOperationRefresh'

afterEach(() => useApplicationOperationStore().stop())

it('仅在相同根目录实例的任务结束后刷新一次，包括终态早于回执', async () => {
  const store = useApplicationOperationStore()
  store.operations = {}
  store.targets = {}
  const refresh = vi.fn(async () => {})
  const target = { game_path: '/Games/A', version_id: 'same' }
  const wrapper = mount(
    defineComponent({
      setup() {
        useTargetOperationRefresh(target, refresh)
        return () => null
      },
    })
  )
  store.accept({ operationId: 'other', status: 'completed' })
  store.targets.other = { game_path: '/Games/B', version_id: 'same' }
  store.accept({ operationId: 'own', status: 'running' })
  store.targets.own = target
  await flushPromises()
  expect(refresh).not.toHaveBeenCalled()
  store.accept({ operationId: 'own', status: 'completed' })
  await flushPromises()
  expect(refresh).toHaveBeenCalledOnce()
  store.accept({ operationId: 'own', status: 'running' })
  store.accept({ operationId: 'early', status: 'completed' })
  await flushPromises()
  expect(refresh).toHaveBeenCalledOnce()
  store.targets.early = target
  await flushPromises()
  expect(refresh).toHaveBeenCalledTimes(2)
  wrapper.unmount()
  store.accept({ operationId: 'closed', status: 'completed' })
  store.targets.closed = target
  await flushPromises()
  expect(refresh).toHaveBeenCalledTimes(2)
})
