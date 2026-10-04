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
              <span>{{ t('wardrobe.accountLabel') }}</span>
              <NSelect
                v-model:value="targetAccountId"
                class="wardrobe-account-select"
                size="small"
                :options="accountOptions"
                :placeholder="t('wardrobe.selectAccount')"
                clearable
              />
            </div>
            <div class="wardrobe-category-row">
              <NTabs v-if="isFolia" :value="activeTab" type="segment" size="small" @update:value="handleTabChange">
                <NTab name="skin">{{ t('wardrobe.skins') }}</NTab>
                <NTab name="cape">{{ t('wardrobe.localCapes') }}</NTab>
                <NTab name="official">{{ t('wardrobe.officialCapes') }}</NTab>
              </NTabs>
              <NButtonGroup v-else size="small">
                <NButton :type="activeTab === 'skin' ? 'primary' : 'default'" @click="activeTab = 'skin'">
                  {{ t('wardrobe.skins') }}
                </NButton>
                <NButton :type="activeTab === 'cape' ? 'primary' : 'default'" @click="activeTab = 'cape'">
                  {{ t('wardrobe.localCapes') }}
                </NButton>
                <NButton :type="activeTab === 'official' ? 'primary' : 'default'" @click="activeTab = 'official'">
                  {{ t('wardrobe.officialCapes') }}
                </NButton>
              </NButtonGroup>
              <div class="wardrobe-category-actions">
                <NButton quaternary circle size="small" :title="t('wardrobe.options')" @click="showOptionsModal = true">
                  <template #icon><UiIcon name="menu" :size="16" /></template>
                </NButton>
                <NButton
                  v-if="activeTab === 'official'"
                  quaternary
                  circle
                  size="small"
                  :title="t('wardrobe.refreshCapes')"
                  :loading="refreshingCapes"
                  @click="refreshOfficialCapes"
                >
                  <template #icon><UiIcon name="refresh" :size="16" /></template>
                </NButton>
                <NButton
                  v-if="activeTab !== 'official'"
                  size="small"
                  type="primary"
                  :loading="importing"
                  @click="importItem"
                >
                  <template #icon><UiIcon name="upload" :size="14" /></template>
                  {{ t('wardrobe.import') }}
                </NButton>
                <NButton
                  v-if="activeTab === 'skin' && canDownloadSkin"
                  quaternary
                  circle
                  size="small"
                  :title="t('wardrobe.downloadSkin')"
                  :loading="applying"
                  @click="downloadSkin"
                >
                  <template #icon><UiIcon name="file-download" :size="16" /></template>
                </NButton>
              </div>
            </div>
          </div>
          <NAlert v-if="activeTab === 'cape'" class="wardrobe-cape-notice" type="info" :showIcon="false">
            {{ t('wardrobe.localCapePreviewOnly') }}
          </NAlert>

          <UiLoading :show="loading" mode="overlay" class="wardrobe-library-content">
            <div v-if="activeTab !== 'official' && filteredItems.length" class="wardrobe-grid">
              <div
                v-for="item in filteredItems"
                :key="item.id"
                class="wardrobe-card"
                :class="{ selected: selectedLocal?.id === item.id }"
                role="button"
                tabindex="0"
                @click="selectLocal(item)"
                @keydown.enter="selectLocal(item)"
                @keydown.space.prevent="selectLocal(item)"
              >
                <img v-if="textureUrls[item.id]" :src="textureUrls[item.id]" :alt="item.name" />
                <div v-else class="wardrobe-card-placeholder"><UiIcon name="shirt" :size="28" /></div>
                <strong>{{ item.name }}</strong>
                <span>{{ item.width }}×{{ item.height }}</span>
                <NButton
                  v-if="item.kind === 'skin'"
                  class="wardrobe-favorite-button"
                  :class="{ 'wardrobe-favorite-button-active': item.favorite }"
                  quaternary
                  circle
                  size="tiny"
                  :type="item.favorite ? 'warning' : 'default'"
                  :title="item.favorite ? t('wardrobe.unfavorite') : t('wardrobe.favorite')"
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
                <div class="wardrobe-card-actions">
                  <NPopconfirm @positiveClick="deleteItem(item)">
                    <template #trigger>
                      <NButton
                        quaternary
                        circle
                        size="tiny"
                        type="error"
                        :title="t('wardrobe.delete')"
                        :loading="deletingId === item.id"
                        @click.stop
                      >
                        <template #icon><UiIcon name="delete" :size="14" /></template>
                      </NButton>
                    </template>
                    {{ t('wardrobe.deleteConfirm') }}
                  </NPopconfirm>
                  <NButton quaternary circle size="tiny" :title="t('wardrobe.edit')" @click.stop="openEditModal(item)">
                    <template #icon><UiIcon name="edit" :size="14" /></template>
                  </NButton>
                  <NButton
                    v-if="item.kind === 'skin'"
                    quaternary
                    circle
                    size="tiny"
                    :title="t('wardrobe.saveAs')"
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
                    @click.stop="openUploadModal(item)"
                  >
                    <template #icon><UiIcon name="cloud-upload" :size="14" /></template>
                  </NButton>
                </div>
              </div>
            </div>
            <div v-else-if="activeTab === 'official' && officialCapes.length" class="wardrobe-grid">
              <div
                v-for="cape in officialCapes"
                :key="cape.id"
                class="wardrobe-card"
                :class="{ selected: selectedOfficialCape?.id === cape.id }"
                role="button"
                tabindex="0"
                @click="selectOfficialCape(cape)"
                @keydown.enter="selectOfficialCape(cape)"
                @keydown.space.prevent="selectOfficialCape(cape)"
              >
                <img v-if="officialCapeUrls[cape.id]" :src="officialCapeUrls[cape.id]" :alt="cape.name || cape.id" />
                <div v-else class="wardrobe-card-placeholder"><UiIcon name="shield" :size="28" /></div>
                <strong>{{ cape.name || cape.id }}</strong>
                <NTag v-if="cape.state.toUpperCase() === 'ACTIVE'" size="small" type="success">
                  {{ t('wardrobe.active') }}
                </NTag>
                <div class="wardrobe-card-actions">
                  <NButton
                    v-if="cape.state.toUpperCase() !== 'ACTIVE'"
                    quaternary
                    circle
                    size="tiny"
                    type="primary"
                    :title="t('wardrobe.applyCape')"
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
                    :loading="applying"
                    @click.stop="resetCape"
                  >
                    <template #icon><UiIcon name="minus" :size="14" /></template>
                  </NButton>
                </div>
              </div>
            </div>
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
import { clearAvatarCache, fetchTextureDataUrl } from '@/composables/useAvatarRenderer'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { useUiSkin } from '@/composables/useUiSkin'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import SkinViewer3D from '@/features/accounts/components/SkinViewer3D.vue'
import { detectSkinModel } from '@/features/accounts/composables/useSkinModelDetector'
import { useAccountStore } from '@/features/accounts/stores/accountStore'
import type { MicrosoftCape, MinecraftAccount, SkinModel, WardrobeItem } from '@/types/accounts'

