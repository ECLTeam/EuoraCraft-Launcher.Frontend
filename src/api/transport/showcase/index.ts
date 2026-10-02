import type { MinecraftAccount, WardrobeItem } from '@/types/accounts'
import type { ApiResponse, BackendEvents } from '@/types/api'
import type { ConnectorMatchResult, ConnectorStatus, EasyTierStatus } from '@/types/connect'
import type { CrashAnalysisResult, GameInstance, GameResource, VersionRunStats } from '@/types/instances'
import type { PluginInfo } from '@/types/plugins'
import { loadShowcaseConfig, persistShowcaseConfig } from './configPersistence'
import {
  createShowcaseAccount,
  makeShowcaseWorldBackups,
  showcaseInstanceMods,
  showcaseAccounts,
  showcaseAuthlibServers,
  showcaseConfig,
  showcaseGameOptions,
  showcaseInfoCard,
  showcaseLoaderVersions,
  showcaseMods,
  showcasePlugins,
  showcaseResources,
  showcaseScannedVersions,
  showcaseScreenshots,
  showcaseSearchItemsByType,
  showcaseServers,
  showcaseSchematicPreview,
  showcaseWorlds,
  showcaseVersionCatalog,
} from './fixtures'
import type { BackendTransport } from '../types'

type EventHandler = (payload: unknown) => void

function success<T>(data?: T): ApiResponse<T> {
  return {
    success: true,
    ...(data === undefined ? {} : { data }),
    timestamp: Date.now(),
  }
}

function failure(message: string, errorCode: string): ApiResponse<never> {
  return { success: false, message, errorCode, timestamp: Date.now() }
}

function getPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
}

function cloneConfigData<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value)) as T
}

function wait(duration = 90): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

