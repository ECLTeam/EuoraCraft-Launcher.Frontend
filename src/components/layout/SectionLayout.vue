<template>
  <div class="section-layout">
    <aside class="section-layout__nav ecl-surface">
      <div class="section-layout__title">
        <UiIcon :name="icon" :size="18" />
        <span>{{ title }}</span>
      </div>
      <NMenu class="section-layout__menu" :value="route.path" :options="menuOptions" @update:value="handleSelect" />
      <div v-if="$slots['nav-bottom']" class="section-layout__nav-bottom">
        <slot name="nav-bottom" />
      </div>
    </aside>

    <main class="section-layout__content">
      <slot name="content-top" />
      <div ref="viewportRef" class="section-layout__viewport">
        <slot />
      </div>
      <slot name="content-bottom" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { NMenu, type MenuOption } from 'naive-ui'
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { recallSectionScroll, rememberSectionScroll } from '@/app/runtime/sectionMemory'
import UiIcon from '@/components/ui/Icon.vue'

export interface SectionNavigationItem {
  key?: string
  path?: string
  label: string
  icon: string
  action?: () => void
}

const props = defineProps<{
  title: string
  icon: string
  items: SectionNavigationItem[]
}>()

const route = useRoute()
const router = useRouter()
const viewportRef = ref<HTMLElement | null>(null)
// 路由变化会先更新 route，组件卸载时已读不到离开前的路径，这里单独记录当前子页面
const activePath = ref(route.path)

let restoreFrame = 0
let restoreTimer: ReturnType<typeof setTimeout> | null = null

function saveScroll(path: string): void {
  const element = viewportRef.value
  if (!element) return
  rememberSectionScroll(path, element.scrollTop)
}

function applyScrollTop(path: string): void {
  const element = viewportRef.value
  if (!element) return
  element.scrollTop = recallSectionScroll(path)
}

function cancelScheduledRestore(): void {
  if (restoreFrame) cancelAnimationFrame(restoreFrame)
  restoreFrame = 0
  if (restoreTimer) clearTimeout(restoreTimer)
  restoreTimer = null
}

/**
 * 恢复子页面滚动位置。
 *
 * 子页面切换使用 out-in 过渡，内容高度在过渡结束前会钳制滚动位置，
 * 因此在下一帧与过渡结束后各再对齐一次，避免恢复到被截断的位置。
 */
function scheduleRestore(path: string): void {
  cancelScheduledRestore()
  applyScrollTop(path)
  restoreFrame = requestAnimationFrame(() => applyScrollTop(path))
  restoreTimer = setTimeout(() => applyScrollTop(path), 450)
}

watch(
  () => route.path,
  async (path, previousPath) => {
    // 路由切换时 DOM 尚未替换，此刻读到的是上一个子页面真实的位置
    if (previousPath) saveScroll(previousPath)
    activePath.value = path
    await nextTick()
    scheduleRestore(path)
  }
)

onMounted(async () => {
  activePath.value = route.path
  await nextTick()
  scheduleRestore(route.path)
})

onBeforeUnmount(() => {
  saveScroll(activePath.value)
  cancelScheduledRestore()
})

const menuOptions = computed<MenuOption[]>(() =>
  props.items.map((item) => ({
    key: item.path ?? item.key ?? item.label,
    label: item.label,
    icon: () => h(UiIcon, { name: item.icon, size: 18 }),
  }))
)

function handleSelect(key: string) {
  const item = props.items.find((i) => (i.path ?? i.key ?? i.label) === key)
  if (!item) return
  if (item.action) {
    item.action()
    return
  }
  if (item.path && item.path !== route.path) void router.push(item.path)
}
</script>

<style scoped src="@/styles/components/layout/SectionLayout.css"></style>
