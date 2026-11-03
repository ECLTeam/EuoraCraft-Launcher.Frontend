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
        <NButtonGroup size="small">
          <NButton :type="kind === 'skin' ? 'primary' : 'default'" :disabled="busy" @click="changeKind('skin')">{{
            t('wardrobe.skins')
          }}</NButton>
          <NButton :type="kind === 'cape' ? 'primary' : 'default'" :disabled="busy" @click="changeKind('cape')">{{
            t('littleskinManagement.capes')
          }}</NButton>
        </NButtonGroup>
        <NButton size="small" :disabled="busy" :loading="loading" @click="load">{{
          t('littleskinManagement.refresh')
        }}</NButton>
      </div>
      <NAlert v-if="needsAuthorization" type="warning" :showIcon="false">
        <p>{{ t('littleskinManagement.authorizationRequired') }}</p>
        <NButton size="small" @click="authorizing = true">{{ t('littleskinManagement.authorize') }}</NButton>
      </NAlert>
      <NAlert v-if="errorKey" type="error" :showIcon="false">{{ t(errorKey) }}</NAlert>
      <UiLoading :show="loading" mode="overlay">
        <template v-if="!needsAuthorization && !errorKey">
          <div class="littleskin-toolbar">
            <NButton size="small" :disabled="busy || !currentTid" @click="downloadCurrent">{{
              t('littleskinManagement.downloadCurrent')
            }}</NButton>
            <NButton size="small" :disabled="busy || !currentTid" @click="apply()">{{
              t(kind === 'skin' ? 'littleskinManagement.resetSkin' : 'littleskinManagement.removeCape')
            }}</NButton>
          </div>
          <div v-if="closet?.data.length" class="littleskin-grid">
            <div
              v-for="item in closet.data"
              :key="item.tid"
              class="littleskin-item ecl-surface"
              :class="{ selected: selected?.tid === item.tid }"
            >
              <NButton quaternary :disabled="busy" :title="item.name" @click="preview(item)">{{ item.name }}</NButton>
              <NTag v-if="currentTid === item.tid" size="small" type="success">{{ t('wardrobe.active') }}</NTag>
              <span>{{
                t(
                  item.type === 'alex'
                    ? 'wardrobe.slim'
                    : item.type === 'steve'
                      ? 'wardrobe.classic'
                      : 'littleskinManagement.capes'
                )
              }}</span>
              <div class="littleskin-toolbar">
                <NButton size="small" :disabled="busy || currentTid === item.tid" @click="apply(item.tid)">{{
                  t('littleskinManagement.wear')
                }}</NButton>
                <NButton size="small" :disabled="busy" @click="download(item)">{{
                  t('littleskinManagement.download')
                }}</NButton>
              </div>
            </div>
          </div>
          <NEmpty v-else-if="!loading" :description="t('littleskinManagement.empty')" />
          <div v-if="closet && closet.last_page > 1" class="littleskin-toolbar">
            <NButton size="small" :disabled="loading || busy || page <= 1" @click="changePage(page - 1)">{{
              t('littleskinManagement.previous')
            }}</NButton>
            <span>{{ t('littleskinManagement.page', { current: page, total: closet.last_page }) }}</span>
            <NButton
              size="small"
              :disabled="loading || busy || page >= closet.last_page"
              @click="changePage(page + 1)"
              >{{ t('littleskinManagement.next') }}</NButton
            >
          </div>
        </template>
      </UiLoading>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NEmpty, NTag } from 'naive-ui'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import UiLoading from '@/components/ui/Loading.vue'
import { fetchTextureDataUrl } from '@/composables/useAvatarRenderer'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import LittleSkinLoginPanel from '@/features/accounts/components/LittleSkinLoginPanel.vue'
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
let generation = 0
let disposed = false

function failure(reason: unknown): void {
  const code = reason instanceof BackendCommandError ? reason.errorCode : ''
  if (code === 'LITTLESKIN_PERMISSION_REQUIRED' || code === 'LITTLESKIN_AUTH_REQUIRED') {
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

async function load(): Promise<void> {
  const current = ++generation
  const accountId = props.accountId
  closet.value = null
  selected.value = null
  errorKey.value = ''
  needsAuthorization.value = false
  loading.value = true
  try {
    const management = await accountsApi.littleSkinManagement(accountId)
    if (disposed || current !== generation) return
    needsAuthorization.value = management.needs_authorization
    player.value = management.player
    if (management.needs_authorization) return
    const result = await accountsApi.littleSkinCloset(accountId, kind.value, page.value)
    if (!disposed && current === generation) closet.value = result
  } catch (reason) {
    if (!disposed && current === generation) failure(reason)
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}

function changeKind(value: WardrobeKind): void {
  if (busy.value || kind.value === value) return
  kind.value = value
  page.value = 1
  emit('preview', {})
  void load()
}
function changePage(value: number): void {
  page.value = value
  emit('preview', {})
  void load()
}
async function preview(item: LittleSkinTexture): Promise<void> {
  const current = ++generation
  selected.value = item
  try {
    const url = await fetchTextureDataUrl(`https://littleskin.cn/textures/${item.hash}`)
    if (disposed || current !== generation) return
    if (!url) throw new Error('Texture unavailable')
    emit(
      'preview',
      item.type === 'cape' ? { capeUrl: url } : { skinUrl: url, skinModel: item.type === 'alex' ? 'slim' : 'classic' }
    )
  } catch (reason) {
    if (!disposed && current === generation) failure(reason)
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
function downloadCurrent(): void {
  void download()
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
    emit('preview', {})
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
.littleskin-closet {
  display: flex;
  flex-direction: column;
  gap: var(--s-md);
}
.littleskin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-sm);
}
.littleskin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--s-md);
}
.littleskin-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s-sm);
  min-width: 0;
  padding: var(--s-md);
}
.littleskin-item.selected {
  outline: 1px solid var(--ecl-primary);
}
.littleskin-item :deep(.n-button__content) {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
