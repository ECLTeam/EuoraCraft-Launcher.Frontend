<template>
  <Modal v-model:visible="visible" title="管理实例分类" width="520px">
    <div class="category-manager">
      <div class="category-list">
        <div v-for="category in categories" :key="category.id" class="category-row">
          <i :style="{ backgroundColor: category.color }" />
          <span>{{ category.name }}</span>
          <small>{{ category.builtin ? '内置' : '自定义' }}</small>
          <button v-if="!category.builtin" @click="editCategory(category)"><UiIcon name="edit" :size="13" /></button>
          <button v-if="!category.builtin" class="danger" @click="deleteCategory(category)">
            <UiIcon name="trash" :size="13" />
          </button>
        </div>
      </div>
      <div class="category-form">
        <strong>{{ editingId ? '编辑分类' : '新建分类' }}</strong>
        <input v-model="name" maxlength="40" placeholder="分类名称" />
        <input v-model="color" type="color" title="分类颜色" />
        <UiButton variant="primary" size="sm" :disabled="!name.trim()" :loading="saving" @click="saveCategory"
          >保存</UiButton
        >
        <UiButton v-if="editingId" variant="secondary" size="sm" @click="resetForm">取消</UiButton>
      </div>
    </div>
    <ConfirmDialog
      v-model:visible="confirmVisible"
      title="删除分类"
      content="该分类下的实例会变为「未分类」，此操作无法撤销。"
      danger
      :loading="deleting"
      @confirm="confirmDeleteCategory"
    />
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useResourceSnapshot } from '@/app/data/useResourceSnapshot'
import { queryKeys } from '@/app/queryKeys'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiButton from '@/components/ui/Button.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { instanceProfileApi } from '@/features/instances/api/instanceProfileApi'
import type { InstanceCategory } from '@/types/instances'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; changed: [] }>()
const visible = ref(props.visible)
const categories = useResourceSnapshot<InstanceCategory[]>(queryKeys.instanceCategories, [])
const editingId = ref('')
const name = ref('')
const color = ref('#7d8da6')
const saving = ref(false)

watch(
  () => props.visible,
  (value) => {
    visible.value = value
    if (value) void loadCategories()
  }
)
watch(visible, (value) => emit('update:visible', value))

async function loadCategories() {
  categories.value = await instanceProfileApi.categories()
}

function editCategory(category: InstanceCategory) {
  editingId.value = category.id
  name.value = category.name
  color.value = category.color
}

function resetForm() {
  editingId.value = ''
  name.value = ''
  color.value = '#7d8da6'
}

async function saveCategory() {
  saving.value = true
  try {
    await instanceProfileApi.upsertCategory({ id: editingId.value || undefined, name: name.value, color: color.value })
    resetForm()
    await loadCategories()
    emit('changed')
  } finally {
    saving.value = false
  }
}

const confirmVisible = ref(false)
const deleting = ref(false)
const pendingCategory = ref<InstanceCategory | null>(null)

function deleteCategory(category: InstanceCategory) {
  pendingCategory.value = category
  confirmVisible.value = true
}

async function confirmDeleteCategory() {
  const category = pendingCategory.value
  if (!category) return
  deleting.value = true
  try {
    await instanceProfileApi.deleteCategory(category.id)
    if (editingId.value === category.id) resetForm()
    await loadCategories()
    emit('changed')
    confirmVisible.value = false
    pendingCategory.value = null
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.category-manager,
.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.category-list {
  max-height: 300px;
  overflow-y: auto;
}
.category-row {
  display: grid;
  grid-template-columns: 12px 1fr 50px 28px 28px;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid var(--divider);
  border-radius: var(--r-sm);
}
.category-row i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.category-row span {
  color: var(--text-primary);
  font-size: 12px;
}
.category-row small {
  color: var(--text-tertiary);
  font-size: 9px;
}
.category-row button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}
.category-row button:hover {
  background: var(--bg-hover);
  color: var(--primary);
}
.category-row button.danger:hover {
  color: var(--error);
}
.category-form {
  display: grid;
  grid-template-columns: 1fr 44px auto auto;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.category-form strong {
  grid-column: 1 / -1;
  color: var(--text-primary);
  font-size: 11px;
}
.category-form input {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.category-form input[type='color'] {
  width: 40px;
  padding: 2px;
}
</style>
