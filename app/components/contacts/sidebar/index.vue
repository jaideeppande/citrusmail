<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { ContactGroup } from '~/composables/useContactExtras'

const { account } = useShell()
const { books, contacts, openCreate, openGroupDialog, confirmRemoveGroup, openExport, selectedId } = useContactsPage()
const { groups, add, write } = useContactGroups()
const { birthdays } = useBirthdays()
const { isSidebarOpen, isMobile } = useShell()
const route = useRoute()

// A long month of birthdays would push the address books off the sidebar
const MAX_BIRTHDAYS = 6
const expanded = ref(false)
const shownBirthdays = computed(() => expanded.value ? birthdays.value : birthdays.value.slice(0, MAX_BIRTHDAYS))

const onList = computed(() => route.path === '/contacts')

async function openContact(contact: Contact) {
  // From a list filtered to another address book or group the contact may not be in it
  if (!onList.value || route.query.book || route.query.group) await navigateTo({ path: '/contacts', query: { c: contact.id } })
  else selectedId.value = contact.id
  // Below `lg` the sidebar is a slideover over the page it just changed
  if (isMobile.value) isSidebarOpen.value = false
}

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'All contacts', icon: 'i-lucide-users', to: { path: '/contacts' }, active: onList.value && !route.query.book && !route.query.group, badge: contacts.value.length || undefined },
  ...(books.value.length > 1
    ? books.value.map(book => ({
        label: book.name,
        icon: 'i-lucide-book-user',
        to: { path: '/contacts', query: { book: book.id } },
        active: onList.value && route.query.book === book.id,
        badge: contacts.value.filter(contact => contact.bookId === book.id).length || undefined
      }))
    : []),
  { label: 'Relationships', icon: 'i-lucide-chart-no-axes-column', to: '/contacts/relationships', active: route.path === '/contacts/relationships' }
])

function groupMenu(group: ContactGroup): DropdownMenuItem[][] {
  return [[
    { label: 'Write to everyone', icon: 'i-lucide-square-pen', disabled: !group.members.length, onSelect: () => write(group) },
    { label: 'Export…', icon: 'i-lucide-download', disabled: !group.members.length, onSelect: () => exportGroup(group) }
  ], [
    { label: 'Rename…', icon: 'i-lucide-pencil', onSelect: () => openGroupDialog(group) },
    { label: 'Delete group', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => confirmRemoveGroup(group) }
  ]]
}

async function exportGroup(group: ContactGroup) {
  await navigateTo({ path: '/contacts', query: { group: group.id } })
  openExport('group')
}

/* Dropping contacts dragged from the list onto a group puts them in it */
const over = ref<string>()

function carries(event: DragEvent) {
  return !!event.dataTransfer?.types.includes(CONTACT_DRAG_TYPE)
}

function onDragOver(event: DragEvent, group: ContactGroup) {
  if (!carries(event)) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  over.value = group.id
}

function onDrop(event: DragEvent, group: ContactGroup) {
  over.value = undefined
  if (!carries(event)) return
  event.preventDefault()
  try {
    const people = JSON.parse(event.dataTransfer!.getData(CONTACT_DRAG_TYPE)) as Address[]
    if (Array.isArray(people) && people.length) add(group, people.filter(person => typeof person?.address === 'string'))
  } catch {
    // Something else that only looked like contacts
  }
}

function closeOnMobile() {
  if (isMobile.value) isSidebarOpen.value = false
}
</script>

<template>
  <template v-if="account?.hasContacts">
    <UButton
      icon="i-lucide-user-plus"
      label="New contact"
      block
      @click="openCreate()"
    />
    <UNavigationMenu
      :items="items"
      orientation="vertical"
    />

    <section
      aria-labelledby="contacts-groups"
      class="flex flex-col gap-0.5"
    >
      <div class="flex items-center justify-between gap-1 ps-2.5">
        <h2
          id="contacts-groups"
          class="py-1.5 text-xs font-semibold text-highlighted"
        >
          Groups
        </h2>
        <UTooltip text="New group">
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="New group"
            @click="openGroupDialog()"
          />
        </UTooltip>
      </div>

      <p
        v-if="!groups.length"
        class="px-2.5 pb-1 text-xs text-muted"
      >
        Gather people you write to together, then write to all of them at once.
      </p>

      <ul
        v-else
        class="flex flex-col gap-px"
      >
        <li
          v-for="(group, index) in groups"
          :key="group.id"
          class="group/item lb-stagger relative flex items-center rounded-md"
          :style="{ '--lb-i': index }"
          :data-contact-drop="over === group.id ? 'over' : undefined"
          @dragover="onDragOver($event, group)"
          @dragleave="over === group.id && (over = undefined)"
          @drop="onDrop($event, group)"
        >
          <NuxtLink
            :to="{ path: '/contacts', query: { group: group.id } }"
            :aria-current="onList && route.query.group === group.id ? 'page' : undefined"
            class="lb-focus flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 pe-8 text-sm transition-colors duration-(--lb-dur-1)"
            :class="onList && route.query.group === group.id ? 'bg-elevated text-highlighted' : 'text-default hover:bg-elevated/60'"
            @click="closeOnMobile"
          >
            <UIcon
              name="i-lucide-users"
              class="size-4 shrink-0 text-muted"
            />
            <span class="min-w-0 flex-1 truncate">{{ group.name }}</span>
            <span class="text-xs text-muted tabular-nums group-focus-within/item:opacity-0 group-hover/item:opacity-0">
              {{ group.members.length }}<span class="sr-only"> {{ group.members.length === 1 ? 'person' : 'people' }}</span>
            </span>
          </NuxtLink>
          <UDropdownMenu
            :items="groupMenu(group)"
            :content="{ align: 'start' }"
          >
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`${group.name} options`"
              class="absolute inset-e-1 opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            />
          </UDropdownMenu>
        </li>
      </ul>
    </section>

    <section
      v-if="birthdays.length"
      aria-labelledby="contacts-birthdays"
      class="flex flex-col gap-0.5"
    >
      <h2
        id="contacts-birthdays"
        class="px-2.5 py-1.5 text-xs font-semibold text-highlighted"
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
          :class="birthday.inDays === 0 ? 'text-primary' : 'text-muted'"
        />
        <span class="min-w-0 flex-1 text-start">
          <span class="block truncate text-sm text-default">{{ birthday.contact.name }}</span>
          <span
            class="block truncate text-xs"
            :class="birthday.inDays === 0 ? 'font-medium text-primary' : 'text-muted'"
          >{{ birthdayLabel(birthday) }}</span>
        </span>
      </UButton>
      <UButton
        v-if="birthdays.length > MAX_BIRTHDAYS"
        :label="expanded ? 'Show fewer' : `Show all ${birthdays.length}`"
        :aria-expanded="expanded"
        color="neutral"
        variant="link"
        size="xs"
        class="self-start px-2.5"
        @click="expanded = !expanded"
      />
    </section>
  </template>
</template>
