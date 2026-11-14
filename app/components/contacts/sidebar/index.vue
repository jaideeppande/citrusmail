<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { account } = useShell()
const { books, contacts, openCreate, selectedId } = useContactsPage()
const { birthdays } = useBirthdays()
const { isSidebarOpen, isMobile } = useShell()
const route = useRoute()

// A long month of birthdays would push the address books off the sidebar
const MAX_BIRTHDAYS = 6
const expanded = ref(false)
const shownBirthdays = computed(() => expanded.value ? birthdays.value : birthdays.value.slice(0, MAX_BIRTHDAYS))

async function openContact(contact: Contact) {
  // From a list filtered to another address book the contact would not be in it
  if (route.path !== '/contacts' || route.query.book) await navigateTo({ path: '/contacts', query: { c: contact.id } })
  else selectedId.value = contact.id
  // Below `lg` the sidebar is a slideover over the page it just changed
  if (isMobile.value) isSidebarOpen.value = false
}

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'All contacts', icon: 'i-lucide-users', to: { path: '/contacts' }, active: !route.query.book, badge: contacts.value.length || undefined },
  ...(books.value.length > 1
    ? books.value.map(book => ({
        label: book.name,
        icon: 'i-lucide-book-user',
        to: { path: '/contacts', query: { book: book.id } },
        active: route.query.book === book.id,
        badge: contacts.value.filter(contact => contact.bookId === book.id).length || undefined
      }))
    : [])
])
</script>

<template>
  <template v-if="account?.hasContacts">
    <UButton
      icon="i-lucide-user-plus"
      label="New contact"
      block
      @click="openCreate"
    />
    <UNavigationMenu
      :items="items"
      orientation="vertical"
    />

    <section
      v-if="birthdays.length"
      aria-labelledby="contacts-birthdays"
      class="flex flex-col gap-0.5"
    >
      <h2
        id="contacts-birthdays"
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-highlighted"
      >
        Birthdays
      </h2>
      <UButton
        v-for="(birthday, index) in shownBirthdays"
        :key="birthday.contact.id"
        color="neutral"
        variant="ghost"
        block
        class="lb-stagger justify-start gap-2 px-2.5 py-1.5 font-normal"
        :class="birthday.contact.id === selectedId && 'bg-elevated/60'"
        :style="{ '--lb-i': index }"
        @click="openContact(birthday.contact)"
      >
        <UIcon
          name="i-lucide-cake"
          class="size-4 shrink-0"
          :class="birthday.inDays === 0 ? 'text-primary' : 'text-dimmed'"
        />
        <span class="flex-1 min-w-0 text-start">
          <span class="block truncate text-sm text-default">{{ birthday.contact.name }}</span>
          <span
            class="block truncate text-xs"
            :class="birthday.inDays === 0 ? 'text-primary' : 'text-muted'"
          >{{ birthdayLabel(birthday) }}</span>
        </span>
      </UButton>
      <UButton
        v-if="birthdays.length > MAX_BIRTHDAYS"
        :label="expanded ? 'Show fewer' : `Show all ${birthdays.length}`"
        color="neutral"
        variant="link"
        size="xs"
        class="self-start px-2.5"
        @click="expanded = !expanded"
      />
    </section>
  </template>
</template>
