<template>
  <Modal
    :visible="visible"
    :title="t('versions.download.installTitle')"
    width="640px"
    wrapperClass="version-install-modal"
    bodyClass="version-install-modal-body"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="install-dialog">
      <section class="install-version-summary">
        <div class="install-version-icon">
          <img :src="versionImage || '/img/item/grass.png'" :alt="mcVersion" />
        </div>
        <div class="install-version-main">
          <span class="install-version-kicker">Minecraft</span>
          <div class="install-version-heading">
            <strong>{{ mcVersion }}</strong>
            <span>{{ versionTypeLabel }}</span>
          </div>
          <p>{{ t('versions.download.versionNameHint') }}：{{ resolvedVersionName }}</p>
        </div>
        <img class="install-chest-icon" :src="'/img/item/chest.png'" alt="" />
      </section>

      <section class="install-section">
        <div class="install-section-heading">
          <div>
            <strong>{{ t('versions.download.loaderType') }}</strong>
            <span>{{ selectedLoader?.label || t('versions.download.vanilla') }}</span>
          </div>
        </div>
        <div class="install-loader-grid">
          <button
            v-for="loaderOption in loaders"
            :key="loaderOption.value"
            type="button"
            class="install-loader-card"
            :class="{ active: loader === loaderOption.value }"
            :aria-pressed="loader === loaderOption.value"
            @click="emit('selectLoader', loaderOption.value)"
          >
            <span class="install-loader-icon">
              <img
                v-if="loaderOption.image"
                class="install-loader-image"
                :src="loaderOption.image"
                :alt="loaderOption.label"
              />
              <UiIcon v-else :name="loaderOption.icon" :size="25" />
            </span>
            <span class="install-loader-name">{{ loaderOption.label }}</span>
            <UiIcon v-if="loader === loaderOption.value" class="install-loader-check" name="check" :size="12" />
          </button>
        </div>
      </section>

      <div class="install-fields">
        <label class="install-field">
          <span>{{ t('versions.download.versionName') }}</span>
          <NInput
            :value="versionName"
            :placeholder="defaultVersionName"
            clearable
            @update:value="emit('update:versionName', $event)"
          />
          <small>{{ t('versions.download.versionNameHint') }}</small>
        </label>

        <label class="install-field">
          <span>{{ t('versions.download.gameDir') }}</span>
          <NSelect
            :value="gamePath"
            :options="gamePaths"
            :placeholder="t('instances.gamePathPlaceholder')"
            @update:value="emit('update:gamePath', String($event || ''))"
          />
        </label>

        <label v-if="loader === 'fabric'" class="install-field">
          <span>{{ t('versions.download.loaderVersion') }}</span>
          <NSelect
            :value="loaderVersion"
            filterable
            :options="loaderVersionOptions"
            :loading="loaderVersionsLoading"
            @update:value="emit('update:loaderVersion', String($event || ''))"
          />
        </label>

        <label v-if="loader === 'fabric'" class="install-field">
          <span>{{ t('versions.download.fabricApiVersion') }}</span>
          <NSelect
            :value="fabricApiVersion"
            filterable
            :options="fabricApiVersionOptions"
            :loading="fabricApiVersionsLoading"
            @update:value="emit('update:fabricApiVersion', String($event || ''))"
          />
        </label>

        <label v-else-if="loader !== 'vanilla'" class="install-field install-field-wide">
          <span>{{ t('versions.download.loaderVersion') }}</span>
          <NSelect
            :value="loaderVersion"
            filterable
            :options="loaderVersionOptions"
            :loading="loaderVersionsLoading"
            @update:value="emit('update:loaderVersion', String($event || ''))"
          />
        </label>
      </div>
    </div>

    <template #footer>
      <NButton @click="emit('update:visible', false)">
        {{ t('versions.download.cancel') }}
      </NButton>
      <NButton type="primary" :loading="isSubmittingInstall" :disabled="!mcVersion" @click="emit('install')">
        <template #icon><UiIcon name="download" :size="15" /></template>
        {{ isSubmittingInstall ? t('versions.download.installing') : t('versions.download.startInstall') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NSelect, type SelectOption } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'

export interface InstallLoaderOption {
  value: string
  label: string
  icon: string
  image?: string
}

const props = defineProps<{
  visible: boolean
  mcVersion: string
  versionTypeLabel: string
  versionImage: string
  versionName: string
  defaultVersionName: string
  loader: string
  loaderVersion: string
  loaderVersionOptions: SelectOption[]
  loaderVersionsLoading: boolean
  fabricApiVersion: string
  fabricApiVersionOptions: SelectOption[]
  fabricApiVersionsLoading: boolean
  gamePath: string
  gamePaths: SelectOption[]
  loaders: InstallLoaderOption[]
  isSubmittingInstall: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:versionName': [value: string]
  'update:loaderVersion': [value: string]
  'update:fabricApiVersion': [value: string]
  'update:gamePath': [value: string]
  selectLoader: [value: string]
  install: []
}>()

const { t } = useI18n()
const selectedLoader = computed(() => props.loaders.find((item) => item.value === props.loader))
const resolvedVersionName = computed(() => props.versionName.trim() || props.defaultVersionName)
</script>

<style scoped src="@/styles/components/instances/InstanceInstallModal.css"></style>
