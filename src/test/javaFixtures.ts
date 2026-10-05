import type { JavaInventory, JavaRuntime } from '@/types/java'

export function javaRuntime(patch: Partial<JavaRuntime> = {}): JavaRuntime {
  return {
    runtimeId: 'a'.repeat(24),
    executablePath: 'C:/Java/bin/java.exe',
    javaHomePath: 'C:/Java',
    vendor: '',
    runtimeKind: 'JRE',
    majorVersion: 21,
    fullVersion: '21.0.2',
    architecture: 'x64',
    origin: 'manual',
    isEnabled: true,
    validationStatus: 'valid',
    discoverySources: [],
    references: [],
    isInUse: false,
    ...patch,
  }
}

export function javaInventory(runtimes: JavaRuntime[] = []): JavaInventory {
  return {
    runtimes,
    platform: 'windows',
    architecture: 'x64',
    managedRootPath: 'C:/LauncherData/runtimes/java',
    cleanupPendingCount: 0,
  }
}
