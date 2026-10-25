import type { InstallationSnapshot, InstallationStage } from './installation'

export function installationFixture(overrides: Partial<InstallationSnapshot> = {}): InstallationSnapshot {
  const ids = ['resolve_metadata', 'download_game_files', 'finalize_install'] as const
  return {
    revision: 1,
    status: 'running',
    cancellationRequested: false,
    currentStageId: 'download_game_files',
    errorCode: null,
    message: '',
    stages: ids.map((id, index): InstallationStage => ({
      id,
      status: index === 0 ? 'completed' : index === 1 ? 'running' : 'pending',
      action: 'downloading',
      progress: { unit: 'bytes', completed: 60, total: 100 },
      download:
        index === 1 ? { completedFiles: 1, totalFiles: 10, transferredBytes: 60, speedBytesPerSecond: 30 } : null,
      startedAt: 1000,
      updatedAt: 1000,
    })),
    ...overrides,
  }
}
