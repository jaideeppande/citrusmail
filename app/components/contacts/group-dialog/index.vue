<script setup lang="ts">
// Naming a group: a new one (with whoever was ticked when it was asked
// for), or renaming one that exists
const { groupDialog } = useContactsPage()
const { create, rename } = useContactGroups()
const route = useRoute()

const name = ref('')
const error = ref('')

const open = computed({
  get: () => groupDialog.value.open,
  set: value => (groupDialog.value = { ...groupDialog.value, open: value })
})

watch(open, (value) => {
  if (!value) return
  name.value = groupDialog.value.group?.name ?? ''
  error.value = ''
})

async function submit() {
  const value = name.value.trim()
  if (!value) {
    error.value = 'A group needs a name'
    announce(error.value, true)
    return
  }
  const { group, members } = groupDialog.value
  if (group) {
    rename(group, value)
  } else {
    const created = create(value, members)
    // A new empty group opens, ready to be filled; one made from a selection stays out of the way
    if (!members.length) await navigateTo({ path: '/contacts', query: { ...route.query, group: created.id, c: undefined } })
  }
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="groupDialog.group ? 'Rename group' : 'New group'"
    :description="groupDialog.group
      ? undefined
      : groupDialog.members.length
        ? `With the ${peopleCount(groupDialog.members.length)} you selected. Groups are kept on this computer.`
        : 'Gather people you often write to together. Groups are kept on this computer.'"
    :ui="{ content: 'sm:max-w-sm', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <form
        id="contact-group-form"
        @submit.prevent="submit"
      >
        <UFormField
          label="Name"
          name="group-name"
          :error="error || undefined"
        >
          <UInput
            v-model="name"
            autofocus
            maxlength="60"
            placeholder="Team, Family, Book club…"
            class="w-full"
            @update:model-value="error = ''"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        type="submit"
        form="contact-group-form"
        :label="groupDialog.group ? 'Rename' : 'Create group'"
      />
    </template>
  </UModal>
</template>
