<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { account } = useShell()
const appConfig = useAppConfig()

// POP3 has no folders: no sender lists or rules
const folders = computed(() => account.value?.protocol !== 'pop3')

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'Profile', icon: 'i-lucide-circle-user-round', to: '/settings/profile' },
  { label: 'Signature', icon: 'i-lucide-signature', to: '/settings/signature' },
  ...(appConfig.citrusmail.allowAppearance ? [{ label: 'Appearance', icon: 'i-lucide-palette', to: '/settings/appearance' }] : []),
  { label: 'Accessibility', icon: 'i-lucide-accessibility', to: '/settings/accessibility' },
  { label: 'Reading', icon: 'i-lucide-book-open', to: '/settings/reading' },
  { label: 'Notifications', icon: 'i-lucide-bell', to: '/settings/notifications' },
  { label: 'Shortcuts', icon: 'i-lucide-keyboard', to: '/settings/shortcuts' },
  // POP3 has no folders to file into
  ...(folders.value ? [{ label: 'Senders', icon: 'i-lucide-shield-check', to: '/settings/senders' }] : []),
  ...(folders.value ? [{ label: 'Rules', icon: 'i-lucide-list-filter', to: '/settings/rules' }] : []),
  { label: 'Tracking', icon: 'i-lucide-mail-check', to: '/settings/tracking' },
  { label: 'AI', icon: 'i-lucide-sparkles', to: '/settings/ai' },
  { label: 'Privacy', icon: 'i-lucide-lock', to: '/settings/privacy' },
  // Only the desktop app can open at sign-in or take mailto: links
  ...(desktop() ? [{ label: 'Desktop', icon: 'i-lucide-monitor', to: '/settings/desktop' }] : []),
  { label: 'Insights', icon: 'i-lucide-chart-column', to: '/settings/insights' },
  { label: 'About', icon: 'i-lucide-info', to: '/settings/about' }
])
</script>

<template>
  <p
    v-if="!collapsed"
    class="px-2.5 pb-1 text-xs font-medium text-muted"
  >
    Settings
  </p>
  <UNavigationMenu
    :items="items"
    aria-label="Settings"
    orientation="vertical"
    :collapsed="collapsed"
    :tooltip="{ content: { side: 'right' } }"
  />
</template>
