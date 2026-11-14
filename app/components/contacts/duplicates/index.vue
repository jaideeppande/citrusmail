<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const overlay = useOverlay()
const { groups, pending, progress, busy, stateOf, scan, skip, restore, merge } = useContactDuplicates()

// Looked for afresh each time it opens: the address book may have changed
watch(open, value => value && scan(), { immediate: true })

const REASONS: Record<DuplicateReason, string> = {
  email: 'Same email',
  name: 'Same name',
  phone: 'Same phone'
}

const description = computed(() => {
  if (!groups.value.length) return 'Contacts that share an email address, a name or a phone number.'
  return groups.value.length === 1
    ? '1 set of contacts looks like the same person.'
    : `${groups.value.length} sets of contacts look like the same person.`
})

// Merging deletes the copies from the address book, so it is asked first
async function confirmMerge(targets: DuplicateGroup[]) {
  if (busy.value || !targets.length) return

  const removed = targets.reduce((count, group) => count + group.contacts.length - 1, 0)
  const single = targets.length === 1 ? targets[0]! : undefined

  const ConfirmDialog = (await import('~/components/confirm-dialog/index.vue')).default
  const modal = overlay.create(ConfirmDialog, {
    props: {
      title: single ? `Merge into ${single.merged.name}?` : `Merge ${targets.length} sets of contacts?`,
      message: `${single ? `${single.contacts[0]!.name} takes everything the others hold` : 'The first contact of each set takes everything the others hold'}, and ${removed === 1 ? 'the other copy is' : `the ${removed} other copies are`} deleted from your address book on every device.`,
      confirmLabel: single ? 'Merge' : 'Merge all'
    }
  })

  if (await modal.open().result) await merge(targets)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Find duplicates"
    :description="description"
    :dismissible="!busy"
    :ui="{ content: 'sm:max-w-3xl', body: 'p-0 sm:p-0', footer: 'justify-between gap-3' }"
  >
    <template #body>
      <UEmpty
        v-if="!groups.length"
        icon="i-lucide-check-check"
        title="No duplicates found"
        description="Everyone in your address book is there once."
        variant="naked"
        class="py-10"
      />

      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="(group, index) in groups"
          :key="group.key"
          class="lb-stagger px-4 py-4 sm:px-6"
          :style="{ '--lb-i': index }"
        >
          <div class="flex items-center gap-2 min-h-7">
            <UBadge
              v-for="reason in group.reasons"
              :key="reason"
              :label="REASONS[reason]"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <span class="text-xs text-muted">{{ group.contacts.length }} contacts</span>

            <div class="ms-auto flex items-center gap-1">
              <template v-if="stateOf(group) === 'done'">
                <UIcon
                  name="i-lucide-check"
                  class="lb-mark-pop size-4 text-success"
                />
                <span class="text-sm text-muted">Merged</span>
              </template>
              <template v-else-if="stateOf(group) === 'skipped'">
                <span class="text-sm text-muted">Skipped</span>
                <UButton
                  label="Undo"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="busy"
                  @click="restore(group)"
                />
              </template>
              <template v-else>
                <span
                  v-if="stateOf(group) === 'failed'"
                  class="text-sm text-error"
                >Couldn’t merge</span>
                <UButton
                  label="Skip"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="busy"
                  @click="skip(group)"
                />
                <UButton
                  :label="stateOf(group) === 'failed' ? 'Try again' : 'Merge'"
                  icon="i-lucide-merge"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  :loading="stateOf(group) === 'merging'"
                  :disabled="busy"
                  @click="confirmMerge([group])"
                />
              </template>
            </div>
          </div>

          <!-- Once it is merged or skipped there is nothing left to weigh up,
            so the set folds away and leaves its line -->
          <Transition name="lb-collapse">
            <div v-if="!['done', 'skipped'].includes(stateOf(group))">
              <div class="min-h-0 overflow-hidden">
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-start gap-3 pt-3">
                  <div class="flex flex-col gap-2 min-w-0">
                    <ContactsDuplicateCard
                      v-for="(contact, position) in group.contacts"
                      :key="contact.id"
                      :contact="contact"
                      :label="position === 0 ? 'Kept' : 'Folded in, then deleted'"
                    />
                  </div>
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="hidden sm:block mt-8 size-4 text-dimmed"
                  />
                  <ContactsDuplicateCard
                    :contact="group.merged"
                    label="Becomes"
                    merged
                  />
                </div>
              </div>
            </div>
          </Transition>
        </li>
      </ul>
    </template>

    <template #footer>
      <div class="flex-1 min-w-0">
        <UProgress
          v-if="progress"
          :model-value="progress.done"
          :max="progress.total"
          size="sm"
          class="max-w-56"
        />
        <span
          v-else-if="groups.length"
          class="text-sm text-muted"
        >{{ pending.length ? `${pending.length} left to look at` : 'All looked at' }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          :label="pending.length ? 'Close' : 'Done'"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="open = false"
        />
        <UButton
          v-if="pending.length > 1"
          :label="`Merge all ${pending.length}`"
          icon="i-lucide-merge"
          :loading="busy"
          @click="confirmMerge(pending)"
        />
      </div>
    </template>
  </UModal>
</template>
