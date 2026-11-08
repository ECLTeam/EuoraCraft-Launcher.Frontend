import { NAlert, NButton, NInput, NInputNumber, NSelect, NSpin, NTag } from 'naive-ui'
import Modal from '@/components/modals/Modal.vue'
import { UiAvatar, UiButton, UiCard, UiIcon, UiInput, UiLoading, UiProgress, UiSelect, UiTag } from '@/components/ui'
import { renderSkinAvatar } from '@/composables/useAvatarRenderer'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import { i18n } from '@/i18n'

/** 主窗口插件页面可复用的现有标准控件，不携带任何业务服务。 */
export const pluginVueControls: Record<string, unknown> = {
  NAlert,
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  NTag,
  UiAvatar,
  UiButton,
  UiCard,
  UiIcon,
  UiInput,
  UiLoading,
  UiProgress,
  UiSelect,
  UiTag,
  Modal,
  SettingRow,
  renderSkinAvatar,
  t: i18n.global.t,
}
