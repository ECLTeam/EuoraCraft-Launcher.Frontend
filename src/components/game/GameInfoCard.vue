<template>
  <NCard class="info-card" contentStyle="padding: 0;" @mouseenter="emit('mouseenter')" @mouseleave="emit('mouseleave')">
    <NButton
      v-if="canToggle"
      class="info-toggle-btn"
      quaternary
      circle
      size="small"
      :title="view === 'tip' ? t('game.infoCard.toggleAnnouncements') : t('game.infoCard.toggleTips')"
      @click="emit('toggle')"
    >
      <template #icon><UiIcon :name="view === 'tip' ? 'bell' : 'lightbulb'" :size="14" /></template>
    </NButton>

    <Transition name="info-fade" mode="out-in">
      <div v-if="view === 'tip'" key="tip" class="info-tip">
        <div class="info-header">
          <UiIcon name="lightbulb" :size="16" />
          <span class="info-title">
            {{ isWelcome ? data.welcome?.title || t('game.welcomeTitle') : data.tip_title || t('game.didYouKnow') }}
          </span>
        </div>
        <p class="info-content">
          {{ isWelcome ? data.welcome?.content || t('game.welcomeContent') : currentTip }}
        </p>
      </div>

      <div v-else key="announce" class="info-announce">
        <div class="info-header">
          <UiIcon name="bell" :size="16" />
          <span class="info-title">{{ data.announcement_title || t('game.announcement') }}</span>
        </div>
        <div class="announce-list">
          <div v-if="!hasAnnouncements" class="announce-empty">
            {{ t('game.noAnnouncements') }}
          </div>
          <template v-else-if="data.mode === 'rotate'">
            <button
              v-if="currentAnnouncement"
              type="button"
              class="announce-item"
              @click="openAnnouncement(currentAnnouncement)"
            >
              <div class="announce-item-header">
                <span class="announce-item-title">{{ currentAnnouncement.title }}</span>
                <span class="announce-item-meta">
                  <span v-if="currentAnnouncement.date" class="announce-item-date">
                    {{ currentAnnouncement.date }}
                  </span>
                  <UiIcon name="arrow-right" :size="13" />
                </span>
              </div>
              <p class="announce-item-desc">
                {{ announcementPreview(currentAnnouncement.content) }}
              </p>
            </button>
          </template>
          <template v-else>
            <button
              v-for="(item, index) in data.announcements"
              :key="item.id || `${item.title}-${item.date}-${index}`"
              type="button"
              class="announce-item"
              @click="openAnnouncement(item)"
            >
              <div class="announce-item-header">
                <span class="announce-item-title">{{ item.title }}</span>
                <span class="announce-item-meta">
                  <span v-if="item.date" class="announce-item-date">{{ item.date }}</span>
                  <UiIcon name="arrow-right" :size="13" />
                </span>
              </div>
              <p class="announce-item-desc">
                {{ announcementPreview(item.content) }}
              </p>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </NCard>

  <Modal
    v-model:visible="announcementVisible"
    :title="selectedAnnouncement?.title || t('game.announcement')"
    :showFooter="false"
    maskClosable
    width="min(680px, calc(100vw - 32px))"
  >
    <article v-if="selectedAnnouncement" class="announcement-detail">
      <div v-if="selectedAnnouncement.date" class="announcement-detail-date">
        <UiIcon name="calendar" :size="13" />
        <span>{{ selectedAnnouncement.date }}</span>
      </div>
      <MarkdownContent :content="selectedAnnouncement.content" />
    </article>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import { MarkdownContent, UiIcon } from '@/components/ui'
import type { InfoCardData, InfoCardAnnouncement } from '@/types/system'
import { createMarkdownExcerpt } from '@/utils/markdown'

defineProps<{
  data: InfoCardData
  view: 'tip' | 'announce'
  isWelcome: boolean
  currentTip: string
  currentAnnouncement: InfoCardAnnouncement | null
  hasAnnouncements: boolean
  canToggle: boolean
}>()

const emit = defineEmits<{
  toggle: []
  mouseenter: []
  mouseleave: []
}>()

const { t } = useI18n()
const announcementVisible = ref(false)
const selectedAnnouncement = ref<InfoCardAnnouncement | null>(null)

function openAnnouncement(announcement: InfoCardAnnouncement): void {
  selectedAnnouncement.value = announcement
  announcementVisible.value = true
}

function announcementPreview(content: string): string {
  return createMarkdownExcerpt(content, 48, `... ${t('game.viewAnnouncementDetails')}`)
}
</script>

<style scoped>
.info-card {
  position: relative;
  overflow: hidden;
}

.info-toggle-btn {
  position: absolute;
  z-index: 1;
  top: 7px;
  right: 7px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 14px 0;
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}

.info-title {
  color: var(--text-primary);
}

.info-content {
  margin: 0;
  padding: 7px 14px 11px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.info-announce {
  padding-bottom: 4px;
}

.announce-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  max-height: 180px;
  padding: 7px 14px 11px;
}

.announce-empty {
  padding: 7px 0;
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: center;
}

.announce-item {
  width: 100%;
  padding: 0 0 7px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--divider);
  transition: color var(--duration-fast) var(--ease-emphasized);
}

.announce-item:hover,
.announce-item:focus-visible {
  color: var(--primary);
}

.announce-item:focus-visible {
  outline: 2px solid var(--primary-alpha);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}

.announce-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.announce-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.announce-item-title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.announce-item-date {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 10px;
}

.announce-item-meta {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  color: var(--text-tertiary);
}

.announce-item-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.announcement-detail {
  min-height: 120px;
}

.announcement-detail-date {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 13px;
  padding-bottom: 10px;
  color: var(--text-tertiary);
  font-size: 11px;
  border-bottom: 1px solid var(--divider);
}
</style>
