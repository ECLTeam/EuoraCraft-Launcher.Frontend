<template>
  <div class="info-card profile-card">
    <div class="info-card__header">
      <span>{{ t('profile.personalize') }}</span>
    </div>
    <div class="profile-form-grid">
      <label
        ><span>{{ t('profile.alias') }}</span
        ><NInput v-model:value="profileForm.alias" maxlength="120" /><small>{{
          t('profile.diskDirectory', { directory: version?.versionId })
        }}</small></label
      >
      <label
        ><span>{{ t('profile.category') }}</span
        ><NSelect v-model:value="profileForm.categoryId" :options="categoryOptions"
      /></label>
      <label class="profile-form-wide"
        ><span>{{ t('profile.description') }}</span
        ><NInput
          v-model:value="profileForm.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 5 }"
          maxlength="1000"
      /></label>
      <label class="profile-form-wide"
        ><span>{{ t('profile.tags') }}</span
        ><NInput v-model:value="profileForm.tagsText" :placeholder="t('profile.tagsHint')"
      /></label>
      <label
        ><span>{{ t('profile.source') }}</span
        ><NSelect v-model:value="profileForm.preferredExternalSource" :options="sourceOptions"
      /></label>
      <div class="profile-switches">
        <span><NSwitch v-model:value="profileForm.favorite" />{{ t('profile.favorite') }}</span>
        <span><NSwitch v-model:value="profileForm.pinned" />{{ t('profile.pinned') }}</span>
        <span><NSwitch v-model:value="profileForm.hidden" />{{ t('profile.hidden') }}</span>
      </div>
    </div>
  </div>
  <div class="info-card">
    <div class="info-card__header">{{ t('profile.origins') }}</div>
    <div class="field-source-list">
      <div v-for="field in profileFields" :key="field">
        <span>{{ profileFieldLabel(field) }}</span
        ><code>{{ version?.fieldSources?.[field] || 'auto' }}</code
        ><NButton
          v-if="version?.profileOverrides?.includes(field)"
          size="tiny"
          quaternary
          @click="resetProfileField(field)"
          >{{ t('profile.restore') }}</NButton
        >
      </div>
    </div>
    <p v-for="warning in version?.sourceWarnings || []" :key="warning" class="source-warning">
      {{ warning }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NSelect, NSwitch } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { instanceProfileApi, targetFromVersion } from '@/features/instances/api/instanceProfileApi'
import { profileSaveSession, type InstanceProfileForm } from '@/features/instances/model/instanceSaveSession'
import type { InstanceCategory, InstanceExternalSource, ScannedVersion } from '@/types/instances'

defineOptions({ name: 'InstanceDetailProfileTab' })

const props = defineProps<{
  version: ScannedVersion | null
  visible: boolean
}>()

const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()
const message = useLauncherMessage()

const categories = ref<InstanceCategory[]>([])
const profileSaving = ref(false)
const profileForm = reactive<InstanceProfileForm>({
  alias: '',
  description: '',
  favorite: false,
  pinned: false,
  hidden: false,
  categoryId: 'unclassified',
  tagsText: '',
  preferredExternalSource: 'auto' as InstanceExternalSource,
})
const categoryOptions = computed(() =>
  categories.value.map((category) => ({ label: category.name, value: category.id }))
)
const sourceOptions = computed(() => {
  const descriptors = props.version?.externalSourceOptions || [
    { source: 'pcl', title: 'PCL / PCL-CE', plugin: 'builtin' },
    { source: 'hmcl', title: 'HMCL', plugin: 'builtin' },
  ]
  const options = [
    { label: '自动（最新来源）', value: 'auto' },
    ...descriptors.map((source) => ({ label: source.title, value: source.source })),
  ]
  const preferred = profileForm.preferredExternalSource
  if (preferred !== 'auto' && !options.some((option) => option.value === preferred)) {
    options.push({ label: `${preferred}（当前不可用）`, value: preferred })
  }
  return options
})
const profileFields = ['alias', 'description', 'favorite', 'pinned', 'hidden', 'categoryId', 'tags', 'icon']

