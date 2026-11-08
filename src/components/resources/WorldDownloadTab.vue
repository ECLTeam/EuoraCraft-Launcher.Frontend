<template>
  <section
    class="world-download-tab"
    data-drop-zone
    @dragover.prevent
    @drop.prevent="handleDrop"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
  >
    <header class="world-toolbar">
      <ResourceInstanceSelect :target="target" @persist="onInstancePersist" />
      <NButton type="primary" @click="chooseAndImport">
        <template #icon><UiIcon name="upload" :size="15" /></template>
        {{ t('download.world.importLocal') }}
      </NButton>
    </header>

    <div v-if="dragging" class="world-drop-overlay">
      <UiIcon name="download" :size="26" />
      <span>{{ t('download.world.dropHint') }}</span>
    </div>

    <p class="world-hint">{{ t('download.world.importHint') }}</p>
    <p class="world-manage-hint">{{ t('download.world.manageInVersions') }}</p>

    <NEmpty class="world-empty" :description="t('download.world.empty')">
      <template #icon><UiIcon name="globe" :size="42" /></template>
    </NEmpty>
  </section>
</template>

<script setup lang="ts">
import { NButton, NEmpty } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ResourceInstanceSelect from '@/components/resources/ResourceInstanceSelect.vue'
import { UiIcon } from '@/components/ui'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useResourceInstallTarget } from '@/composables/useResourceInstallTarget'
import { instanceWorkspaceApi } from '@/features/instances/api/instanceWorkspaceApi'
import { getErrorMessage } from '@/utils/error'

const { t } = useI18n()
const message = useLauncherMessage()

const target = useResourceInstallTarget('world')
const instance = target.selectedInstance

const dragging = ref(false)
let dragDepth = 0

function onInstancePersist(): void {
  void target.persist()
}

function handleDragEnter() {
  dragDepth += 1
  dragging.value = true
}

function handleDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

async function chooseAndImport() {
  const inst = instance.value
  if (!inst) {
    message.warning(t('mods.selectInstanceFirst'))
    return
  }
  try {
    const selected = unwrapResponse(
      await backend.command('select_file', { purpose: 'world-import' }),
      t('download.world.importLocal')
    )
    if (selected.path) await doImport(inst.path, inst.versionId, selected.path)
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}

async function handleDrop(event: DragEvent) {
  dragging.value = false
  dragDepth = 0
  const inst = instance.value
  if (!inst) {
    message.warning(t('mods.selectInstanceFirst'))
    return
  }
  const paths = [...(event.dataTransfer?.files || [])]
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
  if (!paths.length) {
    message.warning(t('download.world.dropHint'))
    return
  }
  try {
    for (const path of paths) await doImport(inst.path, inst.versionId, path)
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}

async function doImport(gamePath: string, versionId: string, sourcePath: string) {
  await instanceWorkspaceApi.importWorld({ game_path: gamePath, version_id: versionId }, sourcePath)
  message.success(t('download.world.importSuccess'))
  await target.persist()
}
</script>

<style scoped src="@/styles/views/WorldDownloadTab.css"></style>
