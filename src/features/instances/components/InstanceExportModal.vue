<template>
  <FullscreenModal
    :visible="store.visible"
    :title="t('instanceExport.title')"
    :closable="!store.isSubmitting"
    :showFooter="false"
    @update:visible="store.close()"
  >
    <div class="export-shell">
      <header class="export-heading">
        <div>
          <strong>{{ store.displayName }}</strong>
          <p>{{ t('instanceExport.subtitle') }}</p>
        </div>
        <NButton quaternary circle :disabled="store.isSubmitting" :aria-label="t('common.close')" @click="store.close()"
          ><UiIcon name="close" :size="18"
        /></NButton>
      </header>
      <NAlert v-if="store.error" type="error" :showIcon="true">{{ store.error }}</NAlert>
      <section v-if="store.exportOperationId" class="export-result export-card" aria-live="polite">
        <UiIcon name="archive" :size="28" />
        <h3>{{ t(`instanceExport.status.${store.exportOperation?.status || 'pending'}`) }}</h3>
        <UiProgress
          v-if="store.isExporting"
          :percentage="store.exportOperation?.percent || 0"
          :processing="store.exportOperation?.status === 'pending'"
          showIndicator
        />
        <p v-if="store.exportOperation?.message">{{ store.exportOperation.message }}</p>
        <NAlert v-if="store.exportOperation?.error" type="error">{{ store.exportOperation.error }}</NAlert>
        <NAlert v-if="store.exportOperation?.status === 'completed' && !store.result" type="error">{{
          t('instanceExport.invalidResponse')
        }}</NAlert>
        <p v-if="store.isExporting" class="export-note">{{ t('instanceExport.backgroundHint') }}</p>
        <p v-if="store.exportOperation?.cancellationRequested" class="export-note">
          {{ t('instanceExport.cancelRequested') }}
        </p>
        <template v-if="store.result">
          <NInput :value="store.result.path" readonly :inputProps="{ 'aria-label': t('instanceExport.output') }" />
          <p>
            {{
              t('instanceExport.resultCounts', { online: store.result.onlineFiles, packed: store.result.packedFiles })
            }}
          </p>
          <NAlert v-if="store.result.warnings.length" type="warning"
            ><ul>
              <li v-for="(warning, index) in store.result.warnings" :key="index">{{ warning }}</li>
            </ul></NAlert
          >
        </template>
        <NAlert v-if="operations.queryErrors[store.exportOperationId]" type="warning">
          {{ operations.queryErrors[store.exportOperationId] }}
          <NButton size="small" @click="operations.refresh(store.exportOperationId)">{{ t('common.refresh') }}</NButton>
        </NAlert>
      </section>
      <template v-else-if="store.preview">
        <section class="export-card export-metadata">
          <div class="export-fields">
            <label
              ><span>{{ t('instanceExport.name') }}</span
              ><NInput
                v-model:value="store.packName"
                :maxlength="100"
                :disabled="store.isSubmitting"
                :inputProps="{ 'aria-label': t('instanceExport.name') }"
            /></label>
            <label
              ><span>{{ t('instanceExport.version') }}</span
              ><NInput
                v-model:value="store.packVersion"
                :maxlength="100"
                :disabled="store.isSubmitting"
                :inputProps="{ 'aria-label': t('instanceExport.version') }"
            /></label>
            <label
              ><span>{{ t('instanceExport.summary') }}</span
              ><NInput
                v-model:value="store.summary"
                :maxlength="2000"
                :disabled="store.isSubmitting"
                :inputProps="{ 'aria-label': t('instanceExport.summary') }"
            /></label>
          </div>
          <p class="export-dependencies">
            <span v-for="(version, dependency) in store.preview.dependencies" :key="dependency"
              >{{ dependency }} {{ version }}</span
            ><span>{{ t(store.preview.isolated ? 'instanceExport.isolated' : 'instanceExport.shared') }}</span>
          </p>
          <div class="export-mode">
            <label>{{ t('instanceExport.resourceMode') }}</label
            ><NSelect
              v-model:value="store.resourceMode"
              :options="resourceModeOptions"
              :disabled="store.isSubmitting"
              :aria-label="t('instanceExport.resourceMode')"
            />
          </div>
          <p class="export-note">
            {{
              t(store.resourceMode === 'references' ? 'instanceExport.referencesHint' : 'instanceExport.bundledHint')
            }}
          </p>
        </section>
        <section class="export-card export-files">
          <div class="export-file-toolbar">
            <NInput
              v-model:value="store.search"
              clearable
              :placeholder="t('instanceExport.search')"
              :inputProps="{ 'aria-label': t('instanceExport.search') }"
            />
            <NButton size="small" :disabled="store.isSubmitting" @click="store.selectAll('all')">{{
              t('instanceExport.selectAll')
            }}</NButton>
            <NButton size="small" :disabled="store.isSubmitting" @click="store.selectAll('none')">{{
              t('instanceExport.selectNone')
            }}</NButton>
            <NButton size="small" :disabled="store.isSubmitting" @click="store.selectAll('recommended')">{{
              t('instanceExport.recommended')
            }}</NButton>
          </div>
          <div class="export-categories">
            <NCheckbox
              v-for="category in categoryChoices"
              :key="category.id"
              :checked="category.selected === category.total"
              :indeterminate="category.selected > 0 && category.selected < category.total"
              :disabled="store.isSubmitting"
              @update:checked="store.selectCategory(category.id, $event)"
              >{{ t(`instanceExport.categories.${category.id}`) }} ({{ category.selected }}/{{
                category.total
              }})</NCheckbox
            >
          </div>
          <p class="export-note">{{ t('instanceExport.excludedHint') }} {{ t('instanceExport.modsHint') }}</p>
          <div class="export-tree">
            <NTree
              v-if="tree.length"
              :data="tree"
              :checkedKeys="store.selectedFileIds"
              :defaultExpandedKeys="tree.map((node) => node.key)"
              :pattern="store.search"
              :filter="filterTree"
              :renderLabel="renderTreeLabel"
              :disabled="store.isSubmitting"
              checkable
              cascade
              blockLine
              virtualScroll
              checkStrategy="child"
              style="height: 100%"
              @update:checkedKeys="store.setSelection"
            />
            <div v-else class="export-empty">{{ t('instanceExport.noFiles') }}</div>
          </div>
        </section>
        <NAlert v-if="store.hasPersonalFiles" type="warning" :showIcon="true">{{
          t('instanceExport.personalHint')
        }}</NAlert>
      </template>
      <section v-else class="export-card export-preparing" aria-live="polite">
        <template v-if="store.isPreparing"
          ><UiLoading mode="inline" size="md" :label="t('instanceExport.scanning')" />
          <p>{{ store.scanOperation?.message }}</p></template
        >
        <NButton v-else @click="store.scan()">{{ t('common.retry') }}</NButton>
        <NAlert v-if="operations.queryErrors[store.scanOperationId]" type="warning"
          >{{ operations.queryErrors[store.scanOperationId]
          }}<NButton size="small" @click="operations.refresh(store.scanOperationId)">{{
            t('common.refresh')
          }}</NButton></NAlert
        >
      </section>
      <footer class="export-footer">
        <div class="export-note">
          <template v-if="store.preview && !store.exportOperationId"
            >{{
              t('instanceExport.selected', {
                count: store.selectedFileIds.length,
                size: formatFileSize(store.selectedBytes),
              })
            }}<span v-if="!store.selectedFileIds.length"> · {{ t('instanceExport.dependenciesOnly') }}</span></template
          >
        </div>
        <NButton v-if="store.exportOperationId && !store.isExporting" @click="store.scan()">{{
          t('instanceExport.newExport')
        }}</NButton>
        <NButton
          v-if="store.isExporting"
          :disabled="store.exportOperation?.canCancel === false || store.exportOperation?.cancellationRequested"
          :loading="operations.cancellingOperations.includes(store.exportOperationId)"
          @click="store.cancelExport()"
          >{{ t('instanceExport.cancelExport') }}</NButton
        >
        <NButton
          v-if="store.preview && !store.exportOperationId"
          :disabled="store.isSubmitting"
          @click="store.scan()"
          >{{ t('common.refresh') }}</NButton
        >
        <NButton
          v-if="!store.exportOperationId"
          type="primary"
          :disabled="!store.canExport"
          :loading="store.isSubmitting"
          @click="store.submit()"
          >{{ t('instanceExport.title') }}</NButton
        >
        <NButton v-else @click="store.close()">{{ t('common.close') }}</NButton>
      </footer>
    </div>
  </FullscreenModal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCheckbox, NInput, NSelect, NTree, type TreeOption } from 'naive-ui'
