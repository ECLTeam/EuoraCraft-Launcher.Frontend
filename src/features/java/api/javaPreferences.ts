import { instanceSettingsApi } from '@/features/instances/api/instanceSettingsApi'
import { settingsSaveSession } from '@/features/instances/model/instanceSaveSession'
import type { ScannedVersion } from '@/types/instances'
import type { JavaRuntime } from '@/types/java'
import { gamePathIdentity } from '@/utils/path'

export async function useJavaForInstance(version: ScannedVersion, runtime: JavaRuntime): Promise<void> {
  const target = { path: version.path, versionId: version.versionId }
  const key = `${gamePathIdentity(target.path)}\0${target.versionId}`
  const draft = settingsSaveSession.draft(key)
  const current = draft || (await instanceSettingsApi.get(target))
  await settingsSaveSession.enqueue(
    key,
    { ...current, javaMode: 'manual', customJava: true, javaPath: runtime.executablePath },
    (submitted) => instanceSettingsApi.save(target, submitted)
  )
}