const props = defineProps<{
  visible: boolean
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
const activeTab = ref<'skin' | 'cape' | 'official'>('skin')

function handleTabChange(value: string | number) {
  if (value === 'skin' || value === 'cape' || value === 'official') activeTab.value = value
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
const accountTextureRequests = useRequestScope(() => `${props.visible}\0${targetAccountId.value}`)
const localTextureRequests = useRequestScope(() => `${props.visible}\0${targetAccountId.value}`)
const wardrobeRequests = useRequestScope(() => String(props.visible))

const accountOptions = computed(() => props.accounts.map((account) => ({ label: account.alias, value: account.id })))
const targetAccount = computed(() => props.accounts.find((account) => account.id === targetAccountId.value) ?? null)
const officialCapes = computed(() =>
  targetAccount.value?.type === 'microsoft' ? (targetAccount.value.capes ?? []) : []
)
const filteredItems = computed(() => items.value.filter((item) => item.kind === activeTab.value))
const previewSkinUrl = computed(() => selectedSkinUrl.value || accountSkinUrl.value)
const previewCapeUrl = computed(() => selectedCapeUrl.value || accountCapeUrl.value)
const previewModel = computed<SkinModel>(() =>
  selectedLocal.value?.kind === 'skin' ? (selectedLocal.value.model ?? editModel.value) : accountModel.value
)
const isStandardSkin = computed(
  () => selectedLocal.value?.kind === 'skin' && selectedLocal.value.width === 64 && selectedLocal.value.height === 64
)
const canApplySkin = computed(() => targetAccount.value?.type === 'microsoft' && isStandardSkin.value)
const canDownloadSkin = computed(() => Boolean(targetAccountId.value))
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
    const textures = await accountsApi.textureUrls(accountId)
    if (!isCurrent()) return
    const capeUrl = (await fetchTextureDataUrl(textures.capeUrl || '')) || ''
    if (!isCurrent()) return
    const capeEntries = await Promise.all(
      officialCapes.value.map(async (cape) => [cape.id, (await fetchTextureDataUrl(cape.url)) || ''] as const)
    )
    if (!isCurrent()) return
    const skinUrl = (await fetchTextureDataUrl(textures.skinUrl || '')) || ''
    if (!isCurrent()) return
    accountModel.value = textures.skinModel ?? 'classic'
    accountCapeUrl.value = capeUrl
    officialCapeUrls.value = Object.fromEntries(capeEntries)
    accountSkinUrl.value = skinUrl
  } catch (reason) {
    if (!isCurrent()) return
    message.warning(reason instanceof Error ? reason.message : t('wardrobe.textureFailed'))
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
    clearAvatarCache()
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
    clearAvatarCache()
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
      return
    }
    activeTab.value = 'skin'
    const previousAccountId = targetAccountId.value
    const defaultAccountId = props.currentAccount?.id || props.accounts[0]?.id || null
    targetAccountId.value = defaultAccountId
    await loadItems()
    if (props.visible && targetAccountId.value === defaultAccountId && previousAccountId === defaultAccountId)
      await loadTargetTextures()
  }
)

