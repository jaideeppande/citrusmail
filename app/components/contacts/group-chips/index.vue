<script setup lang="ts">
// The groups a contact is in, on their page: each a chip that leads to the
// group and can take them out of it, and a menu to add them to another
const props = defineProps<{
  contact: Contact
}>()

const { groupsOf, removeMembers } = useContactGroups()
const route = useRoute()

const mine = computed(() => groupsOf(props.contact))
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="group in mine"
      :key="group.id"
      class="inline-flex items-center rounded-md bg-elevated text-sm text-default"
    >
      <NuxtLink
        :to="{ path: '/contacts', query: { ...route.query, group: group.id, c: undefined } }"
        class="lb-focus rounded-s-md py-0.5 ps-2 pe-1 hover:text-highlighted"
      >{{ group.name }}</NuxtLink>
      <button
        type="button"
        class="lb-focus grid size-6 place-items-center rounded-e-md text-muted hover:text-highlighted"
        :aria-label="`Remove ${contact.name} from ${group.name}`"
        @click="removeMembers(group, [contact])"
      >
        <UIcon
          name="i-lucide-x"
          class="size-3.5"
        />
      </button>
    </span>
    <ContactsAddToGroup
      v-if="contact.emails.length"
      :contacts="[contact]"
    >
      <UButton
        :label="mine.length ? undefined : 'Add to group'"
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Add ${contact.name} to a group`"
      />
    </ContactsAddToGroup>
    <span
      v-else
      class="text-sm text-muted"
    >Add an email address to put them in a group</span>
  </div>
</template>
