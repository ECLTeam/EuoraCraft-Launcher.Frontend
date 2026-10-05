import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import type { ApiResponse } from '@/types/api'
import type { JavaRuntime } from '@/types/java'

function javaData<T>(response: ApiResponse<T>, action: string): T {
  const value = unwrapResponse(response, action)
  if (value === undefined || value === null) throw new Error(`${action}未返回数据`)
  return value
}

export const javaApi = {
  async inventory(force = false) {
    return javaData(await backend.command('game_java_inventory', { force }), '读取 Java 清单')
  },
  async register(path: string) {
    return javaData(await backend.command('game_java_register', { path }), '登记 Java')
  },
  async setEnabled(runtimeId: string, isEnabled: boolean) {
    return javaData(
      await backend.command('game_java_set_enabled', { runtime_id: runtimeId, is_enabled: isEnabled }),
      '修改 Java 状态'
    )
  },
  async forget(runtimeId: string) {
    return javaData(await backend.command('game_java_forget', { runtime_id: runtimeId }), '移除 Java 登记')
  },
  async select(runtime: JavaRuntime, requiredMajor?: number | null, target?: { gamePath: string; versionId: string }) {
    return javaData(
      await backend.command('game_java_select', {
        runtime_id: runtime.runtimeId,
        required_major: requiredMajor,
        ...(target ? { game_path: target.gamePath, version_id: target.versionId } : {}),
      }),
      '验证 Java 选择'
    )
  },
  async catalog(majorVersion?: number | null, runtimeKind: 'JRE' | 'JDK' = 'JRE', force = false) {
    return javaData(
      await backend.command('game_java_catalog', { major_version: majorVersion, runtime_kind: runtimeKind, force }),
      '读取 Java 下载目录'
    )
  },
  async plan(packageId: string) {
    return javaData(await backend.command('game_java_install_plan', { package_id: packageId }), '生成 Java 安装计划')
  },
  async install(planId: string) {
    return javaData(await backend.command('game_java_install', { plan_id: planId }), '安装 Java')
  },
  async updates() {
    return javaData(await backend.command('game_java_check_updates', {}), '检查 Java 更新')
  },
  async remove(runtimeId: string) {
    return javaData(await backend.command('game_java_remove', { runtime_id: runtimeId }), '移除 Java 安装')
  },
  async cleanup() {
    return javaData(await backend.command('game_java_cleanup', {}), '清理 Java 遗留文件')
  },
}
