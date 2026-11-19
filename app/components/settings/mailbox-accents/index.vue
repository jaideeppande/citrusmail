<script setup lang="ts">
// Settings → Appearance: an accent for each mailbox signed in here, so it's
// plain at a glance which one is open. Only shown with more than one
const { mailboxes } = useMailboxes()
const { account } = useShell()
const { $appearance } = useNuxtApp()
const { accentOf, set } = useMailboxAccents()

/** The accent a mailbox falls back on: the one chosen above, or the instance's */
const general = computed(() => $appearance.value.primary && isHexColor($appearance.value.primary) ? $appearance.value.primary : 'var(--color-post-600)')
const isOpen = (email: string) => email.toLowerCase() === account.value?.email.toLowerCase()
</script>

<template>
  <ul
    v-if="mailboxes.length > 1"
    class="flex flex-col divide-y divide-default"
  >
    <li
      v-for="mailbox in mailboxes"
      :key="mailbox.email"
      class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0"
    >
      <span class="flex w-56 min-w-0 items-center gap-2">
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ background: accentOf(mailbox.email) ?? general }"
          aria-hidden="true"
        />
        <span class="min-w-0">
          <span class="block truncate text-sm text-highlighted">{{ mailbox.name || mailbox.email }}</span>
          <span class="block truncate text-xs text-muted">
            {{ mailbox.name ? mailbox.email : '' }}{{ isOpen(mailbox.email) ? `${mailbox.name ? ' · ' : ''}Open now` : '' }}
          </span>
        </span>
      </span>
      <SettingsAccentPicker
        :model-value="accentOf(mailbox.email)"
        default-label="Same as your accent"
        :default-swatch="general"
        :label="`Accent for ${mailbox.email}`"
        @update:model-value="set(mailbox.email, $event)"
      />
    </li>
  </ul>
</template>