export function createShowcaseTransport(): BackendTransport {
  const listeners = new Map<string, Set<EventHandler>>()
  const config = loadShowcaseConfig(showcaseConfig)
  const accounts = structuredClone(showcaseAccounts)
  const plugins = structuredClone(showcasePlugins)
  const wardrobe: WardrobeItem[] = []
  const runningInstances: GameInstance[] = []
  const versionStats = new Map<string, VersionRunStats>()
  // 实例工作区可变状态：存档 / 备份 / 截图 / 服务器 / 资源
  const worlds = structuredClone(showcaseWorlds)
  const worldBackups = new Map<
    string,
    { id: string; createdAt?: string; locked: boolean; automatic: boolean; size: number }[]
  >(showcaseWorlds.map((world, index) => [world.id, makeShowcaseWorldBackups(index)]))
  const servers = structuredClone(showcaseServers)
  const screenshots = structuredClone(showcaseScreenshots)
  const resources: Record<string, GameResource[]> = structuredClone(showcaseResources)
  let connectorStatus: ConnectorStatus = {
    mode: 'idle',
    roomCode: null,
    mcHost: null,
    mcPort: null,
    gameInfo: null,
    players: [],
    nodes: [],
    error: null,
  }
  let easyTierStatus: EasyTierStatus = {
    installed: true,
    status: 'installed',
    progress: 100,
    speed: 0,
    error: null,
  }
  let portScanCount = 0
  let connectorStartTimer: ReturnType<typeof setTimeout> | null = null

  /** 演示用已完成操作（GameOperation 消费方期待可直接完成的任务） */
  const demoOperation = (kind: string) => ({
    operationId: `showcase-${kind}-${Date.now()}`,
    kind,
    status: 'completed' as const,
    percent: 100,
    message: '展示模式操作已即时完成',
  })

  const hostPlayer = {
    name: 'CloudMaple685',
    vendor: 'EuoraCraft Launcher',
    iconBase64: null,
    kind: 'host' as const,
    machineId: 'showcase-host',
  }
  const guestPlayer = {
    name: 'SkyBuilder',
    vendor: 'Qomicex Launcher',
    iconBase64: null,
    kind: 'guest' as const,
    machineId: 'showcase-guest',
  }

  const setHostedRoom = () => {
    connectorStartTimer = null
    connectorStatus = {
      mode: 'host',
      roomCode: 'U/ECL7-W9KM-4R2P-X8QA',
      mcHost: '127.0.0.1',
      mcPort: 25565,
      gameInfo: { gameVersion: '1.21.5', loader: 'Fabric', loaderVersion: '0.16.10' },
      players: [hostPlayer, guestPlayer],
      nodes: [],
      error: null,
    }
  }

  const connectorMatches = (): ConnectorMatchResult => ({
    mods: [
      { source: 'modrinth', id: 'fabric-api', hash: '67a873fd8fb045aa', name: 'Fabric API' },
      { source: 'curseforge', id: 'sodium', hash: 'af340d09e96544bd', name: 'Sodium' },
    ],
    instances: showcaseScannedVersions.slice(0, 3).map((instance, index) => ({
      gamePath: instance.path,
      versionId: instance.versionId,
      name: instance.displayName || instance.versionId,
      gameVersion: instance.vanillaName,
      loader: instance.primaryLoader || null,
      loaderVersion: instance.loaderVersion ?? null,
      matched: index === 0,
      modCount: index === 0 ? 2 : index + 2,
    })),
  })
  const showcaseCrashReport: CrashAnalysisResult = {
    reportId: '5c0a5eca5e0a4eaf8f465ad0f42d89b1',
    versionId: 'Showcase-1.21.5-Fabric',
    exitCode: 1,
    detectedBy: ['exit_code', 'crash_log'],
    reasons: [
      {
        code: 'mod.missing_dependency',
        confidence: 'certain',
        evidence: ['Mod example-addon depends on example-lib 2.0 or newer, which is missing'],
        parameters: { files: ['example-addon.jar'] },
      },
      {
        code: 'mod.mixin_failure',
        confidence: 'likely',
        evidence: ['Mixin apply failed example-addon.mixins.json:ClientMixin'],
        parameters: {},
      },
    ],
    sourceFiles: ['game-output.log', 'latest.log'],
    hasOutput: true,
  }

  const emit = <E extends keyof BackendEvents>(event: E, payload: BackendEvents[E]) => {
    for (const handler of listeners.get(event) ?? []) handler(payload)
  }

  const emitInstallProgress = (taskId: string) => {
    // 模拟真实下载指标（字节进度/文件数/速度），便于演示实时下载卡。
    const totalBytes = 400 * 1024 * 1024
    const totalFiles = 50
    const steps: BackendEvents['game:install_progress'][] = [
      { phase: 'install', task_id: taskId, message: '正在准备展示安装任务', done: 0, total: 1 },
      {
        phase: 'download',
        task_id: taskId,
        message: '正在下载展示文件 assets/minecraft/textures/block.png',
        done: 48 * 1024 * 1024,
        total: totalBytes,
        progress_type: 'bytes',
        total_files: totalFiles,
        downloaded_files: 6,
        speed: 6 * 1024 * 1024,
        subtask: 'download_assets',
      },
      {
        phase: 'download',
        task_id: taskId,
        message: '正在下载展示文件 libraries/net/minecraft/server.jar',
        done: 236 * 1024 * 1024,
        total: totalBytes,
        progress_type: 'bytes',
        total_files: totalFiles,
        downloaded_files: 31,
        speed: 13 * 1024 * 1024,
        subtask: 'download_assets',
      },
      {
        phase: 'download',
        task_id: taskId,
        message: '正在校验展示文件',
        done: totalBytes,
        total: totalBytes,
        subtask: 'check_files',
        downloaded_files: totalFiles,
        total_files: totalFiles,
      },
      {
        phase: 'done',
        task_id: taskId,
        message: '展示安装完成',
        done: 1,
        total: 1,
        total_files: totalFiles,
        downloaded_files: totalFiles,
        speed: 0,
      },
    ]
    steps.forEach((step, index) =>
      setTimeout(
        () => emit('game:install_progress', { ...step, task_id: taskId } as BackendEvents['game:install_progress']),
        480 * (index + 1)
      )
    )
  }

  const emitLaunchProgress = () => {
    const steps: BackendEvents['game:launch_progress'][] = [
      { phase: 'preparing', message: '正在准备展示实例', percent: 3 },
      { phase: 'microsoft_token', message: '正在检查正版登录令牌，过期时将自动刷新', percent: 7 },
      { phase: 'account_ready', message: '正版登录令牌已就绪', percent: 17 },
      { phase: 'checking', message: '正在检查游戏文件', percent: 25 },
      { phase: 'files_checked', message: '游戏文件检查完成', percent: 55 },
      { phase: 'building_args', message: '正在生成启动参数', percent: 72 },
      { phase: 'launching', message: '正在启动展示实例', percent: 97 },
      { phase: 'launched', message: '展示实例已启动', percent: 100 },
    ]
    steps.forEach((step, index) => setTimeout(() => emit('game:launch_progress', step), 220 * (index + 1)))
  }

  const setCurrentAccount = (accountId: string) => {
    let current: MinecraftAccount | null = null
    accounts.accounts.forEach((account) => {
      account.isCurrent = account.id === accountId
      if (account.isCurrent) current = account
    })
    accounts.current = current
    emit('accounts_changed', structuredClone(accounts))
  }

  const updatePluginStatus = (name: string, status: string) => {
    const plugin = plugins.find((item) => item.name === name)
    if (!plugin) return
    plugin.status = status
    emit('plugin:status_changed', { name, action: status, result: 'success' })
  }

  const invoke = async (command: string, rawPayload: unknown): Promise<ApiResponse<unknown>> => {
    await wait()
    const payload = getPayload(rawPayload)

    switch (command) {
      case 'window_open':
        return failure('展示模式使用同页主题控制台', 'WINDOW_NATIVE_UNAVAILABLE')
      case 'window_list':
        return success([])
      case 'window_focus':
      case 'window_close':
      case 'window_update_bounds':
        return success()
      case 'system_ping':
        return success({ status: 'ok', message: 'Showcase Transport 已连接' })
      case 'system_memory':
        return success({ totalMb: 32768, usedMb: 8192, freeMb: 24576, percentUsed: 25 })
      case 'connector_status':
        return success(structuredClone(connectorStatus))
      case 'connector_host_port':
        if (connectorStartTimer) clearTimeout(connectorStartTimer)
        setHostedRoom()
        connectorStatus.mcPort = Number(payload.port || 25565)
        return success({ roomCode: connectorStatus.roomCode })
      case 'connector_host_instance':
        if (connectorStartTimer) clearTimeout(connectorStartTimer)
        connectorStatus = {
          mode: 'starting',
          roomCode: null,
          mcHost: null,
          mcPort: null,
          gameInfo: null,
          players: [],
          nodes: [],
          error: null,
        }
        connectorStartTimer = setTimeout(setHostedRoom, 900)
        return success({ status: 'starting' })
      case 'connector_join':
        if (connectorStartTimer) clearTimeout(connectorStartTimer)
        connectorStartTimer = null
        connectorStatus = {
          mode: 'guest',
          roomCode: String(payload.code || 'U/ECL7-W9KM-4R2P-X8QA'),
          mcHost: '127.0.0.1',
          mcPort: 25566,
          gameInfo: { gameVersion: '1.21.5', loader: 'Fabric', loaderVersion: '0.16.10' },
          players: [hostPlayer, { ...guestPlayer, name: 'ShowcasePlayer', machineId: 'showcase-local' }],
          nodes: [],
          error: null,
        }
        return success({ mcHost: connectorStatus.mcHost, mcPort: connectorStatus.mcPort })
      case 'connector_leave':
        if (connectorStartTimer) clearTimeout(connectorStartTimer)
        connectorStartTimer = null
        connectorStatus = {
          mode: 'idle',
          roomCode: null,
          mcHost: null,
          mcPort: null,
          gameInfo: null,
          players: [],
          nodes: [],
          error: null,
        }
        return success({ status: 'idle' })
      case 'connector_kick':
        connectorStatus.players = connectorStatus.players.filter((player) => player.machineId !== payload.machine_id)
        return success({ status: 'ok' })
      case 'connector_match_instances':
        return success(connectorMatches())
      case 'connector_easytier_status':
        return success(structuredClone(easyTierStatus))
      case 'connector_easytier_download':
        easyTierStatus = { installed: true, status: 'installed', progress: 100, speed: 0, error: null }
        return success(structuredClone(easyTierStatus))
      case 'connector_detect_ports':
        portScanCount += 1
        return success({ ports: portScanCount >= 2 ? [25565] : [] })
      case 'connector_search_mc_port':
        return success({ port: portScanCount >= 2 ? 25565 : null })
      case 'connector_nat_type':
        return success({
          type: 'cone',
          detailType: 'portRestricted',
          publicIp: '203.0.113.42',
          publicPort: 51820,
          publicPortEnd: 51820,
          supportsIpv6: true,
        })
      case 'frontend_ready':
        return success()
      case 'debug_reset_launcher_data':
        return success({
          action: 'reset_launcher_data',
          restart_required: true,
          targets: ['setting.json', 'info_card.json', 'notice.json'],
        })
      case 'debug_clear_plugins':
        return success({
          action: 'clear_plugins',
          restart_required: true,
          targets: ['plugins', 'plugin_config'],
        })
      case 'settings_get': {
        if (typeof payload.section === 'string') return success(structuredClone(config[payload.section]))
        if (Array.isArray(payload.sections)) {
          return success(
            Object.fromEntries(
              payload.sections.map((section) => [String(section), structuredClone(config[String(section)])])
            )
          )
        }
        return success(structuredClone(config))
      }
      case 'settings_set':
        config[String(payload.section)] = cloneConfigData(payload.data)
        persistShowcaseConfig(config)
        return success()
      case 'game_java_scan':
        return success([
          {
            path: 'Showcase/Java/bin/javaw.exe',
            version: '21.0.7',
            major_version: 21,
            java_type: 'OpenJDK',
            arch: 'x64',
            sources: ['showcase'],
          },
        ])
      case 'game_versions':
        if (payload.classified) return success(structuredClone(showcaseVersionCatalog))
        return success(
          showcaseVersionCatalog.all.map((item) => ({
            ...item,
            time: item.releaseTime,
            url: 'showcase://version',
          }))
        )
      case 'game_loader_versions':
        return success(structuredClone(showcaseLoaderVersions[`${String(payload.loader)}_versions`] ?? []))
      case 'game_scan':
        return success(structuredClone(showcaseScannedVersions))
      case 'game_install': {
        const taskId = String(payload.task_id ?? `showcase-install-${Date.now()}`)
        const versionId = String(payload.version_id)
        emitInstallProgress(taskId)
        return success({
          taskId,
          versionId,
          versionName: String(payload.version_name || versionId),
        })
      }
      case 'game_uninstall':
        return success()
      case 'accounts_list':
        return success(structuredClone(accounts))
      case 'accounts_current':
        return success(structuredClone(accounts.current))
      case 'accounts_add_offline': {
        const account = createShowcaseAccount(
          String(payload.username || 'ShowcasePlayer'),
          'offline',
          typeof payload.uuid === 'string' && payload.uuid ? payload.uuid : undefined
        )
        accounts.accounts.push(account)
        setCurrentAccount(account.id)
        return success(structuredClone(account))
      }
      case 'accounts_add_authlib': {
        const account = createShowcaseAccount(String(payload.email || 'AuthlibPlayer'), 'authlib')
        account.auth_server = String(payload.server_url || '')
        accounts.accounts.push(account)
        setCurrentAccount(account.id)
        return success(structuredClone(account))
      }
      case 'accounts_select_authlib_profile':
        return success(structuredClone(accounts.current))
      case 'authlib_resolve_server':
        return success(String(payload.server_url || ''))
      case 'accounts_switch':
        setCurrentAccount(String(payload.account_id))
        return success()
      case 'accounts_remove': {
        const index = accounts.accounts.findIndex((item) => item.id === payload.account_id)
        if (index >= 0) accounts.accounts.splice(index, 1)
        setCurrentAccount(accounts.accounts[0]?.id ?? '')
        return success()
      }
      case 'accounts_refresh_profile':
        return success()
      case 'accounts_texture_urls': {
        const account = accounts.accounts.find((item) => item.id === payload.account_id)
        if (account?.type === 'microsoft') return success({ skinUrl: account.skinUrl, skinModel: 'slim' })
        return success({ skinUrl: account?.skinUrl })
      }
      case 'wardrobe_list':
        return success(structuredClone(wardrobe))
      case 'wardrobe_sync_account_skin': {
        let item = wardrobe.find((candidate) => candidate.kind === 'skin')
        const deduplicated = Boolean(item)
        if (!item) {
          item = {
            id: 'showcase-account-skin',
            kind: 'skin',
            name: 'CloudMaple685 当前皮肤',
            model: 'classic',
            favorite: false,
            width: 64,
            height: 64,
            byteSize: 1024,
            sha256: 'showcase-account-skin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          wardrobe.unshift(item)
        }
        return success({ item: structuredClone(item), deduplicated })
      }
      case 'wardrobe_import': {
        const kind = payload.kind === 'cape' ? 'cape' : 'skin'
        const item: WardrobeItem = {
          id: `showcase-${Date.now()}`,
          kind,
          name: kind === 'skin' ? 'Showcase Skin' : 'Showcase Cape',
          model: kind === 'skin' ? 'classic' : null,
          favorite: false,
          width: 64,
          height: kind === 'skin' ? 64 : 32,
          byteSize: 1024,
          sha256: 'showcase',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        wardrobe.unshift(item)
        return success({ item: structuredClone(item), deduplicated: false })
      }
      case 'wardrobe_update': {
        const item = wardrobe.find((candidate) => candidate.id === payload.item_id)
        if (item) {
          if (typeof payload.name === 'string') item.name = payload.name
          if (payload.model === 'classic' || payload.model === 'slim') item.model = payload.model
          if (typeof payload.favorite === 'boolean') item.favorite = payload.favorite
        }
        return success(structuredClone(item))
      }
      case 'wardrobe_delete': {
        const index = wardrobe.findIndex((item) => item.id === payload.item_id)
        if (index >= 0) wardrobe.splice(index, 1)
        return success()
      }
      case 'wardrobe_texture':
        return success({ dataUrl: `${import.meta.env.BASE_URL}img/skins/Alex.png`, mime: 'image/png' as const })
      case 'wardrobe_export':
        return success({ path: 'C:\\Users\\Player\\skin.png' })
      case 'wardrobe_apply_skin':
      case 'microsoft_reset_skin':
      case 'microsoft_set_cape':
      case 'microsoft_reset_cape':
        return success(structuredClone(accounts.accounts.find((item) => item.id === payload.account_id)))
      case 'accounts_start_microsoft_login': {
        const stages = ['authorization_confirmed', 'minecraft_token', 'profile', 'saving'] as const
        stages.forEach((stage, index) => {
          setTimeout(() => emit('accounts_microsoft_login_status', { status: 'progress', stage }), 1000 + index * 500)
        })
        setTimeout(() => emit('accounts_microsoft_login_status', { status: 'ready' }), 3200)
        return success({
          status: 'pending',
          userCode: 'ECL-DEMO',
          verificationUri: 'https://microsoft.com/link',
          message: '展示模式不会发起真实登录',
          interval: 3,
        })
      }
      case 'accounts_poll_microsoft_login':
        return success({ status: 'ready', message: '展示授权已完成' })
      case 'accounts_microsoft_login_config':
        return success({ available: true, needs_client_id: false })
      case 'accounts_cancel_microsoft_login':
        return success({ cancelled: true })
      case 'accounts_complete_microsoft_login':
        return success({
          status: 'completed',
          account: structuredClone(accounts.accounts[0]),
          message: '展示登录完成',
        })
      case 'authlib_servers':
        return success(structuredClone(showcaseAuthlibServers))
      case 'user_agreement_get':
      case 'user_agreement_save':
        return success({ accepted: true, uuid: 'showcase-agreement' })
      case 'user_agreement_clear':
        return success()
      case 'game_instances':
        return success(structuredClone(runningInstances))
      case 'game_version_stats': {
        const key = `${String(payload.game_path)}::${String(payload.version_id)}`
        return success(
          structuredClone(
            versionStats.get(key) ?? {
              launchCount: 7,
              lastRunDurationSeconds: 3862,
              totalRunDurationSeconds: 28435,
            }
          )
        )
      }
      case 'game_crash_analyze':
        return success({ ...structuredClone(showcaseCrashReport), versionId: String(payload.version_id) })
      case 'game_crash_output':
        return success({
          name: 'game-output.log',
          content:
            '[main/ERROR] Missing dependency example-lib 2.0 or newer\n[main/ERROR] Mixin apply failed example-addon.mixins.json:ClientMixin',
        })
      case 'game_crash_export':
        return success({ path: 'Showcase/EuoraCraft-crash-report.zip' })
      case 'game_launch': {
        emitLaunchProgress()
        const instance: GameInstance = {
          id: `showcase-instance-${Date.now()}`,
          name: String(payload.version_id),
          type: 'Minecraft',
          isRunning: true,
          pid: 24000 + runningInstances.length,
          version: String(payload.version_id),
          versionId: String(payload.version_id),
          loader: 'Vanilla',
          gamePath: String(payload.game_path || '.minecraft'),
        }
        runningInstances.push(instance)
        const statsKey = `${instance.gamePath}::${instance.versionId}`
        const stats = versionStats.get(statsKey) ?? {
          launchCount: 7,
          lastRunDurationSeconds: 3862,
          totalRunDurationSeconds: 28435,
        }
        versionStats.set(statsKey, { ...stats, launchCount: stats.launchCount + 1 })
        emit('game:instances_changed', {
          action: 'started',
          instanceId: instance.id,
          versionId: instance.versionId,
          gamePath: instance.gamePath,
        })
        return success({
          instanceId: instance.id,
          versionId: instance.versionId,
          gamePath: instance.gamePath,
        })
      }
      case 'game_launch_cancel':
        return success()
      case 'game_instance_stop': {
        const index = runningInstances.findIndex((instance) => instance.id === payload.instance_id)
        const [stopped] = index >= 0 ? runningInstances.splice(index, 1) : []
        if (stopped) {
          emit('game:instances_changed', {
            action: 'stopped',
            instanceId: stopped.id,
            versionId: stopped.versionId,
            gamePath: stopped.gamePath,
          })
        }
        return success()
      }
      case 'info_card_get':
        return success(structuredClone(showcaseInfoCard))
      case 'plugin_list':
        return success(structuredClone(plugins))
      case 'plugin_info':
        return success(structuredClone(plugins.find((item) => item.name === payload.plugin_name)))
      case 'plugin_enable':
        updatePluginStatus(String(payload.plugin_name), 'enabled')
        return success()
      case 'plugin_disable':
        updatePluginStatus(String(payload.plugin_name), 'disabled')
        return success()
      case 'plugin_reload':
        updatePluginStatus(String(payload.plugin_name), 'enabled')
        return success()
      case 'plugin_unload': {
        const index = plugins.findIndex((item) => item.name === payload.plugin_name)
        if (index >= 0) plugins.splice(index, 1)
        emit('plugin:status_changed', {
          name: String(payload.plugin_name),
          action: 'unload',
          result: 'success',
        })
        return success()
      }
      case 'plugin_install':
        plugins.push({
          name: 'installed-showcase-plugin',
          title: '刚刚安装的展示插件',
          version: '1.0.0',
          description: '由展示模式在内存中创建。',
          author: 'Showcase',
          icon: '',
          status: payload.confirm_unverified_source ? 'pending_restart' : 'enabled',
          pending_restart: !!payload.confirm_unverified_source,
          error: null,
          dependencies: {},
          services: [],
          is_system: false,
        } satisfies PluginInfo)
        emit('plugin:status_changed', { name: 'installed-showcase-plugin', action: 'install', result: 'success' })
        return success()
      case 'plugin_package_inspect':
        return success({
          package: {
            name: 'installed-showcase-plugin',
            version: '1.0.0',
            manifest_sha256: 'a'.repeat(64),
            file_count: 2,
            total_uncompressed_bytes: 1024,
          },
          target_tag: 'windows-x86_64-cp312',
          python_dependencies: [],
          wheel_count: 0,
          has_target_lock: false,
          unverified_source: true,
          dependencies_ready: true,
        })
      case 'plugin_get_routes':
        return success([])
      case 'plugin_get_slots':
        return success({})
      case 'plugin_call_command':
        return success({ command: payload.command, mode: 'showcase' })
      case 'plugin_get_settings':
        return success({ schema: {}, values: {} })
      case 'plugin_update_setting':
        return success()
      case 'search_mods': {
        const query = String(payload.query ?? '').toLowerCase()
        const type = String(payload.resource_type ?? 'mod')
        const catalog = showcaseSearchItemsByType[type] ?? showcaseMods
        const items = catalog.filter(
          (item) =>
            !query ||
            item.title.toLowerCase().includes(query) ||
            item.displayTitle.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        )
        return success({
          items: structuredClone(items),
          sources: {
            modrinth: { available: true, error: '', total: items.length },
            curseforge: { available: false, error: 'Showcase 未配置 CurseForge API Key', total: 0 },
            mcmod: { available: true, error: '', total: 1 },
          },
          total: items.length,
          query,
          ...(payload.source === 'all'
            ? {
                sessionId: 'showcase-search',
                page: 1,
                pageCount: 1,
                hasMore: false,
                totalExact: true,
                truncated: false,
              }
            : {}),
        })
      }
      case 'mod_source_config':
        return success({ curseforge: { available: false } })
      case 'get_mods':
        // 演示实例共享同一 .minecraft 目录（非隔离），Fabric/Forge 模组混装属正常情况
        return success(structuredClone(showcaseInstanceMods))
      case 'get_mod_info':
        return success({
          ...(showcaseMods.find((item) => item.id === payload.mod_id || item.projectId === payload.mod_id) ??
            showcaseMods[0]),
          body: 'Showcase 模组详情。',
          loaders: ['fabric', 'quilt'],
          gameVersions: ['1.21.5', '1.21.4'],
        })
      case 'get_mod_versions':
        return success([
          {
            id: 'showcase-mod-version',
            projectId: String(payload.mod_id ?? 'sodium'),
            name: 'Showcase 1.0.0',
            versionNumber: '1.0.0',
            gameVersions: ['1.21.5'],
            loaders: ['fabric'],
            filename: 'showcase-mod.jar',
            downloads: 1024,
            releaseType: 'release',
            dependencies: [
              {
                projectId: 'fabric-api',
                versionId: null,
                filename: null,
                dependencyType: 'required',
              },
            ],
          },
          {
            id: 'showcase-mod-version-snapshot',
            projectId: String(payload.mod_id ?? 'sodium'),
            name: 'Showcase 1.1.0-snapshot',
            versionNumber: '1.1.0-snapshot',
            gameVersions: ['26w29a'],
            loaders: ['fabric'],
            filename: 'showcase-mod-snapshot.jar',
            downloads: 512,
            releaseType: 'beta',
          },
        ])
      case 'download_mod':
        return success({
          installed: [{ filename: 'showcase-mod.jar', source: String(payload.source), skipped: false }],
          modsPath: 'Showcase/.minecraft/versions/1.21.5/mods',
        })
      case 'fs_exists':
        return success({ exists: false, is_dir: false, is_file: false })
      case 'fs_read_dir':
        return success([])
      case 'fs_read_file':
        return success({ content: '', size: 0 })
      case 'file_resolve':
        return success({ path: String(payload.path ?? '') })
      case 'select_directory':
        return success({ path: 'Showcase/SelectedDirectory' })
      case 'select_java':
        return success({ path: 'Showcase/Java/bin/javaw.exe' })
      case 'select_file':
        return success({
          path: payload.purpose === 'plugin-package' ? 'Showcase/Example.eclplugin' : 'Showcase/SelectedFile.zip',
        })
      case 'select_save_file':
        return success({ path: `Showcase/${String(payload.default_name || 'SavedFile')}` })
      case 'select_image':
        return success({ path: 'Showcase/SelectedImage.png', base64: '' })
      case 'select_background_video':
        return failure('展示模式暂不支持视频背景', 'BACKGROUND_VIDEO_SHOWCASE_UNSUPPORTED')
      case 'image_fetch_data_url':
        return success({})
      case 'image_save_url':
        return success({
          dataUrl: (payload as { url?: string }).url ?? '',
          base64: '',
          url: (payload as { url?: string }).url ?? '',
          path: (payload as { url?: string }).url ?? '',
        })
      case 'image_save_as':
        return success({ path: 'Showcase/SavedImage.png' })
      case 'export_logs':
        return success({ path: 'Showcase/ECL-logs.zip' })
      // 演示环境无实例分类功能：读返回空数组，写入视为空操作。
      // 该命令此前落入 default 返回 success()（data 为 undefined），
      // 导致调用方 merge 成 categories.value = undefined，渲染期 .find 崩溃
      case 'game_instance_categories_get':
        return success([])
      case 'game_instance_categories_upsert':
        return success()
      case 'game_instance_categories_delete':
        return success()

      /* ── 实例工作区：打开目录 / 存档 ── */
      case 'game_instance_folder_open':
        return success({ path: `Showcase/.minecraft/${String(payload.folder ?? 'instance')}` })
      case 'game_instance_mods_list':
        return success(structuredClone(showcaseInstanceMods))
      case 'game_instance_mod_toggle':
        return success({ enabled: true })
      case 'game_instance_mod_add':
        return success({ filename: 'showcase-mod.jar' })
      case 'game_instance_mod_remove':
        return success()
      case 'game_instance_mods_folder_open':
        return success({ path: 'Showcase/.minecraft/versions/mods' })
      case 'game_world_list':
        return success(structuredClone(worlds))
      case 'game_world_detail': {
        const world = worlds.find((item) => item.id === payload.world_id)
        return world ? success(structuredClone(world)) : failure('存档不存在', 'WORLD_NOT_FOUND')
      }
      case 'game_world_patch': {
        const world = worlds.find((item) => item.id === payload.world_id)
        if (!world) return failure('存档不存在', 'WORLD_NOT_FOUND')
        Object.assign(world, getPayload(payload.patch))
        return success(structuredClone(world))
      }
      case 'game_world_copy': {
        const source = worlds.find((item) => item.id === payload.world_id)
        if (source) {
          worlds.push({
            ...structuredClone(source),
            id: String(payload.new_world_id ?? `${source.id}-copy`),
            name: `${source.name} 副本`,
            path: `${source.path}-copy`,
          })
        }
        return success(demoOperation('world_copy'))
      }
      case 'game_world_delete': {
        const index = worlds.findIndex((item) => item.id === payload.world_id)
        if (index >= 0) worlds.splice(index, 1)
        return success()
      }
      case 'game_world_import': {
        const template = worlds[0] ?? showcaseWorlds[0]
        if (template) {
          worlds.push({
            ...structuredClone(template),
            id: `imported-${Date.now()}`,
            name: '导入的存档',
            path: String(payload.source_path ?? 'Showcase/.minecraft/saves/imported'),
          })
        }
        return success(demoOperation('world_import'))
      }
      case 'game_world_export':
        return success(demoOperation('world_export'))
      case 'game_world_icon_set': {
        const world = worlds.find((item) => item.id === payload.world_id)
        if (world) world.iconPath = String(payload.source_path ?? '')
        return success({ path: String(payload.source_path ?? '') })
      }

      /* ── 存档备份 ── */
      case 'game_world_backup_create': {
        const worldId = String(payload.world_id ?? '')
        const list = worldBackups.get(worldId) ?? []
        list.unshift({
          id: `backup-${Date.now()}`,
          createdAt: new Date().toISOString(),
          locked: false,
          automatic: false,
          size: 48_600_000,
        })
        worldBackups.set(worldId, list)
        return success(demoOperation('world_backup_create'))
      }
      case 'game_world_backup_list':
        return success(structuredClone(worldBackups.get(String(payload.world_id ?? '')) ?? []))
      case 'game_world_backup_restore':
        return success(demoOperation('world_backup_restore'))
      case 'game_world_backup_lock': {
        const list = worldBackups.get(String(payload.world_id ?? '')) ?? []
        const backup = list.find((item) => item.id === payload.backup_id)
        if (backup) backup.locked = Boolean(payload.locked)
        return success()
      }
      case 'game_world_backup_delete': {
        const worldId = String(payload.world_id ?? '')
        worldBackups.set(
          worldId,
          (worldBackups.get(worldId) ?? []).filter((item) => item.id !== payload.backup_id)
        )
        return success()
      }

      /* ── 截图 ── */
      case 'game_screenshot_list':
        return success(structuredClone(screenshots))
      case 'game_screenshot_thumbnail':
        return success({
          path:
            screenshots.find((item) => item.id === payload.screenshot_id)?.path ??
            'Showcase/.minecraft/screenshots/placeholder.png',
        })
      case 'game_screenshot_copy':
        return success()
      case 'game_screenshot_save_as':
        return success({ path: String(payload.output_path ?? 'Showcase/screenshot.png') })
      case 'game_screenshot_delete': {
        const index = screenshots.findIndex((item) => item.id === payload.screenshot_id)
        if (index >= 0) screenshots.splice(index, 1)
        return success()
      }
      case 'game_screenshot_set_cover':
      case 'game_screenshot_set_background':
        return success()

      /* ── 服务器列表 ── */
      case 'game_server_list':
        return success(structuredClone(servers))
      case 'game_server_upsert': {
        const id = payload.server_id ? String(payload.server_id) : `srv-${Date.now()}`
        const entry = {
          id,
          name: String(payload.name ?? '服务器'),
          address: String(payload.address ?? ''),
          icon: null,
          favorite: Boolean(payload.favorite),
          order: servers.length,
        }
        const index = servers.findIndex((item) => item.id === id)
        if (index >= 0) servers[index] = entry
        else servers.push(entry)
        return success(structuredClone(entry))
      }
      case 'game_server_delete': {
        const index = servers.findIndex((item) => item.id === payload.server_id)
        if (index >= 0) servers.splice(index, 1)
        return success()
      }
      case 'game_server_reorder':
        return success()
      case 'game_server_status_refresh': {
        const addresses = Array.isArray(payload.addresses) ? payload.addresses : []
        return success(
          addresses.map((address) => {
            const offline = String(address).startsWith('127.')
            return {
              address: String(address),
              online: !offline,
              latency: offline ? undefined : 24,
              playersOnline: offline ? undefined : 8_412,
              playersMax: offline ? undefined : 20_000,
            }
          })
        )
      }

      /* ── 实例资源（资源包 / 光影包 / 数据包 / 原理图） ── */
      case 'game_resource_list':
        return success(structuredClone(resources[String(payload.resource_type ?? '')] ?? []))
      case 'game_resource_toggle': {
        const list = resources[String(payload.resource_type ?? '')] ?? []
        const entry = list.find((item) => item.id === payload.resource_id)
        if (entry) entry.enabled = Boolean(payload.enabled)
        return success()
      }
      case 'game_resource_delete': {
        const type = String(payload.resource_type ?? '')
        const ids = new Set((Array.isArray(payload.resource_ids) ? payload.resource_ids : []).map(String))
        resources[type] = (resources[type] ?? []).filter((item) => !ids.has(item.id))
        return success()
      }
      case 'game_resource_install': {
        const type = String(payload.resource_type ?? '')
        const paths = Array.isArray(payload.source_paths) ? payload.source_paths : []
        const list = resources[type] ?? (resources[type] = [])
        paths.forEach((rawPath, offset) => {
          const raw = String(rawPath)
          const base = raw.split(/[\\/]/).pop() ?? 'resource'
          list.push({
            id: `${type}-${Date.now()}-${offset}`,
            type: type as never,
            path: raw,
            name: base.replace(/\.[^.]+$/, ''),
            enabled: true,
            size: 2_400_000,
            modifiedAt: new Date().toISOString(),
            sha512: null,
            source: 'local',
          })
        })
        return success(demoOperation('resource_install'))
      }
      case 'game_resource_update_check':
        return success([])
      case 'game_resource_update':
        return success(demoOperation('resource_update'))
      case 'game_resource_manifest_export':
        return success({ path: String(payload.output_path ?? 'Showcase/manifest.json') })
      case 'game_schematic_material_manifest_export':
        return success({ path: String(payload.output_path ?? 'Showcase/schematic-materials.json') })
      case 'game_resource_identify':
        return success({ matched: false })
      case 'game_schematic_preview':
        return success(structuredClone(showcaseSchematicPreview))
      case 'game_schematic_assets':
        return success({ blockstates: {}, models: {}, textures: {}, animated: [], missingBlocks: [] })

      /* ── 实例设置 / 资料与维护 ── */
      case 'game_options_read':
        return success({
          path: 'Showcase/.minecraft/options.txt',
          options: structuredClone(showcaseGameOptions),
          ignoredCount: 0,
        })
      case 'game_options_patch':
        return success({
          path: 'Showcase/.minecraft/options.txt',
          updated: Object.keys(getPayload(payload.patch)).length,
        })
      case 'game_version_settings_get':
        return success({})
      case 'game_version_settings_set':
        return success()
      case 'game_instance_profile_get':
        return success({ schemaVersion: 1 })
      case 'game_instance_profile_patch':
      case 'game_instance_profile_reset':
        return success()
      case 'game_instance_files_check':
        return success({ issues: [], downloadBytes: 0, canRepair: false })
      case 'game_instance_files_repair':
      case 'game_instance_clone':
      case 'game_instance_export':
      case 'game_instance_import':
        return success(demoOperation('instance_maintenance'))
      case 'game_instance_delete':
      case 'game_instance_icon_set':
      case 'game_instance_pin_order_set':
      case 'game_operation_cancel':
        return success()
      case 'game_operation_get':
        return success(demoOperation('showcase'))
      case 'game_crash_list':
        return success([])
      case 'game_fabric_api_versions':
        return success([])
      case 'game_config_get':
        return success({})
      case 'game_config_patch':
      case 'game_config_set':
        return success()

      /* ── 启动器信息 / 更新 / 进程 ── */
      case 'launcher_info':
        return success({
          version: '1.4.2-alpha.3+20260906',
          version_type: 'alpha',
          debug: true,
          active_window_chrome: 'custom',
          system_shadow_supported: false,
        })
      case 'launcher_check_update':
        return success({
          status: 'up_to_date',
          current_version: '1.4.2-alpha.3+20260906',
          channel: 'alpha',
          latest_version: null,
          latest_url: null,
          latest_notes: null,
        })
      case 'launcher_update_status':
        return success({ enabled: true })
      case 'launcher_update_download':
      case 'launcher_update_apply':
      case 'launcher_errors_ack':
        return success()
      case 'launcher_errors_pending':
        return success([])
      case 'process_instances':
        return success({ instances: [] })
      case 'process_stop':
      case 'process_input':
      case 'debug_devtools_open':
      case 'debug_process_spawn':
        return success()
      case 'logs_get_history':
        return success({ logs: [] })

      /* ── 文件 / 账户辅助 ── */
      case 'select_files':
        return success({
          paths: ['Showcase/Downloads/demo-resource.zip'],
        })
      case 'image_read_file':
        // 占位图：展示模式下所有本地图片读取均返回同一张内联 SVG
        return success({
          dataUrl:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#1f232b"/><text x="50%" y="50%" fill="#5c5c5c" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">Showcase 图片</text></svg>'
            ),
        })
      case 'image_list_files':
        return success({ files: [] })
      case 'background_video_open':
        return failure('展示模式暂不支持视频背景', 'BACKGROUND_VIDEO_SHOWCASE_UNSUPPORTED')
      case 'accounts_auth_providers':
        return success([])
      case 'accounts_default_skins':
        return success([])
      case 'accounts_authlib_login_config':
        return success({ available: false })
      case 'accounts_add_plugin':
        return success()
      case 'accounts_set_favorite':
      case 'accounts_set_pinned':
      case 'accounts_set_offline_skin':
        return success(structuredClone(accounts))
      case 'open_url':
      case 'open_folder':
      case 'open_mods_folder':
      case 'open_resourcepacks_folder':
      case 'open_saves_folder':
      case 'open_shaderpacks_folder':
        return success()
      case 'download_mod_to_path':
        return success({ filename: 'showcase-mod.jar' })
      case 'detect_modpack_type':
        return success({ type: 'unknown' })
      case 'import_modpack':
      case 'export_modpack':
        return success()
      default:
        return success()
    }
  }

  return {
    mode: 'showcase',
    available: true,
    invoke,
    async listen<T>(event: string, handler: (payload: T) => void) {
      const handlers = listeners.get(event) ?? new Set<EventHandler>()
      const trackedHandler = handler as EventHandler
      handlers.add(trackedHandler)
      listeners.set(event, handlers)
      return () => {
        handlers.delete(trackedHandler)
        if (handlers.size === 0) listeners.delete(event)
      }
    },
    convertFileSrc() {
      return null
    },
  }
}