import { computed, h, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiProgress from '@/components/ui/Progress.vue'
import { useInstanceExportStore } from '@/features/instances/stores/instanceExportStore'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { exportCategories } from '@/types/instanceExport'
import { formatFileSize } from '@/utils/format'

interface ExportTreeNode extends TreeOption {
  key: string
  relativePath: string
  children?: ExportTreeNode[]
}
const { t } = useI18n()
const store = useInstanceExportStore()
const operations = useApplicationOperationStore()
const resourceModeOptions = computed(() =>
  ['references', 'bundled'].map((value) => ({ value, label: t(`instanceExport.${value}`) }))
)
const categoryChoices = computed(() => {
  const selected = new Set(store.selectedFileIds)
  return exportCategories
    .map((id) => {
      const files = store.preview?.files.filter((file) => file.category === id) ?? []
      return { id, total: files.length, selected: files.filter((file) => selected.has(file.fileId)).length }
    })
    .filter((category) => category.total > 0)
})
const tree = computed<ExportTreeNode[]>(() => {
  const roots: ExportTreeNode[] = []
  const directories = new Map<string, ExportTreeNode>()
  for (const category of exportCategories) {
    const files = store.preview?.files.filter((file) => file.category === category) ?? []
    if (!files.length) continue
    const root: ExportTreeNode = {
      key: `category:${category}`,
      label: t(`instanceExport.categories.${category}`),
      relativePath: '',
      children: [],
    }
    roots.push(root)
    for (const file of files) {
      const parts = file.path.split('/')
      let parent = root
      for (let index = 0; index < parts.length - 1; index++) {
        const path = parts.slice(0, index + 1).join('/')
        const key = `directory:${category}:${path}`
        let directory = directories.get(key)
        if (!directory) {
          directory = {
            key,
            label: parts[index],
            relativePath: path,
            children: [],
            prefix: () => h(UiIcon, { name: 'folder', size: 15 }),
          }
          directories.set(key, directory)
          parent.children?.push(directory)
        }
        parent = directory
      }
      parent.children?.push({
        key: file.fileId,
        label: parts.at(-1) ?? file.path,
        relativePath: file.path,
        isLeaf: true,
        prefix: () => h(UiIcon, { name: 'file-text', size: 15 }),
        suffix: () => h('span', { class: 'export-file-size' }, formatFileSize(file.size)),
      })
    }
  }
  return roots
})
function filterTree(pattern: string, option: TreeOption): boolean {
  return String(option.relativePath || option.label || '')
    .toLocaleLowerCase()
    .includes(pattern.toLocaleLowerCase())
}
function renderTreeLabel({ option }: { option: TreeOption }) {
  return h(
    'span',
    { title: String(option.relativePath || option.label || ''), class: 'export-tree-label' },
    String(option.label ?? '')
  )
}
onBeforeUnmount(() => store.detach())
</script>

<style scoped src="@/styles/features/instances/InstanceExportModal.css"></style>
