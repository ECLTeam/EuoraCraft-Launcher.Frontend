<template>
  <div class="littleskin-closet">
    <LittleSkinLoginPanel
      v-if="authorizing"
      :accountId="accountId"
      @completed="authorized"
      @cancel="authorizing = false"
      @busyChange="emit('busyChange', $event)"
    />
    <template v-else>
      <div class="littleskin-toolbar">
        <NTabs
          v-if="isFolia"
          class="littleskin-kind-tabs"
          :value="kind"
          type="segment"
          size="small"
          @update:value="changeKind"
        >
          <NTab
            v-for="tab in kindTabs"
            :key="tab.name"
            :name="tab.name"
            :disabled="busy"
            role="button"
            :tabindex="busy ? -1 : 0"
            :aria-disabled="busy"
            :aria-pressed="kind === tab.name"
            @keydown.enter.prevent="changeKind(tab.name)"
            @keydown.space.prevent="changeKind(tab.name)"
          >
            {{ t(tab.label) }}
          </NTab>
        </NTabs>
        <NButtonGroup v-else size="small">
          <NButton
            v-for="tab in kindTabs"
            :key="tab.name"
            :type="kind === tab.name ? 'primary' : 'default'"
            :aria-pressed="kind === tab.name"
            :disabled="busy"
            @click="changeKind(tab.name)"
          >
            {{ t(tab.label) }}
          </NButton>
        </NButtonGroup>
        <div class="littleskin-toolbar-actions">
          <NButton
            quaternary
            circle
            size="small"
            :disabled="busy || loading"
            :loading="loading"
            :title="t('littleskinManagement.refresh')"
            :aria-label="t('littleskinManagement.refresh')"
            @click="load(true)"
          >
            <template #icon><UiIcon name="refresh" :size="16" /></template>
          </NButton>
          <NDropdown
            v-if="!needsAuthorization && !errorKey"
            v-model:show="showCloudMenu"
            trigger="click"
            placement="bottom-end"
            :options="cloudMenuOptions"
            @select="selectCloudAction"
          >
            <NButton
              quaternary
              circle
              size="small"
              :loading="busy"
              :title="t('common.more')"
              :aria-label="t('common.more')"
              aria-haspopup="menu"
              :aria-expanded="showCloudMenu"
              @keydown="handleCloudMenuKeydown"
            >
              <template #icon><UiIcon name="menu" :size="16" /></template>
            </NButton>
          </NDropdown>
        </div>
      </div>
      <NAlert v-if="needsAuthorization" type="warning" :showIcon="false">
        <p>{{ t('littleskinManagement.authorizationRequired') }}</p>
        <NButton size="small" @click="authorizing = true">{{ t('littleskinManagement.authorize') }}</NButton>
      </NAlert>
      <NAlert v-else-if="errorKey" type="error" :showIcon="false">{{ t(errorKey) }}</NAlert>
      <UiLoading v-else :show="loading" mode="overlay" class="littleskin-library-content">
        <WardrobeGrid v-if="closet?.data.length">
          <WardrobeCard
            v-for="item in closet.data"
            :key="item.tid"
            :name="item.name"
            :imageUrl="thumbnailUrls[item.tid]"
            :placeholder="item.type === 'cape' ? 'shield' : 'shirt'"
            :detail="t(textureDetailLabel(item))"
            :selected="selected?.tid === item.tid"
            :disabled="busy"
            @select="preview(item)"
          >
            <template v-if="currentTid === item.tid" #status>
              <NTag size="small" type="success" :title="t(textureDetailLabel(item))">{{ t('wardrobe.active') }}</NTag>
            </template>
            <template #actions>
              <NButton
                quaternary
                circle
                size="tiny"
                type="primary"
                :disabled="busy || currentTid === item.tid"
                :title="t('littleskinManagement.wear')"
                :aria-label="t('littleskinManagement.wear')"
                @click="apply(item.tid)"
              >
                <template #icon><UiIcon name="check" :size="14" /></template>
              </NButton>
              <NButton
                quaternary
                circle
                size="tiny"
                :disabled="busy"
                :title="t('littleskinManagement.download')"
                :aria-label="t('littleskinManagement.download')"
                @click="download(item)"
              >
                <template #icon><UiIcon name="file-download" :size="14" /></template>
              </NButton>
            </template>
          </WardrobeCard>
        </WardrobeGrid>
        <div v-else-if="closet" class="littleskin-empty">
          <NEmpty :description="t('littleskinManagement.empty')" />
        </div>
        <div v-if="closet && closet.last_page > 1" class="littleskin-pagination">
          <NButton size="small" :disabled="busy || page <= 1" @click="changePage(page - 1)">
            {{ t('littleskinManagement.previous') }}
          </NButton>
          <span>{{ t('littleskinManagement.page', { current: page, total: closet.last_page }) }}</span>
          <NButton size="small" :disabled="busy || page >= closet.last_page" @click="changePage(page + 1)">
            {{ t('littleskinManagement.next') }}
          </NButton>
        </div>
      </UiLoading>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NDropdown, NEmpty, NTab, NTabs, NTag } from 'naive-ui'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { fetchTextureDataUrl } from '@/composables/useAvatarRenderer'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { useUiSkin } from '@/composables/useUiSkin'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import {
  invalidateLittleSkinWardrobe,
  isLittleSkinAuthorizationError,
  isLittleSkinWardrobeCached,
} from '@/features/accounts/api/littleSkinWardrobeCache'
import LittleSkinLoginPanel from '@/features/accounts/components/LittleSkinLoginPanel.vue'
import WardrobeCard from '@/features/accounts/components/WardrobeCard.vue'
import WardrobeGrid from '@/features/accounts/components/WardrobeGrid.vue'
import type {
  AccountTextures,
  LittleSkinClosetPage,
  LittleSkinPlayer,
  LittleSkinTexture,
  WardrobeKind,
} from '@/types/accounts'

