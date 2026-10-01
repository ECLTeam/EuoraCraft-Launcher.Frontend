import { inject, nextTick, onUnmounted, provide, watch, type InjectionKey, type Ref } from 'vue'
import { useGlobalModalStack } from './useGlobalModalStack'

const modalParentKey: InjectionKey<string> = Symbol('modal-parent')

/** Teleport 不改变组件祖先；模板并列的窗口通过 parentId 显式关联。 */
export function useModalParent(modalId: string): string | null {
  const parentId = inject(modalParentKey, null)
  provide(modalParentKey, modalId)
  return parentId
}

interface ModalInteractionOptions {
  modalId: string
  container: Ref<HTMLElement | null>
  interactive: Readonly<Ref<boolean>>
  closable: () => boolean
  close: () => void
}

/** 只由活动层处理键盘与焦点，退场结束后恢复仍有效的触发控件。 */
export function useModalInteraction({ modalId, container, interactive, closable, close }: ModalInteractionOptions) {
  const stack = useGlobalModalStack()
  let trigger: HTMLElement | null = null
  let hasCapturedTrigger = false

  function focusableElements(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return [
      ...root.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]'
      ),
    ].filter((element) => {
      if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert], [hidden]')) return false
      let current: HTMLElement | null = element
      while (current) {
        const style = getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        if (current === root) break
        current = current.parentElement
      }
      return true
    })
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!interactive.value || event.defaultPrevented) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (closable()) close()
    } else if (event.key === 'Tab') {
      const elements = focusableElements()
      const first = elements[0]
      const last = elements.at(-1)
      const active = document.activeElement
      if (!first) {
        event.preventDefault()
        container.value?.focus()
      } else if (
        event.shiftKey &&
        (active === first || active === container.value || !container.value?.contains(active))
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (active === last || active === container.value || !container.value?.contains(active))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  watch(
    interactive,
    (active) => {
      if (active) {
        if (!hasCapturedTrigger) {
          trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
          hasCapturedTrigger = true
        }
        nextTick(() => {
          if (interactive.value && !container.value?.contains(document.activeElement)) container.value?.focus()
        })
        document.addEventListener('keydown', onKeydown)
      } else {
        document.removeEventListener('keydown', onKeydown)
      }
    },
    { immediate: true }
  )

  function restoreFocus(): void {
    const target = trigger
    trigger = null
    hasCapturedTrigger = false
    nextTick(() => {
      if (stack.activeModalId.value === modalId) return
      if (!target?.isConnected || target === document.body || target.closest('[inert]')) return
      const ownerId = target.closest<HTMLElement>('[data-modal-id]')?.dataset.modalId
      if (ownerId ? stack.interactiveModalId.value === ownerId : !stack.activeModalId.value) target.focus()
    })
  }

  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
  return { restoreFocus }
}
