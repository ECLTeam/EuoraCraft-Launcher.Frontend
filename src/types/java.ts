export interface JavaRuntime {
  runtimeId: string
  executablePath: string
  javaHomePath: string
  vendor: string
  runtimeKind: 'JDK' | 'JRE'
  majorVersion: number
  fullVersion: string
  architecture: string
  origin: 'system' | 'manual' | 'managed'
  isEnabled: boolean
  validationStatus: 'valid' | 'missing' | 'invalid'
  discoverySources: string[]
  distributionSource?: string | null
  releaseName?: string | null
  packageChecksum?: string | null
  packagePlatform?: string | null
  isInUse?: boolean
  usageUnknown?: boolean
  references?: string[]
}

export interface JavaInventory {
  runtimes: JavaRuntime[]
  platform: string
  architecture: string
  managedRootPath: string
  cleanupPendingCount: number
}

export interface JavaPackage {
  packageId: string
  distributionSource: 'temurin'
  releaseName: string
  majorVersion: number
  runtimeKind: 'JDK' | 'JRE'
  platform: string
  architecture: string
  filename: string
  downloadBytes: number
  checksum: string
}

export interface JavaCatalog {
  availableMajorVersions: number[]
  recommendedMajorVersion: number
  majorVersion: number
  platform: string
  architecture: string
  packages: JavaPackage[]
}

export interface JavaInstallPlan {
  planId: string
  package: JavaPackage
  installPath: string
  expiresAt: number
  estimatedFreeBytes: number
}

export interface JavaUpdate {
  runtimeId: string
  package: JavaPackage
}