const props = defineProps<{ accountId: string }>()
const emit = defineEmits<{
  preview: [textures: AccountTextures]
  changed: []
  downloaded: []
  busyChange: [busy: boolean]
}>()
const { t } = useI18n()
const message = useLauncherMessage()
const { isFolia } = useUiSkin()
const kindTabs = [
  { name: 'skin', label: 'wardrobe.skins' },
  { name: 'cape', label: 'littleskinManagement.capes' },
]
const kind = ref<WardrobeKind>('skin')
const page = ref(1)
const closet = ref<LittleSkinClosetPage | null>(null)
const player = ref<LittleSkinPlayer | null>(null)
const selected = ref<LittleSkinTexture | null>(null)
const loading = ref(false)
const busy = ref(false)
const authorizing = ref(false)
const needsAuthorization = ref(false)
const errorKey = ref('')
const currentTid = computed(() => (kind.value === 'skin' ? player.value?.tid_skin : player.value?.tid_cape))
const showCloudMenu = ref(false)
const canManageCurrent = computed(() => !busy.value && !loading.value && Boolean(currentTid.value))
const cloudMenuOptions = computed(() => [
  { key: 'download', label: t('littleskinManagement.downloadCurrent'), disabled: !canManageCurrent.value },
  {
    key: 'reset',
    label: t(kind.value === 'skin' ? 'littleskinManagement.resetSkin' : 'littleskinManagement.removeCape'),
    disabled: !canManageCurrent.value,
  },
])
const thumbnailUrls = ref<Record<number, string>>({})
const thumbnailRequests = useRequestScope(() => `${props.accountId}:${kind.value}:${page.value}`)
let generation = 0
let disposed = false

function textureUrl(item: LittleSkinTexture): string {
  return `https://littleskin.cn/textures/${item.hash}`
}

function textureDetailLabel(item: LittleSkinTexture): string {
  if (item.type === 'cape') return 'littleskinManagement.capes'
  return item.type === 'alex' ? 'wardrobe.slim' : 'wardrobe.classic'
}

async function loadThumbnails(items: LittleSkinTexture[]): Promise<void> {
  const isCurrent = thumbnailRequests.begin()
  const pendingItems = items.values()
  await Promise.all(
    Array.from({ length: Math.min(items.length, 4) }, async () => {
      for (const item of pendingItems) {
        if (!isCurrent()) return
        const url = await fetchTextureDataUrl(textureUrl(item))
        if (isCurrent() && url) thumbnailUrls.value[item.tid] = url
      }
    })
  )
}

function failure(reason: unknown): void {
  const code = reason instanceof BackendCommandError ? reason.errorCode : ''
  if (isLittleSkinAuthorizationError(reason)) {
    needsAuthorization.value = true
    closet.value = null
    return
  }
  const keys: Record<string, string> = {
    LITTLESKIN_RATE_LIMITED: 'rateLimited',
    LITTLESKIN_ACCOUNT_MISMATCH: 'accountMismatch',
    LITTLESKIN_TEXTURE_UNAVAILABLE: 'textureUnavailable',
    LITTLESKIN_WRITE_UNCONFIRMED: 'unconfirmed',
    LITTLESKIN_CLOSET_LIMIT: 'closetLimit',
  }
  errorKey.value = `littleskinManagement.${keys[code ?? ''] ?? 'failed'}`
}

