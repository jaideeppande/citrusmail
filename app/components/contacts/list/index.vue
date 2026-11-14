<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { search, groups, filtered, status, selectedId, contacts, openCreate, duplicatesOpen } = useContactsPage()
const { refresh } = useContacts()
const { isSidebarOpen } = useShell()

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'New contact', icon: 'i-lucide-user-plus', onSelect: () => openCreate() }
], [
  { label: 'Find duplicates', icon: 'i-lucide-copy-check', disabled: contacts.value.length < 2, onSelect: () => (duplicatesOpen.value = true) },
  { label: 'Refresh', icon: 'i-lucide-refresh-cw', onSelect: () => refresh() }
]])

// Rows only arrive one after another the first time the list fills: typing in
// the search box would otherwise replay it on every letter
const settled = ref(false)
watch(() => filtered.value.length > 0, (filled) => {
  if (filled) setTimeout(() => (settled.value = true), 600)
}, { immediate: true })
</script>

<template>
  <section class="flex flex-col min-h-0 h-full">
    <header class="shrink-0 flex flex-col gap-3 px-4 pt-3 pb-3 border-b border-default">
      <div class="flex items-center gap-2 min-h-8">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="soft"
          size="sm"
          aria-label="Open menu"
          class="lg:hidden shrink-0"
          @click="isSidebarOpen = true"
        />
        <h1 class="flex-1 flex items-baseline gap-2">
          <span class="text-xl font-bold tracking-tight text-highlighted">Contacts</span>
          <span class="text-sm text-muted tabular-nums">{{ filtered.length }}</span>
        </h1>
        <UDropdownMenu
          :items="menu"
          :content="{ align: 'end' }"
        >
          <UTooltip text="More">
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="More"
            />
          </UTooltip>
        </UDropdownMenu>
      </div>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search contacts"
        variant="soft"
        :ui="{ base: 'bg-(--control-bg) rounded-full' }"
      />
    </header>

    <!-- Shaped like the rows they stand in for, so the list does not jump
      when the address book answers -->
    <div
      v-if="status === 'pending' && !filtered.length"
      class="flex-1 px-2 pt-9"
      aria-busy="true"
    >
      <div
        v-for="n in 8"
        :key="n"
        class="flex items-center gap-3 px-3 py-2"
      >
        <USkeleton class="size-8 shrink-0 rounded-full" />
        <div class="flex-1 flex flex-col gap-1.5">
          <USkeleton
            class="h-3.5"
            :style="{ width: `${40 + (n * 17) % 35}%` }"
          />
          <USkeleton
            class="h-3"
            :style="{ width: `${30 + (n * 11) % 30}%` }"
          />
        </div>
      </div>
    </div>

    <UEmpty
      v-else-if="status === 'error' && !filtered.length"
      icon="i-lucide-cloud-off"
      title="Couldn’t load contacts"
      description="The address book didn’t answer."
      :actions="[{ label: 'Try again', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'subtle', onClick: () => refresh() }]"
      variant="naked"
      class="flex-1"
    />

    <UEmpty
      v-else-if="!filtered.length"
      :icon="search ? 'i-lucide-search-x' : 'i-lucide-users'"
      :title="search ? 'No matches' : 'No contacts yet'"
      :description="search ? `Nobody matches “${search}”.` : 'Contacts you add here sync to your other devices.'"
      :actions="search
        ? [{ label: 'Clear search', icon: 'i-lucide-x', color: 'neutral', variant: 'subtle', onClick: () => { search = '' } }]
        : [{ label: 'New contact', icon: 'i-lucide-user-plus', color: 'neutral', variant: 'subtle', onClick: () => openCreate() }]"
      variant="naked"
      class="flex-1"
    />

    <div
      v-else
      class="flex-1 overflow-y-auto px-2 pb-4"
    >
      <section
        v-for="(group, groupIndex) in groups"
        :key="group.key"
      >
        <h2 class="sticky top-0 z-1 flex items-center gap-1.5 px-3 pt-3 pb-1 text-xs font-semibold text-muted bg-default/90 glass-material">
          <UIcon
            v-if="group.key === 'favourites'"
            name="i-ph-star-fill"
            class="size-3 text-warning"
          />
          {{ group.label }}
        </h2>
        <ContactsRow
          v-for="(contact, index) in group.items"
          :key="contact.id"
          :contact="contact"
          :selected="contact.id === selectedId"
          :class="!settled && 'lb-stagger'"
          :style="{ '--lb-i': groupIndex * 3 + index }"
          @select="selectedId = contact.id"
        />
      </section>
    </div>
  </section>
</template>