watch(targetAccountId, loadTargetTextures)

async function downloadSkin(): Promise<void> {
  if (!targetAccountId.value || !canDownloadSkin.value) return
  applying.value = true
  try {
    // 后端已按账户皮肤变体写入模型，前端不再重新检测覆盖，避免细手臂被误判为经典。
    const result = await accountsApi.syncAccountSkin(targetAccountId.value)
    const item = result.item
    items.value = [item, ...items.value.filter((candidate) => candidate.id !== item.id)]
    emit('accountsChanged')
    await loadTargetTextures()
    await selectLocal(item)
    message.success(t('wardrobe.skinDownloaded'))
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

.wardrobe-meta,
.wardrobe-card span {
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

.wardrobe-account-row,
.wardrobe-category-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-sm);
  flex-wrap: wrap;
  row-gap: var(--s-xs);
}

.wardrobe-account-row > span {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 13px;
}

.wardrobe-category-actions {
  display: flex;
  align-items: center;
  gap: var(--s-xs);
  flex-shrink: 0;
}

.wardrobe-category-row :deep(.n-tabs) {
  flex: 0 1 auto;
  min-width: 200px;
  width: auto;
  max-width: 280px;
}

.wardrobe-category-row :deep(.n-tabs-rail) {
  display: flex;
  width: 100%;
}

.wardrobe-category-row :deep(.n-tabs-tab-wrapper) {
  flex: 1;
}

.wardrobe-category-row :deep(.n-tabs-tab) {
  justify-content: center;
}

/* 深色模式：分类行选中项高可读性（实底主色 + 深色文字，兼容亮主色） */
html[data-theme='dark'] .wardrobe-category-row :deep(.n-tabs-tab.n-tabs-tab--active),
html[data-theme='dark'] .wardrobe-category-row :deep(.n-button.n-button--primary-type) {
  background-color: var(--primary) !important;
  color: var(--bg-base) !important;
  font-weight: 600;
}

.wardrobe-account-select {
  width: min(280px, 100%);
  min-width: 180px;
  flex: 1 1 220px;
}

.wardrobe-library-content {
  display: flex;
  min-height: 0;
  flex: 1;
}

.wardrobe-library-content > .wardrobe-grid {
  min-height: 0;
  flex: 1;
}

.wardrobe-empty-state {
  display: grid;
  min-height: 0;
  flex: 1;
  place-items: center;
}

.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  align-content: start;
  gap: var(--s-sm);
  overflow: auto;
}

.wardrobe-card {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-xs);
  padding: var(--s-sm) var(--s-sm) 34px;
  border: 1px solid var(--divider);
  border-radius: var(--r-md);
  color: var(--text-primary);
  background: var(--bg-card);
  cursor: pointer;
}

.wardrobe-card-actions {
  position: absolute;
  right: 6px;
  bottom: 5px;
  display: flex;
  align-items: center;
  gap: 2px;
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

.wardrobe-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.wardrobe-card img,
.wardrobe-card-placeholder {
  width: 88px;
  height: 88px;
  object-fit: contain;
  image-rendering: pixelated;
}

.wardrobe-card-placeholder {
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.wardrobe-card strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .wardrobe-category-row {
    justify-content: space-between;
  }

  .wardrobe-account-select {
    width: min(100%, 320px);
  }
}
</style>
