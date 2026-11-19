<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { search, sections, filtered, status, selectedId, contacts, group, checkedIds, checkAll, clearChecks, openCreate, openGroupDialog, openExport, duplicatesOpen, importOpen } = useContactsPage()
const { refresh } = useContacts()
const { isSidebarOpen } = useShell()
const route = useRoute()

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'New contact', icon: 'i-lucide-user-plus', onSelect: () => openCreate() },
  { label: 'New group', icon: 'i-lucide-users', onSelect: () => openGroupDialog() }
], [
  { label: 'Import…', icon: 'i-lucide-upload', onSelect: () => (importOpen.value = true) },
  { label: 'Export…', icon: 'i-lucide-download', disabled: !contacts.value.length, onSelect: () => openExport() }
], [
  { label: 'Select all', icon: 'i-lucide-list-checks', disabled: !filtered.value.length, onSelect: () => checkAll() },
  { label: 'Find duplicates', icon: 'i-lucide-copy-check', disabled: contacts.value.length < 2, onSelect: () => (duplicatesOpen.value = true) },
  { label: 'Refresh', icon: 'i-lucide-refresh-cw', onSelect: () => refresh() }
]])

const title = computed(() => group.value?.name ?? 'Contacts')

// Rows only arrive one after another the first time the list fills: typing in
// the search box would otherwise replay it on every letter
const settled = ref(false)
watch(() => filtered.value.length > 0, (filled) => {
  if (filled) setTimeout(() => (settled.value = true), 600)
}, { immediate: true })

/* Keyboard: one tab stop for the whole list, arrows between people, Home and
   End, and a letter to jump to the next name that starts with it */
const scroller = useTemplateRef('scroller')
// Keyed by position as well: a favourite is listed twice, under the star and its letter
const activeKey = ref<string>()
const keyOf = (section: string, contact: Contact) => `${section}:${contact.id}`

const firstKey = computed(() => {
  const section = sections.value[0]
  return section?.items[0] ? keyOf(section.key, section.items[0]) : undefined
})
// The selected person is where the keyboard starts; failing that, the top of the list
const currentKey = computed(() => {
  const keys = sections.value.flatMap(section => section.items.map(contact => keyOf(section.key, contact)))
  if (activeKey.value && keys.includes(activeKey.value)) return activeKey.value
  const selected = sections.value.flatMap(section => section.items.filter(contact => contact.id === selectedId.value).map(contact => keyOf(section.key, contact)))
  return selected.at(-1) ?? firstKey.value
})

function rows(): HTMLButtonElement[] {
  return [...(scroller.value?.querySelectorAll<HTMLButtonElement>('[data-contact-row]') ?? [])]
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const list = rows()
  const row = target.closest('li')?.querySelector<HTMLButtonElement>('[data-contact-row]')
  const index = row ? list.indexOf(row) : -1
  if (index < 0) return

  const move = (to: number) => {
    event.preventDefault()
    list[Math.max(0, Math.min(list.length - 1, to))]?.focus()
  }

  if (event.key === 'ArrowDown') return move(index + 1)
  if (event.key === 'ArrowUp') return move(index - 1)
  if (event.key === 'Home') return move(0)
  if (event.key === 'End') return move(list.length - 1)
  if (event.key === 'PageDown') return move(index + 10)
  if (event.key === 'PageUp') return move(index - 10)
  if (event.key === 'Escape' && checkedIds.value.length) {
    event.preventDefault()
    clearChecks()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    checkAll()
    return
  }

  // Type-ahead by first letter: the next name with it, round to the top again
  if (event.key.length === 1 && /\p{L}|\d/u.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const letter = initialOf(event.key)
    const order = [...list.slice(index + 1), ...list.slice(0, index + 1)]
    const next = order.find(item => item.dataset.initial === letter)
    if (next) {
      event.preventDefault()
      next.focus()
    } else {
      announce(`Nobody under ${letter}`)
    }
  }
}

// Picking someone in the sidebar or the palette moves the keyboard there too
watch(selectedId, () => (activeKey.value = undefined))
// A new group or address book starts the list again
watch(() => [route.query.group, route.query.book], () => clearChecks())
</script>

