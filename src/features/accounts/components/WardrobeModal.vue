<template>
  <FullscreenModal
    :visible="visible"
    :title="t('wardrobe.title')"
    :showFooter="false"
    bodyClass="wardrobe-modal-body"
    @update:visible="handleVisibleChange"
    @close="emit('back')"
  >
    <div class="wardrobe-page">
      <main class="wardrobe-content">
        <section class="wardrobe-library ecl-surface">
          <div class="wardrobe-toolbar">
            <div class="wardrobe-account-row">
              <div class="wardrobe-account-picker">
                <span>{{ t('wardrobe.accountLabel') }}</span>
                <NSelect
                  v-model:value="targetAccountId"
                  class="wardrobe-account-select"
                  size="small"
                  :options="accountOptions"
                  :disabled="cloudBusy"
                  :placeholder="t('wardrobe.selectAccount')"
                  :aria-label="t('wardrobe.accountLabel')"
                  :title="targetAccount?.alias"
                  clearable
                />
              </div>
              <div class="wardrobe-account-actions">
                <NButton
                  v-if="activeTab === 'official'"
                  quaternary
                  circle
                  size="small"
                  :title="t('wardrobe.refreshCapes')"
                  :aria-label="t('wardrobe.refreshCapes')"
                  :loading="refreshingCapes"
                  @click="refreshOfficialCapes"
                >
                  <template #icon><UiIcon name="refresh" :size="16" /></template>
                </NButton>
                <NButton v-if="isLocalTab" size="small" type="primary" :loading="importing" @click="importItem">
                  <template #icon><UiIcon name="upload" :size="14" /></template>
                  {{ t('wardrobe.import') }}
                </NButton>
                <NDropdown
                  v-model:show="showWardrobeMenu"
                  trigger="click"
                  placement="bottom-end"
                  :options="wardrobeMenuOptions"
                  @select="selectWardrobeAction"
                >
                  <NButton
                    quaternary
                    circle
                    size="small"
                    :loading="isLocalTab && applying"
                    :title="t('common.more')"
                    :aria-label="t('common.more')"
                    aria-haspopup="menu"
                    :aria-expanded="showWardrobeMenu"
                    @keydown="handleWardrobeMenuKeydown"
                  >
                    <template #icon><UiIcon name="menu" :size="16" /></template>
                  </NButton>
                </NDropdown>
              </div>
            </div>
            <div class="wardrobe-category-row">
              <NTabs v-if="isFolia" :value="activeTab" type="segment" size="small" @update:value="handleTabChange">
                <NTab
                  v-for="tab in wardrobeTabs"
                  :key="tab.name"
                  :name="tab.name"
                  role="button"
                  tabindex="0"
                  :aria-pressed="activeTab === tab.name"
                  @keydown.enter.prevent="handleTabChange(tab.name)"
                  @keydown.space.prevent="handleTabChange(tab.name)"
                >
                  {{ t(tab.label) }}
                </NTab>
              </NTabs>
              <NButtonGroup v-else size="small">
                <NButton
                  v-for="tab in wardrobeTabs"
                  :key="tab.name"
                  :type="activeTab === tab.name ? 'primary' : 'default'"
                  :aria-pressed="activeTab === tab.name"
                  @click="handleTabChange(tab.name)"
                >
                  {{ t(tab.label) }}
                </NButton>
              </NButtonGroup>
            </div>
          </div>
          <NAlert v-if="activeTab === 'cape'" class="wardrobe-cape-notice" type="info" :showIcon="false">
            {{ t('wardrobe.localCapePreviewOnly') }}
          </NAlert>

          <UiLoading :show="loading && activeTab !== 'cloud'" mode="overlay" class="wardrobe-library-content">
            <LittleSkinClosetPanel
              v-if="visible && activeTab === 'cloud' && isLittleSkin && targetAccountId"
              :key="targetAccountId"
              :accountId="targetAccountId"
              @preview="cloudPreview = $event"
              @changed="handleCloudChanged"
              @downloaded="loadItems"
              @busyChange="cloudBusy = $event"
            />
            <WardrobeGrid v-else-if="activeTab !== 'official' && filteredItems.length">
              <WardrobeCard
                v-for="item in filteredItems"
                :key="item.id"
                :name="item.name"
                :imageUrl="textureUrls[item.id]"
                placeholder="shirt"
                :detail="`${item.width}×${item.height}`"
                :selected="selectedLocal?.id === item.id"
                @select="selectLocal(item)"
              >
                <template #accessory>
                  <NButton
                    v-if="item.kind === 'skin'"
                    class="wardrobe-favorite-button"
                    :class="{ 'wardrobe-favorite-button-active': item.favorite }"
                    quaternary
                    circle
                    size="tiny"
                    :type="item.favorite ? 'warning' : 'default'"
                    :title="item.favorite ? t('wardrobe.unfavorite') : t('wardrobe.favorite')"
                    :aria-label="item.favorite ? t('wardrobe.unfavorite') : t('wardrobe.favorite')"
                    @click.stop="toggleFavorite(item)"
                  >
                    <template #icon>
                      <UiIcon
                        :class="{ 'wardrobe-favorite-icon-active': item.favorite }"
                        :name="item.favorite ? 'star-filled' : 'star'"
                        :size="14"
                        :style="item.favorite ? { color: '#f5b301' } : {}"
                      />
                    </template>
                  </NButton>
                </template>
                <template #actions>
                  <NPopconfirm @positiveClick="deleteItem(item)">
                    <template #trigger>
                      <NButton
                        quaternary
                        circle
                        size="tiny"
                        type="error"
                        :title="t('wardrobe.delete')"
                        :aria-label="t('wardrobe.delete')"
                        :loading="deletingId === item.id"
                        @click.stop
                      >
                        <template #icon><UiIcon name="delete" :size="14" /></template>
                      </NButton>
                    </template>
                    {{ t('wardrobe.deleteConfirm') }}
                  </NPopconfirm>
                  <NButton
                    quaternary
                    circle
                    size="tiny"
                    :title="t('wardrobe.edit')"
                    :aria-label="t('wardrobe.edit')"
                    @click.stop="openEditModal(item)"
                  >
                    <template #icon><UiIcon name="edit" :size="14" /></template>
                  </NButton>
                  <NButton
                    quaternary
                    circle
                    size="tiny"
                    :title="t('wardrobe.saveAs')"
                    :aria-label="t('wardrobe.saveAs')"
                    @click.stop="exportItem(item)"
                  >
                    <template #icon><UiIcon name="file-download" :size="14" /></template>
                  </NButton>
                  <NButton
                    v-if="item.kind === 'skin'"
                    quaternary
                    circle
                    size="tiny"
                    type="primary"
                    :title="t('wardrobe.applySkin')"
                    :aria-label="t('wardrobe.applySkin')"
                    @click.stop="openUploadModal(item)"
                  >
                    <template #icon><UiIcon name="cloud-upload" :size="14" /></template>
                  </NButton>
                </template>
              </WardrobeCard>
            </WardrobeGrid>
            <WardrobeGrid v-else-if="activeTab === 'official' && officialCapes.length">
              <WardrobeCard
                v-for="cape in officialCapes"
                :key="cape.id"
                :name="cape.name || cape.id"
                :imageUrl="officialCapeUrls[cape.id]"
                placeholder="shield"
                :selected="selectedOfficialCape?.id === cape.id"
                @select="selectOfficialCape(cape)"
              >
                <template v-if="cape.state.toUpperCase() === 'ACTIVE'" #status>
                  <NTag size="small" type="success">
                    {{ t('wardrobe.active') }}
                  </NTag>
                </template>
                <template #actions>
                  <NButton
                    v-if="cape.state.toUpperCase() !== 'ACTIVE'"
                    quaternary
                    circle
                    size="tiny"
                    type="primary"
                    :title="t('wardrobe.applyCape')"
                    :aria-label="t('wardrobe.applyCape')"
                    :loading="applying"
                    @click.stop="applyCapeItem(cape)"
                  >
                    <template #icon><UiIcon name="check" :size="14" /></template>
                  </NButton>
                  <NButton
                    v-else
                    quaternary
                    circle
                    size="tiny"
                    :title="t('wardrobe.removeCape')"
                    :aria-label="t('wardrobe.removeCape')"
                    :loading="applying"
                    @click.stop="resetCape"
                  >
                    <template #icon><UiIcon name="minus" :size="14" /></template>
                  </NButton>
                </template>
              </WardrobeCard>
            </WardrobeGrid>
            <div v-else class="wardrobe-empty-state">
              <NEmpty class="wardrobe-empty" :description="emptyDescription" />
            </div>
          </UiLoading>
        </section>

        <section class="wardrobe-preview ecl-surface">
          <div class="wardrobe-preview-options">
            <span class="wardrobe-preview-label">{{ t('wardrobe.skinRendering') }}</span>
            <div class="wardrobe-preview-toggles">
              <NCheckbox v-model:checked="showElytra" size="small">{{ t('wardrobe.showElytra') }}</NCheckbox>
              <NCheckbox v-model:checked="showNameTag" size="small">{{ t('wardrobe.showNameTag') }}</NCheckbox>
            </div>
          </div>
          <SkinViewer3D
            :skinUrl="previewSkinUrl"
            :capeUrl="previewCapeUrl"
            :model="previewModel"
            :elytra="showElytra"
            :nameTag="showNameTag ? (targetAccount?.alias ?? '') : ''"
          />
        </section>
      </main>
    </div>

    <Modal v-model:visible="showEditModal" :title="t('wardrobe.editTitle')" width="440px">
      <div v-if="selectedLocal" class="wardrobe-dialog-form">
        <NInput v-model:value="editName" :placeholder="t('wardrobe.name')" maxlength="80" />
        <NSelect v-if="selectedLocal.kind === 'skin'" v-model:value="editModel" :options="modelOptions" />
        <div class="wardrobe-meta">
          <span>{{ selectedLocal.width }}×{{ selectedLocal.height }}</span>
          <span>{{ formatBytes(selectedLocal.byteSize) }}</span>
        </div>
        <NAlert v-if="selectedLocal.kind === 'cape'" type="info" :showIcon="false">
          {{ t('wardrobe.localCapePreviewOnly') }}
        </NAlert>
      </div>
      <template #footer>
        <NButton @click="showEditModal = false">{{ t('modal.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="saveSelected">{{ t('wardrobe.save') }}</NButton>
      </template>
    </Modal>

    <Modal v-model:visible="showUploadModal" :title="t('wardrobe.uploadTitle')" width="460px">
      <div v-if="selectedLocal" class="wardrobe-dialog-form">
        <div class="wardrobe-upload-item">
          <img v-if="textureUrls[selectedLocal.id]" :src="textureUrls[selectedLocal.id]" :alt="selectedLocal.name" />
          <div>
            <strong>{{ selectedLocal.name }}</strong>
            <span>{{ selectedLocal.width }}×{{ selectedLocal.height }}</span>
          </div>
        </div>
        <NSelect v-model:value="targetAccountId" :options="accountOptions" :placeholder="t('wardrobe.selectAccount')" />
        <NAlert v-if="!canApplySkin" type="warning" :showIcon="false">
          {{ t('wardrobe.standardOnly') }}
        </NAlert>
      </div>
      <template #footer>
        <NButton @click="showUploadModal = false">{{ t('modal.cancel') }}</NButton>
        <NButton type="primary" :loading="applying" :disabled="!canApplySkin" @click="applySkin">
          {{ t('wardrobe.applySkin') }}
        </NButton>
      </template>
    </Modal>

    <Modal v-model:visible="showOptionsModal" :title="t('wardrobe.options')" width="420px">
      <div class="wardrobe-dialog-form">
        <NButton
          v-if="targetAccount?.type === 'microsoft'"
          block
          :disabled="!targetAccountId"
          :loading="applying"
          @click="resetSkin"
        >
          {{ t('wardrobe.resetSkin') }}
        </NButton>
        <NAlert type="info" :showIcon="false">{{ t('wardrobe.customCapeUnsupported') }}</NAlert>
      </div>
      <template #footer>
        <NButton @click="showOptionsModal = false">{{ t('common.close') }}</NButton>
      </template>
    </Modal>
  </FullscreenModal>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCheckbox,
  NDropdown,
  NEmpty,
  NInput,
  NPopconfirm,
  NSelect,
  NTab,
  NTabs,
  NTag,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import {
  fetchAccountTextures,
  fetchAccountTextureDataUrl,
  fetchTextureDataUrl,
  getAvatarRevision,
} from '@/composables/useAvatarRenderer'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { useUiSkin } from '@/composables/useUiSkin'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import LittleSkinClosetPanel from '@/features/accounts/components/LittleSkinClosetPanel.vue'
import SkinViewer3D from '@/features/accounts/components/SkinViewer3D.vue'
import WardrobeCard from '@/features/accounts/components/WardrobeCard.vue'
import WardrobeGrid from '@/features/accounts/components/WardrobeGrid.vue'
import { detectSkinModel } from '@/features/accounts/composables/useSkinModelDetector'
import { useAccountStore } from '@/features/accounts/stores/accountStore'
import type { AccountTextures, MicrosoftCape, MinecraftAccount, SkinModel, WardrobeItem } from '@/types/accounts'

const props = defineProps<{
  visible: boolean
  initialAccountId?: string
  accounts: MinecraftAccount[]
  currentAccount: MinecraftAccount | null
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'back'): void
  (event: 'accountsChanged'): void
}>()

const { t } = useI18n()
const message = useLauncherMessage()
const { isFolia } = useUiSkin()
const accountStore = useAccountStore()
const items = ref<WardrobeItem[]>([])
const textureUrls = ref<Record<string, string>>({})
const officialCapeUrls = ref<Record<string, string>>({})
const activeTab = ref<'skin' | 'cape' | 'official' | 'cloud'>('skin')
const cloudBusy = ref(false)
const cloudUpdatePending = ref(false)
const cloudPreview = ref<AccountTextures>({})
const isLittleSkin = computed(() => targetAccount.value?.auth_provider === 'littleskin')
const wardrobeTabs = computed(() => {
  const tabs = [
    { name: 'skin', label: 'wardrobe.skins' },
    { name: 'cape', label: 'wardrobe.localCapes' },
    { name: 'official', label: 'wardrobe.officialCapes' },
  ]
  if (isLittleSkin.value) tabs.unshift({ name: 'cloud', label: 'littleskinManagement.cloud' })
  return tabs
})

function handleTabChange(value: string | number) {
  if (value === 'skin' || value === 'cape' || value === 'official' || (value === 'cloud' && isLittleSkin.value))
    activeTab.value = value
}

const selectedLocal = ref<WardrobeItem | null>(null)
const selectedOfficialCape = ref<MicrosoftCape | null>(null)
const selectedSkinUrl = ref('')
const selectedCapeUrl = ref('')
const accountSkinUrl = ref('')
const accountCapeUrl = ref('')
const accountModel = ref<SkinModel>('classic')
const targetAccountId = ref<string | null>(null)
const editName = ref('')
const editModel = ref<SkinModel>('classic')
const showElytra = ref(false)
const showNameTag = ref(false)
const loading = ref(false)
const importing = ref(false)
const saving = ref(false)
const deletingId = ref('')
const applying = ref(false)
const refreshingCapes = ref(false)
const showEditModal = ref(false)
const showUploadModal = ref(false)
const showOptionsModal = ref(false)
const showWardrobeMenu = ref(false)
const targetTextureRevision = computed(() => getAvatarRevision(targetAccountId.value || ''))
const accountTextureRequests = useRequestScope(
  () => `${props.visible}\0${targetAccountId.value}\0${targetTextureRevision.value}`
)
const localTextureRequests = useRequestScope(() => `${props.visible}\0${targetAccountId.value}`)
const wardrobeRequests = useRequestScope(() => String(props.visible))

const accountOptions = computed(() => props.accounts.map((account) => ({ label: account.alias, value: account.id })))
const targetAccount = computed(() => props.accounts.find((account) => account.id === targetAccountId.value) ?? null)
const officialCapes = computed(() =>
  targetAccount.value?.type === 'microsoft' ? (targetAccount.value.capes ?? []) : []
)
const filteredItems = computed(() => items.value.filter((item) => item.kind === activeTab.value))
const previewSkinUrl = computed(() => cloudPreview.value.skinUrl || selectedSkinUrl.value || accountSkinUrl.value)
const previewCapeUrl = computed(() => cloudPreview.value.capeUrl || selectedCapeUrl.value || accountCapeUrl.value)
const previewModel = computed<SkinModel>(
  () =>
    cloudPreview.value.skinModel ??
    (selectedLocal.value?.kind === 'skin' ? (selectedLocal.value.model ?? editModel.value) : accountModel.value)
)
const isStandardSkin = computed(
  () => selectedLocal.value?.kind === 'skin' && selectedLocal.value.width === 64 && selectedLocal.value.height === 64
)
const canApplySkin = computed(() => targetAccount.value?.type === 'microsoft' && isStandardSkin.value)
const isLocalTab = computed(() => activeTab.value === 'skin' || activeTab.value === 'cape')
const wardrobeMenuOptions = computed(() => [
  { key: 'options', label: t('wardrobe.options') },
  ...(isLocalTab.value
    ? [
        {
          key: 'download',
          label: t('littleskinManagement.downloadCurrent'),
          disabled: !targetAccountId.value || applying.value,
        },
      ]
    : []),
])

function selectWardrobeAction(key: string | number): void {
  if (key === 'options') showOptionsModal.value = true
  if (key === 'download' && isLocalTab.value) void downloadSkin()
}

function handleWardrobeMenuKeydown(event: KeyboardEvent): void {
  if (!showWardrobeMenu.value) return
  if (event.key === 'Tab') showWardrobeMenu.value = false
  if (event.key !== 'Escape') return
  event.preventDefault()
  showWardrobeMenu.value = false
}
const modelOptions = computed(() => [
  { label: t('wardrobe.classic'), value: 'classic' },
  { label: t('wardrobe.slim'), value: 'slim' },
])
const emptyDescription = computed(() =>
  activeTab.value === 'official' ? t('wardrobe.noOfficialCapes') : t('wardrobe.empty')
)

function handleVisibleChange(value: boolean): void {
  emit('update:visible', value)
}

async function loadItems(): Promise<void> {
  const isCurrent = wardrobeRequests.begin()
  loading.value = true
  try {
    const loadedItems = await accountsApi.listWardrobe()
    const entries = await Promise.all(
      loadedItems.map(async (item) => [item.id, await accountsApi.wardrobeTexture(item.id)] as const)
    )
    if (!isCurrent()) return
    items.value = loadedItems
    textureUrls.value = Object.fromEntries(entries)
  } catch (reason) {
    if (isCurrent()) message.error(reason instanceof Error ? reason.message : t('wardrobe.loadFailed'))
  } finally {
    if (isCurrent()) loading.value = false
  }
}

async function loadLocalTexture(item: WardrobeItem): Promise<string> {
  if (!textureUrls.value[item.id]) textureUrls.value[item.id] = await accountsApi.wardrobeTexture(item.id)
  return textureUrls.value[item.id] ?? ''
}

async function loadTargetTextures(): Promise<void> {
  if (!props.visible) return
  const accountId = targetAccountId.value
  const afterCloudWrite = cloudUpdatePending.value
  const isCurrent = accountTextureRequests.begin()
  localTextureRequests.invalidate()
  accountSkinUrl.value = ''
  accountCapeUrl.value = ''
  selectedSkinUrl.value = ''
  selectedCapeUrl.value = ''
  selectedLocal.value = null
  selectedOfficialCape.value = null
  officialCapeUrls.value = {}
  if (!accountId) return
  try {
    const textures = await fetchAccountTextures(accountId)
    if (!isCurrent()) return
    const capeUrl = (await fetchAccountTextureDataUrl(accountId, textures.capeUrl || '')) || ''
    if (!isCurrent()) return
    const capeEntries = await Promise.all(
      officialCapes.value.map(async (cape) => [cape.id, (await fetchTextureDataUrl(cape.url)) || ''] as const)
    )
    if (!isCurrent()) return
    const skinUrl = (await fetchAccountTextureDataUrl(accountId, textures.skinUrl || '')) || ''
    if (!isCurrent()) return
    accountModel.value = textures.skinModel ?? 'classic'
    accountCapeUrl.value = capeUrl
    officialCapeUrls.value = Object.fromEntries(capeEntries)
    accountSkinUrl.value = skinUrl
  } catch (reason) {
    if (!isCurrent()) return
    message.warning(
      afterCloudWrite
        ? t('littleskinManagement.updatedRefreshFailed')
        : reason instanceof Error
          ? reason.message
          : t('wardrobe.textureFailed')
    )
  }
}

async function selectLocal(item: WardrobeItem): Promise<void> {
  const isCurrent = localTextureRequests.begin()
  selectedLocal.value = item
  selectedOfficialCape.value = null
  editName.value = item.name
  editModel.value = item.model ?? 'classic'
  if (item.kind === 'skin') selectedSkinUrl.value = ''
  else selectedCapeUrl.value = ''
  try {
    const texture = await loadLocalTexture(item)
    if (!isCurrent()) return
    if (item.kind === 'skin') selectedSkinUrl.value = texture
    else selectedCapeUrl.value = texture
  } catch (reason) {
    if (isCurrent()) message.warning(reason instanceof Error ? reason.message : t('wardrobe.textureFailed'))
  }
}

async function selectOfficialCape(cape: MicrosoftCape): Promise<void> {
  const isCurrent = localTextureRequests.begin()
  selectedOfficialCape.value = cape
  selectedLocal.value = null
  selectedCapeUrl.value = ''
  try {
    const texture = officialCapeUrls.value[cape.id] || ((await fetchTextureDataUrl(cape.url)) ?? '')
    if (isCurrent()) selectedCapeUrl.value = texture
  } catch (reason) {
    if (isCurrent()) message.warning(reason instanceof Error ? reason.message : t('wardrobe.textureFailed'))
  }
}

async function importItem(): Promise<void> {
  const kind = activeTab.value === 'cape' ? 'cape' : 'skin'
  importing.value = true
  try {
    const path = await accountsApi.selectWardrobeImage(kind)
    if (!path) return
    let model: SkinModel | undefined
    if (kind === 'skin') {
      try {
        const dataUrl = await backend.file.toUrl(path)
        model = dataUrl ? await detectSkinModel(dataUrl) : 'classic'
      } catch {
        model = 'classic'
      }
    }
    const result = await accountsApi.importWardrobe(path, kind, model)
    await loadItems()
    const item = items.value.find((candidate) => candidate.id === result.item.id) ?? result.item
    await selectLocal(item)
    message.success(result.deduplicated ? t('wardrobe.duplicate') : t('wardrobe.imported'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.importFailed'))
  } finally {
    importing.value = false
  }
}

async function openEditModal(item: WardrobeItem): Promise<void> {
  await selectLocal(item)
  showEditModal.value = true
}

async function openUploadModal(item: WardrobeItem): Promise<void> {
  await selectLocal(item)
  showUploadModal.value = true
}

async function saveSelected(): Promise<boolean> {
  if (!selectedLocal.value) return false
  saving.value = true
  try {
    const updated = await accountsApi.updateWardrobe(
      selectedLocal.value.id,
      editName.value,
      selectedLocal.value.kind === 'skin' ? editModel.value : undefined
    )
    items.value = items.value.map((item) => (item.id === updated.id ? updated : item))
    selectedLocal.value = updated
    showEditModal.value = false
    message.success(t('wardrobe.saved'))
    return true
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function deleteItem(item: WardrobeItem): Promise<void> {
  deletingId.value = item.id
  try {
    const id = item.id
    await accountsApi.deleteWardrobe(id)
    items.value = items.value.filter((item) => item.id !== id)
    delete textureUrls.value[id]
    if (selectedLocal.value?.id === id) {
      selectedLocal.value = null
      if (item.kind === 'skin') selectedSkinUrl.value = ''
      else selectedCapeUrl.value = ''
    }
    message.success(t('wardrobe.deleted'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.deleteFailed'))
  } finally {
    deletingId.value = ''
  }
}

async function toggleFavorite(item: WardrobeItem): Promise<void> {
  try {
    const updated = await accountsApi.updateWardrobe(item.id, undefined, undefined, !item.favorite)
    items.value = items.value
      .map((candidate) => (candidate.id === updated.id ? updated : candidate))
      .sort(
        (left, right) => Number(right.favorite) - Number(left.favorite) || right.updatedAt.localeCompare(left.updatedAt)
      )
    if (selectedLocal.value?.id === updated.id) selectedLocal.value = updated
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.favoriteFailed'))
  }
}

async function exportItem(item: WardrobeItem): Promise<void> {
  try {
    const path = await accountsApi.exportWardrobe(item.id)
    if (path) message.success(t('wardrobe.exported'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.exportFailed'))
  }
}

async function applySkin(): Promise<void> {
  if (!selectedLocal.value || !targetAccountId.value) return
  applying.value = true
  try {
    await accountsApi.applyWardrobeSkin(selectedLocal.value.id, targetAccountId.value)
    emit('accountsChanged')
    await loadTargetTextures()
    showUploadModal.value = false
    message.success(t('wardrobe.skinApplied'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.applyFailed'))
  } finally {
    applying.value = false
  }
}

async function resetSkin(): Promise<void> {
  if (!targetAccountId.value || targetAccount.value?.type !== 'microsoft') return
  applying.value = true
  try {
    await accountsApi.resetMicrosoftSkin(targetAccountId.value)
    selectedSkinUrl.value = ''
    emit('accountsChanged')
    await loadTargetTextures()
    showOptionsModal.value = false
    message.success(t('wardrobe.skinReset'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.applyFailed'))
  } finally {
    applying.value = false
  }
}

async function applyCape(): Promise<void> {
  if (!targetAccountId.value || !selectedOfficialCape.value) return
  applying.value = true
  try {
    await accountsApi.setMicrosoftCape(targetAccountId.value, selectedOfficialCape.value.id)
    emit('accountsChanged')
    await loadTargetTextures()
    message.success(t('wardrobe.capeApplied'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.applyFailed'))
  } finally {
    applying.value = false
  }
}

async function applyCapeItem(cape: MicrosoftCape): Promise<void> {
  await selectOfficialCape(cape)
  await applyCape()
}

async function resetCape(): Promise<void> {
  if (!targetAccountId.value) return
  applying.value = true
  try {
    await accountsApi.resetMicrosoftCape(targetAccountId.value)
    selectedCapeUrl.value = ''
    emit('accountsChanged')
    await loadTargetTextures()
    message.success(t('wardrobe.capeRemoved'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.applyFailed'))
  } finally {
    applying.value = false
  }
}

async function refreshOfficialCapes(): Promise<void> {
  if (!targetAccountId.value) return
  refreshingCapes.value = true
  try {
    await accountsApi.refresh(targetAccountId.value)
    await accountStore.load()
    await loadTargetTextures()
    message.success(t('wardrobe.capesRefreshed'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.refreshFailed'))
  } finally {
    refreshingCapes.value = false
  }
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      loading.value = false
      showEditModal.value = false
      showUploadModal.value = false
      showOptionsModal.value = false
      showWardrobeMenu.value = false
      return
    }
    activeTab.value = 'skin'
    const previousAccountId = targetAccountId.value
    const defaultAccountId = props.initialAccountId || props.currentAccount?.id || props.accounts[0]?.id || null
    targetAccountId.value = defaultAccountId
    if (props.accounts.find((account) => account.id === defaultAccountId)?.auth_provider === 'littleskin')
      activeTab.value = 'cloud'
    await loadItems()
    if (props.visible && targetAccountId.value === defaultAccountId && previousAccountId === defaultAccountId)
      await loadTargetTextures()
  }
)

watch([targetAccountId, targetTextureRevision], loadTargetTextures)
watch([targetAccountId, activeTab], () => {
  showWardrobeMenu.value = false
  cloudPreview.value = {}
  if (activeTab.value === 'cloud' && !isLittleSkin.value) activeTab.value = 'skin'
})
async function handleCloudChanged(): Promise<void> {
  emit('accountsChanged')
  cloudUpdatePending.value = true
  try {
    await loadTargetTextures()
  } finally {
    cloudUpdatePending.value = false
  }
}

async function downloadSkin(): Promise<void> {
  if (!targetAccountId.value || applying.value) return
  applying.value = true
  try {
    // 后端已按账户皮肤变体写入模型，前端不再重新检测覆盖，避免细手臂被误判为经典。
    const result = await accountsApi.syncAccountTexture(
      targetAccountId.value,
      activeTab.value === 'cape' ? 'cape' : 'skin'
    )
    const item = result.item
    items.value = [item, ...items.value.filter((candidate) => candidate.id !== item.id)]
    emit('accountsChanged')
    await loadTargetTextures()
    await selectLocal(item)
    message.success(t('littleskinManagement.downloaded'))
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : t('wardrobe.applyFailed'))
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.wardrobe-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--s-md);
}

.wardrobe-meta {
  color: var(--text-secondary);
  font-size: 12px;
}

.wardrobe-content {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(360px, 1fr);
  gap: var(--s-md);
}

.wardrobe-library,
.wardrobe-preview {
  min-height: 0;
  border-radius: var(--r-lg);
  overflow: hidden;
}

.wardrobe-library {
  display: flex;
  flex-direction: column;
  padding: var(--s-md);
}

.wardrobe-toolbar {
  display: flex;
  align-items: stretch;
  flex-direction: column;
  gap: var(--s-sm);
  margin-bottom: var(--s-md);
}

.wardrobe-account-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-xs) var(--s-sm);
}

.wardrobe-account-picker {
  display: flex;
  align-items: center;
  flex: 1 1 0;
  min-width: min(220px, 100%);
  gap: var(--s-sm);
}

.wardrobe-account-picker > span {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 13px;
}

.wardrobe-account-actions {
  display: flex;
  align-items: center;
  gap: var(--s-xs);
  flex-shrink: 0;
  margin-inline-start: auto;
}

.wardrobe-category-row {
  display: flex;
  min-width: 0;
}

.wardrobe-category-row :deep(.n-button-group) {
  max-width: 100%;
  flex-wrap: wrap;
  row-gap: var(--s-xs);
}

.wardrobe-category-row :deep(.n-tabs) {
  flex: 0 1 auto;
  min-width: 200px;
  width: auto;
  max-width: 100%;
}

.wardrobe-category-row :deep(.n-tabs-rail) {
  display: flex;
  width: 100%;
}

.wardrobe-category-row :deep(.n-tabs-tab-wrapper) {
  flex: 1 1 auto;
  min-width: min-content;
}

.wardrobe-category-row :deep(.n-tabs-tab) {
  justify-content: center;
  white-space: normal;
  text-align: center;
}

.wardrobe-category-row :deep(.n-tabs-tab:focus-visible) {
  outline: 2px solid var(--ecl-primary);
  outline-offset: -2px;
}

html[data-theme='light'] .wardrobe-category-row :deep(.n-tabs-tab--active .n-tabs-tab__label) {
  color: var(--ecl-text);
}

/* 深色模式：分类行选中项高可读性（实底主色 + 深色文字，兼容亮主色） */
html[data-theme='dark'] .wardrobe-category-row :deep(.n-tabs-tab.n-tabs-tab--active),
html[data-theme='dark'] .wardrobe-category-row :deep(.n-button.n-button--primary-type) {
  background-color: var(--primary) !important;
  color: var(--bg-base) !important;
  font-weight: 600;
}

.wardrobe-account-select {
  min-width: 0;
  flex: 1;
}

.wardrobe-library-content {
  display: flex;
  min-height: 0;
  flex: 1;
}

.wardrobe-empty-state {
  display: grid;
  min-height: 0;
  flex: 1;
  place-items: center;
}

.wardrobe-favorite-button {
  position: absolute;
  top: 5px;
  right: 6px;
}

.wardrobe-favorite-icon-active {
  color: #f5b301 !important;
}

.wardrobe-favorite-button-active {
  --n-text-color: #f5b301 !important;
  --n-text-color-hover: #ffc928 !important;
  --n-text-color-pressed: #d99e00 !important;
}

.wardrobe-favorite-icon-active :deep(svg),
.wardrobe-favorite-icon-active :deep(path) {
  color: #f5b301 !important;
  fill: #f5b301 !important;
}

.wardrobe-preview {
  display: flex;
  flex-direction: column;
  gap: var(--s-xs);
  padding: var(--s-sm);
}

.wardrobe-preview-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}

.wardrobe-preview-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.wardrobe-preview-toggles {
  display: flex;
  align-items: center;
  gap: var(--s-md);
}

.wardrobe-dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--s-md);
}

.wardrobe-meta {
  display: flex;
  justify-content: space-between;
}

.wardrobe-upload-item {
  display: flex;
  align-items: center;
  gap: var(--s-md);
}

.wardrobe-upload-item img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
}

.wardrobe-upload-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--s-xs);
}

.wardrobe-upload-item span {
  color: var(--text-secondary);
  font-size: 12px;
}

.wardrobe-empty {
  margin: 0;
}

@media (max-width: 1100px) {
  .wardrobe-content {
    grid-template-columns: minmax(300px, 1fr) minmax(280px, 1fr);
  }
}

@media (max-width: 820px) {
  .wardrobe-content {
    grid-template-columns: 1fr;
  }

  .wardrobe-preview {
    min-height: 360px;
  }
}
</style>
