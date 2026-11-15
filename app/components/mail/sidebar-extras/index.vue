<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { account } = useShell()
const board = useLaterBoard()
const { messages } = useMail()

// Mail that isn't a folder on the server: what you've set aside, and the lists you're on
const extras = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Later',
    icon: 'i-lucide-square-kanban',
    to: '/later',
    badge: board.open.value ? { label: String(board.open.value), color: 'neutral' as const, variant: 'subtle' as const } : undefined
  },
  ...(account.value && account.value.protocol !== 'pop3' ? [{ label: 'Subscriptions', icon: 'i-lucide-newspaper', to: '/subscriptions' }] : [])
])

// Rows dragged from the list onto Later land in its first column
const over = ref(false)
const onLater = (event: DragEvent) => !!(event.target as HTMLElement | null)?.closest('a[href="/later"]')
function onDragOver(event: DragEvent) {
  over.value = !!event.dataTransfer?.types.includes(MAIL_DRAG_TYPE) && onLater(event)
  if (!over.value) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}
function onDrop(event: DragEvent) {
  const data = over.value && event.dataTransfer?.getData(MAIL_DRAG_TYPE)
  over.value = false
  if (!data) return
  event.preventDefault()
  const keys = new Set<string>(JSON.parse(data))
  board.add(messages.value.filter(message => keys.has(messageKey(message))), 'todo')
}
</script>

<template>
  <div
    class="mt-auto flex flex-col gap-0.5"
    :class="over && '[&_a[href=\'/later\']]:bg-primary/12 [&_a[href=\'/later\']]:ring-1 [&_a[href=\'/later\']]:ring-primary/50'"
    @dragover="onDragOver"
    @dragleave="over = false"
    @drop="onDrop"
  >
    <MailSnoozed :collapsed="collapsed" />
    <UNavigationMenu
      :items="extras"
      orientation="vertical"
      :collapsed="collapsed"
      :tooltip="{ content: { side: 'right' } }"
      :ui="{ linkTrailingBadge: 'font-semibold tabular-nums' }"
    />
  </div>
</template>
