<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { account } = useShell()

// Mail that isn't a folder on the server: the lists you're on
const extras = computed<NavigationMenuItem[]>(() => account.value && account.value.protocol !== 'pop3'
  ? [{ label: 'Subscriptions', icon: 'i-lucide-newspaper', to: '/subscriptions' }]
  : [])
</script>

<template>
  <div class="mt-auto flex flex-col gap-0.5">
    <MailSnoozed :collapsed="collapsed" />
    <UNavigationMenu
      v-if="extras.length"
      :items="extras"
      orientation="vertical"
      :collapsed="collapsed"
      :tooltip="{ content: { side: 'right' } }"
    />
  </div>
</template>
