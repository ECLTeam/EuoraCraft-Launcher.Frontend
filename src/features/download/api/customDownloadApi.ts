import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { i18n } from '@/i18n'
import type { CommandPayloadMap } from '@/types/api'
import type { ApplicationOperation } from '@/types/operations'

export type CustomDownloadIntent = CommandPayloadMap['custom_download_start']

export const customDownloadApi = {
  async defaults() {
    return unwrapResponse(await backend.command('custom_download_defaults'), i18n.global.t('advanced.downloadTitle'))
  },
  async start(intent: CustomDownloadIntent): Promise<ApplicationOperation> {
    const result = unwrapResponse(
      await backend.command('custom_download_start', intent),
      i18n.global.t('advanced.downloadTitle')
    )
    return { operationId: result.operationId, kind: 'custom_download', status: 'pending' }
  },
  async retry(operationId: string): Promise<ApplicationOperation> {
    const result = unwrapResponse(
      await backend.command('custom_download_retry', { operation_id: operationId }),
      i18n.global.t('common.retry')
    )
    return { operationId: result.operationId, kind: 'custom_download', status: 'pending' }
  },
  async browse(defaultDirectory: string) {
    return unwrapResponse(
      await backend.command('select_directory', {
        purpose: 'custom-download',
        default_directory: defaultDirectory || undefined,
      }),
      i18n.global.t('advanced.downloadFolder')
    )
  },
}
