import * as v from 'valibot'

const count = v.pipe(v.number(), v.finite(), v.minValue(0), v.integer())
const stageIds = v.picklist([
  'resolve_metadata',
  'download_client',
  'download_loader',
  'download_loader_libraries',
  'install_loader',
  'check_resources',
  'resolve_fabric_api',
  'download_game_files',
  'finalize_install',
])
const stageSchema = v.object({
  id: stageIds,
  status: v.picklist(['pending', 'running', 'completed', 'skipped', 'error', 'canceled']),
  action: v.picklist(['working', 'checking', 'asset_index', 'preflight', 'downloading', 'retrying', 'fallback']),
  progress: v.object({
    unit: v.picklist(['bytes', 'files', 'items', 'unknown']),
    completed: count,
    total: v.nullable(count),
  }),
  download: v.nullable(
    v.object({
      completedFiles: count,
      totalFiles: v.nullable(count),
      transferredBytes: count,
      speedBytesPerSecond: count,
    })
  ),
  startedAt: v.nullable(count),
  updatedAt: count,
})
const installationSchema = v.pipe(
  v.object({
    revision: count,
    status: v.picklist(['pending', 'running', 'completed', 'error', 'canceled']),
    cancellationRequested: v.boolean(),
    currentStageId: v.nullable(stageIds),
    stages: v.pipe(v.array(stageSchema), v.minLength(1), v.maxLength(9)),
    errorCode: v.nullable(v.string()),
    message: v.string(),
  }),
  v.check((value) => {
    const ids = value.stages.map((stage) => stage.id)
    return (
      new Set(ids).size === ids.length &&
      (value.currentStageId === null || ids.includes(value.currentStageId)) &&
      value.stages.filter((stage) => stage.status === 'running').length <= 1
    )
  }, 'Invalid installation stage identity')
)

export type InstallationSnapshot = v.InferOutput<typeof installationSchema>
export type InstallationStage = InstallationSnapshot['stages'][number]

export function parseInstallation(value: unknown): InstallationSnapshot | null {
  const result = v.safeParse(installationSchema, value)
  return result.success ? result.output : null
}

export function currentInstallationStage(installation?: InstallationSnapshot | null): InstallationStage | undefined {
  return installation?.stages.find((stage) => stage.id === installation.currentStageId)
}

export function installationPercentage(installation: InstallationSnapshot): number | null {
  const stage = currentInstallationStage(installation)
  if (!stage || stage.progress.unit === 'unknown' || stage.action === 'preflight' || !stage.progress.total) return null
  return Math.round(Math.min(100, Math.max(0, (stage.progress.completed / stage.progress.total) * 100)))
}
