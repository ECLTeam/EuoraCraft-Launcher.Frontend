<template>
  <section class="connect-player-section">
    <div v-if="players.length" class="connect-player-list">
      <div
        v-for="player in players"
        :key="player.machineId || player.name"
        class="connect-player-row"
        :class="{ 'is-host': player.kind === 'host' }"
      >
        <ConnectorPlayerAvatar :skinBase64="player.iconBase64" :name="player.name" :size="32" />
        <div class="connect-player-identity">
          <div>
            <strong :title="player.name">{{ player.name }}</strong>
            <UiTag v-if="player.kind === 'host'" size="tiny" tone="info">{{ t('connect.players.host') }}</UiTag>
          </div>
          <span>{{ player.vendor }}</span>
        </div>
        <span class="connect-player-presence" aria-hidden="true"></span>
        <UiButton
          v-if="hostControls && player.kind !== 'host'"
          variant="ghost"
          shape="square"
          icon="user-x"
          :title="t('connect.players.kick')"
          :aria-label="t('connect.players.kick')"
          :disabled="busy"
          @click="emit('kick', player)"
        />
      </div>
    </div>
    <span v-else class="connect-empty-text">{{ t('connect.players.empty') }}</span>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ConnectorPlayerAvatar from '@/components/connect/ConnectorPlayerAvatar.vue'
import UiButton from '@/components/ui/Button.vue'
import UiTag from '@/components/ui/Tag.vue'
import type { ConnectorPlayer } from '@/types/connect'

defineOptions({ name: 'ConnectorPlayerList' })

defineProps<{
  players: ConnectorPlayer[]
  hostControls?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  kick: [player: ConnectorPlayer]
}>()

const { t } = useI18n()
</script>