<template>
  <section
    class="flex h-full min-h-0 flex-col"
    :aria-label="title"
  >
    <header class="flex shrink-0 flex-col gap-2.5 px-3 pt-3 pb-2">
      <div class="flex min-h-8 items-center gap-2">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="soft"
          size="sm"
          aria-label="Open menu"
          class="shrink-0 lg:hidden"
          @click="isSidebarOpen = true"
        />
        <h1 class="flex min-w-0 flex-1 items-baseline gap-2 ps-1">
          <span class="truncate text-lg font-semibold tracking-tight text-highlighted">{{ title }}</span>
          <span class="text-sm text-muted tabular-nums">
            {{ filtered.length }}<span class="sr-only"> {{ filtered.length === 1 ? 'contact' : 'contacts' }}</span>
          </span>
        </h1>
        <UTooltip text="New contact">
          <UButton
            icon="i-lucide-user-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="New contact"
            @click="openCreate()"
          />
        </UTooltip>
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
              aria-label="More contact actions"
            />
          </UTooltip>
        </UDropdownMenu>
      </div>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search contacts"
        aria-label="Search contacts"
        variant="soft"
        size="sm"
        :ui="{ base: 'bg-(--control-bg) rounded-md' }"
      />
    </header>

    <Transition name="lb-collapse">
      <div v-if="checkedIds.length">
        <div class="min-h-0 overflow-hidden">
          <ContactsSelectionBar />
        </div>
      </div>
    </Transition>

    <!-- Shaped like the rows they stand in for, so the list does not jump
      when the address book answers -->
    <div
      v-if="status === 'pending' && !filtered.length"
      class="flex-1 px-2 pt-8"
      aria-busy="true"
      aria-label="Loading contacts"
    >
      <div
        v-for="n in 10"
        :key="n"
        class="flex items-center gap-3 px-2.5 py-1.5"
      >
        <USkeleton class="size-6 shrink-0 rounded-full" />
        <div class="flex flex-1 flex-col gap-1.5">
          <USkeleton
            class="h-3"
            :style="{ width: `${40 + (n * 17) % 35}%` }"
          />
          <USkeleton
            class="h-2.5"
            :style="{ width: `${30 + (n * 11) % 30}%` }"
          />
        </div>
      </div>
    </div>

    <AppEmpty
      v-else-if="status === 'error' && !filtered.length"
      illustration="offline"
      tone="error"
      title="Couldn’t load contacts"
      description="The address book didn’t answer."
      :actions="[{ label: 'Try again', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'subtle', onClick: () => refresh() }]"
      class="flex-1"
    />

    <AppEmpty
      v-else-if="!filtered.length && group && !search"
      illustration="no-contacts"
      title="Nobody in this group yet"
      description="Drag people here from the list, or use “Add to group” on a contact."
      class="flex-1"
    />

    <AppEmpty
      v-else-if="!filtered.length"
      :illustration="search ? 'no-results' : 'no-contacts'"
      :title="search ? 'No matches' : 'No contacts yet'"
      :description="search ? `Nobody matches “${search}”.` : 'Contacts you add here sync to your other devices.'"
      :actions="search
        ? [{ label: 'Clear search', icon: 'i-lucide-x', color: 'neutral', variant: 'subtle', onClick: () => { search = '' } }]
        : [{ label: 'New contact', icon: 'i-lucide-user-plus', color: 'neutral', variant: 'subtle', onClick: () => openCreate() }, { label: 'Import…', icon: 'i-lucide-upload', color: 'neutral', variant: 'ghost', onClick: () => { importOpen = true } }]"
      class="flex-1"
    />

    <div
      v-else
      ref="scroller"
      class="flex-1 overflow-y-auto px-2 pb-4"
      @keydown="onKeydown"
    >
      <p
        id="contacts-list-help"
        class="sr-only"
      >
        Arrow keys move between people, a letter jumps to names starting with it, Tab reaches the select box and the star.
      </p>
      <section
        v-for="(section, sectionIndex) in sections"
        :key="section.key"
        :aria-labelledby="`contacts-section-${section.key}`"
      >
        <h2
          :id="`contacts-section-${section.key}`"
          class="sticky top-0 z-1 flex items-center gap-1.5 bg-default/90 px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase glass-material"
        >
          <UIcon
            v-if="section.key === 'favourites'"
            name="i-ph-star-fill"
            class="size-3 text-warning"
          />
          {{ section.label }}
        </h2>
        <ul
          :aria-labelledby="`contacts-section-${section.key}`"
          aria-describedby="contacts-list-help"
        >
          <ContactsRow
            v-for="(contact, index) in section.items"
            :key="contact.id"
            :contact="contact"
            :selected="contact.id === selectedId"
            :active="keyOf(section.key, contact) === currentKey"
            :class="!settled && 'lb-stagger'"
            :style="{ '--lb-i': sectionIndex * 3 + index }"
            @select="selectedId = contact.id"
            @focus="activeKey = keyOf(section.key, contact)"
          />
        </ul>
      </section>
    </div>
  </section>
</template>
