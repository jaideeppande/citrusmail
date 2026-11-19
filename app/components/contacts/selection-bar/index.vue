<script setup lang="ts">
// What can be done with the ticked contacts at once: put them in a group,
// write to all of them, export them
const { checked, checkedIds, clearChecks, openExport, group } = useContactsPage()
const { removeMembers } = useContactGroups()
const { compose } = useComposer()
const toast = useToast()

const reachable = computed(() => checked.value.map(contactMember).filter((member): member is Address => !!member))

function write() {
  if (reachable.value.length) compose(reachable.value)
}

function removeFromGroup() {
  const current = group.value
  if (!current) return
  const count = checked.value.length
  removeMembers(current, checked.value)
  toast.add({ title: `Removed ${peopleCount(count)} from ${current.name}`, icon: 'i-lucide-user-minus' })
  // Quietly: the removal was just announced, and that is the news
  checkedIds.value = []
}
</script>

<template>
  <div
    role="toolbar"
    aria-label="Selected contacts"
    class="mx-2 mb-1 flex items-center gap-1 rounded-md bg-elevated/70 py-1 ps-3 pe-1"
  >
    <span class="me-auto text-sm font-medium text-highlighted tabular-nums">{{ checked.length }} selected</span>
    <ContactsAddToGroup :contacts="checked">
      <UButton
        label="Add to group"
        icon="i-lucide-users"
        color="neutral"
        variant="ghost"
        size="xs"
      />
    </ContactsAddToGroup>
    <UTooltip
      v-if="group"
      :text="`Remove from ${group.name}`"
    >
      <UButton
        icon="i-lucide-user-minus"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Remove selected from ${group.name}`"
        @click="removeFromGroup"
      />
    </UTooltip>
    <UTooltip text="Write to everyone selected">
      <UButton
        icon="i-lucide-square-pen"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Write to everyone selected"
        :disabled="!reachable.length"
        @click="write"
      />
    </UTooltip>
    <UTooltip text="Export selected">
      <UButton
        icon="i-lucide-download"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Export selected"
        @click="openExport('selection')"
      />
    </UTooltip>
    <UTooltip text="Clear selection">
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Clear selection"
        @click="clearChecks"
      />
    </UTooltip>
  </div>
</template>