function loadProfileForm() {
  const version = props.version
  if (!version) return
  skipProfileWatch = true
  Object.assign(profileForm, {
    alias: version.displayName || version.versionId,
    description: version.description || '',
    favorite: Boolean(version.favorite),
    pinned: Boolean(version.pinned),
    hidden: Boolean(version.hidden),
    categoryId: version.categoryId || 'unclassified',
    tagsText: (version.tags || []).join(', '),
    preferredExternalSource: version.preferredExternalSource || 'auto',
  })
  loadedProfileVersion = version
  savedProfileSnapshot.value = JSON.stringify(profileForm)
  const pendingDraft = profileSaveSession.draft(instanceKey(version))
  if (pendingDraft) Object.assign(profileForm, pendingDraft)
  void nextTick(() => {
    skipProfileWatch = false
  })
}

/** 个性化表单自动保存：防抖 + 串行化（参考设置 tab） */
let skipProfileWatch = false
let profileSaveTimer: ReturnType<typeof setTimeout> | null = null
let loadedProfileVersion: ScannedVersion | null = null
let latestProfileSave: Promise<void> | null = null
const savedProfileSnapshot = ref('')

function profilePayload(form: InstanceProfileForm) {
  return {
    alias: form.alias,
    description: form.description,
    favorite: form.favorite,
    pinned: form.pinned,
    hidden: form.hidden,
    categoryId: form.categoryId,
    tags: form.tagsText
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    preferredExternalSource: form.preferredExternalSource,
  }
}

async function persistProfile() {
  const version = loadedProfileVersion
  if (!version) return
  const form = { ...profileForm }
  const snapshot = JSON.stringify(form)
  const key = instanceKey(version)
  const target = targetFromVersion(version)
  profileSaving.value = true
  const queued = profileSaveSession.enqueue(key, form, async (submitted) => {
    const payload = profilePayload(submitted)
    await instanceProfileApi.patch(target, payload)
    Object.assign(version, payload, { displayName: submitted.alias })
  })
  latestProfileSave = queued
  try {
    await queued
    if (loadedProfileVersion === version) savedProfileSnapshot.value = snapshot
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.profileSaveFailed'))
  } finally {
    if (latestProfileSave === queued) profileSaving.value = false
  }
}

function scheduleProfileSave(delay = 300) {
  if (profileSaveTimer) clearTimeout(profileSaveTimer)
  profileSaveTimer = setTimeout(() => {
    profileSaveTimer = null
    void persistProfile()
  }, delay)
}

function flushProfileSave() {
  if (profileSaveTimer) {
    clearTimeout(profileSaveTimer)
    profileSaveTimer = null
  }
  if (JSON.stringify(profileForm) !== savedProfileSnapshot.value) void persistProfile()
}

async function resetProfileField(field: string) {
  const version = props.version
  if (!version) return
  await instanceProfileApi.reset(targetFromVersion(version), [field])
  emit('updated')
}

function profileFieldLabel(field: string): string {
  return (
    {
      alias: t('profile.aliasLabel'),
      description: t('profile.description'),
      favorite: t('profile.favorite'),
      pinned: t('profile.pinned'),
      hidden: t('profile.hidden'),
      categoryId: t('profile.category'),
      tags: t('profile.tagsLabel'),
      icon: t('profile.icon'),
    }[field] || field
  )
}

// 打开时加载表单与分类；关闭时 flush 挂起中的自动保存（复刻原父组件行为）
watch(
  () => [props.visible, props.version?.path, props.version?.versionId] as const,
  ([visible]) => {
    flushProfileSave()
    if (visible) {
      loadProfileForm()
      void instanceProfileApi.categories().then((items) => (categories.value = items))
    }
  },
  { immediate: true }
)

// 个性化表单：修改即自动保存（300ms 防抖）
watch(
  profileForm,
  () => {
    if (skipProfileWatch) return
    scheduleProfileSave()
  },
  { deep: true }
)

// 切换到其他 tab / 组件卸载时，同样 flush 挂起中的自动保存
onBeforeUnmount(() => {
  if (profileSaveTimer) clearTimeout(profileSaveTimer)
  if (JSON.stringify(profileForm) !== savedProfileSnapshot.value) void persistProfile()
})
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>