async function load(force = false): Promise<void> {
  const current = ++generation
  const accountId = props.accountId
  const requestedKind = kind.value
  const requestedPage = page.value
  thumbnailRequests.invalidate()
  thumbnailUrls.value = {}
  closet.value = null
  player.value = null
  selected.value = null
  showCloudMenu.value = false
  emit('preview', {})
  errorKey.value = ''
  needsAuthorization.value = false
  loading.value = force || !isLittleSkinWardrobeCached(accountId, requestedKind, requestedPage)
  try {
    if (force) await invalidateLittleSkinWardrobe(accountId)
    if (disposed || current !== generation) return
    const management = await accountsApi.littleSkinManagement(accountId)
    if (disposed || current !== generation) return
    needsAuthorization.value = management.needs_authorization
    player.value = management.player
    if (management.needs_authorization) return
    const result = await accountsApi.littleSkinCloset(accountId, requestedKind, requestedPage)
    if (disposed || current !== generation) return
    closet.value = result
    void loadThumbnails(result.data)
  } catch (reason) {
    if (!disposed && current === generation) failure(reason)
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}

function selectCloudAction(key: string | number): void {
  if (!canManageCurrent.value) return
  if (key === 'download') void download()
  if (key === 'reset') void apply()
}

function handleCloudMenuKeydown(event: KeyboardEvent): void {
  if (!showCloudMenu.value) return
  if (event.key === 'Tab') showCloudMenu.value = false
  if (event.key !== 'Escape') return
  event.preventDefault()
  showCloudMenu.value = false
}

function changeKind(value: string | number): void {
  if ((value !== 'skin' && value !== 'cape') || busy.value || kind.value === value) return
  kind.value = value
  page.value = 1
  void load()
}
function changePage(value: number): void {
  page.value = value
  void load()
}
async function preview(item: LittleSkinTexture): Promise<void> {
  const current = ++generation
  selected.value = item
  try {
    const url = await fetchTextureDataUrl(textureUrl(item))
    if (disposed || current !== generation) return
    if (!url) throw new Error('Texture unavailable')
    emit(
      'preview',
      item.type === 'cape' ? { capeUrl: url } : { skinUrl: url, skinModel: item.type === 'alex' ? 'slim' : 'classic' }
    )
  } catch {
    if (disposed || current !== generation) return
    emit('preview', {})
    message.error(t('wardrobe.textureFailed'))
  }
}
async function apply(tid?: number): Promise<void> {
  if (busy.value || loading.value) return
  busy.value = true
  errorKey.value = ''
  const current = ++generation
  try {
    const updated = await accountsApi.setLittleSkinTexture(props.accountId, kind.value, tid)
    emit('changed')
    if (disposed || current !== generation) return
    player.value = updated
    selected.value = null
    emit('preview', {})
    message.success(t('littleskinManagement.updated'))
  } catch (reason) {
    if (!disposed && current === generation) failure(reason)
  } finally {
    if (!disposed && current === generation) busy.value = false
  }
}
async function download(item?: LittleSkinTexture): Promise<void> {
  if (busy.value || loading.value) return
  busy.value = true
  const current = ++generation
  try {
    if (item) await accountsApi.importLittleSkinTexture(props.accountId, kind.value, item.tid)
    else await accountsApi.syncAccountTexture(props.accountId, kind.value)
    emit('downloaded')
    if (!disposed && current === generation) message.success(t('littleskinManagement.downloaded'))
  } catch (reason) {
    if (!disposed && current === generation) failure(reason)
  } finally {
    if (!disposed && current === generation) busy.value = false
  }
}
function authorized(): void {
  authorizing.value = false
  void load()
}
watch(busy, (value) => emit('busyChange', value))
watch(
  () => props.accountId,
  () => {
    page.value = 1
    void load()
  },
  { immediate: true }
)
onScopeDispose(() => {
  disposed = true
  generation += 1
  emit('busyChange', false)
})
</script>

<style scoped>
.littleskin-closet,
.littleskin-library-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  gap: var(--s-sm);
}

.littleskin-toolbar,
.littleskin-toolbar-actions,
.littleskin-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-xs);
}

.littleskin-toolbar {
  justify-content: space-between;
}

.littleskin-toolbar-actions {
  margin-inline-start: auto;
}

.littleskin-kind-tabs {
  width: auto;
  flex: 0 1 auto;
}

.littleskin-kind-tabs :deep(.n-tabs-tab:focus-visible) {
  outline: 2px solid var(--ecl-primary);
  outline-offset: -2px;
}

.littleskin-kind-tabs :deep(.n-tabs-tab--active .n-tabs-tab__label) {
  color: var(--ecl-text);
}

.littleskin-pagination {
  justify-content: center;
  color: var(--text-secondary);
}

.littleskin-empty {
  display: grid;
  flex: 1;
  place-items: center;
}
</style>
