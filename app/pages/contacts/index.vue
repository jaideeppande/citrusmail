<script setup lang="ts">
useSeoMeta({ title: 'Contacts' })

const { account } = useShell()
const { selected, selectedId, editorOpen, editing, submit, books, duplicatesOpen, openCreate, contacts, status } = useContactsPage()
useContactsCommands()

// With nobody in the address book the list already says so and offers the
// way in; the pane beside it only repeats it once there is someone to pick
const hasContacts = computed(() => contacts.value.length > 0 || status.value === 'pending')

const isMobile = useMediaQuery('(max-width: 1023px)')
const detailOpen = computed({
  get: () => !!selected.value,
  set: (open) => {
    if (!open) selectedId.value = undefined
  }
})
</script>

<template>
  <div class="relative flex-1 flex min-w-0">
    <ServiceNotConnected
      v-if="!account?.hasContacts"
      class="flex-1"
    />

    <template v-else>
      <ContactsList class="w-full lg:w-80 xl:w-96 shrink-0 lg:border-e border-default" />

      <template v-if="!isMobile">
        <!-- Keyed by the person, so picking another brings the pane in afresh
          and their recent mail is looked up from a clean start -->
        <ContactsDetail
          v-if="selected"
          :key="selected.id"
          :contact="selected"
          class="lb-in-right flex-1 min-w-0"
        />
        <UEmpty
          v-else
          icon="i-lucide-contact"
          title="No contact selected"
          :description="hasContacts ? 'Pick someone from the list to see their details.' : 'Add someone to start your address book.'"
          :actions="[{ label: 'New contact', icon: 'i-lucide-user-plus', color: 'neutral', variant: 'subtle', onClick: () => openCreate() }]"
          variant="naked"
          class="lb-in flex-1"
        />
      </template>

      <USlideover
        v-else
        v-model:open="detailOpen"
        side="right"
      >
        <template #content>
          <ContactsDetail
            v-if="selected"
            :key="selected.id"
            :contact="selected"
            class="h-full"
          />
        </template>
      </USlideover>

      <ContactsEditor
        v-model:open="editorOpen"
        :contact="editing"
        :books="books"
        @save="submit"
      />

      <ContactsDuplicates v-model:open="duplicatesOpen" />
    </template>
  </div>
</template>
