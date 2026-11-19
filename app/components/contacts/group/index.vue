<script setup lang="ts">
import type { ContactGroup } from '~/composables/useContactExtras'

// A group’s own page, beside the list filtered to it: everyone in it (also
// those who are not, or no longer, in the address book), and what can be
// done with all of them at once
const props = defineProps<{
  group: ContactGroup
}>()

const { contacts, selectedId, openGroupDialog, confirmRemoveGroup, openExport, openCreate } = useContactsPage()
const { write, removeMembers } = useContactGroups()
const { copy, copied } = useClipboard({ copiedDuring: 1500, legacy: true })
const toast = useToast()

const heading = useTemplateRef('heading')
onMounted(() => heading.value?.focus({ preventScroll: true }))

const byAddress = computed(() => {
  const map = new Map<string, Contact>()
  for (const contact of contacts.value) {
    for (const email of contact.emails) map.set(email.toLowerCase(), contact)
  }
  return map
})

const members = computed(() => props.group.members
  .map(member => ({ member, contact: byAddress.value.get(member.address.toLowerCase()) }))
  .sort((a, b) => (a.contact?.name ?? a.member.name ?? a.member.address).localeCompare(b.contact?.name ?? b.member.name ?? b.member.address, undefined, { sensitivity: 'base' })))

const outside = computed(() => members.value.filter(item => !item.contact).length)

async function copyAddresses() {
  const text = props.group.members.map(formatAddress).join(', ')
  await copy(text)
  if (copied.value) announce(`Copied ${peopleCount(props.group.members.length)}’s addresses`)
  else toast.add({ title: 'Couldn’t copy', color: 'error', icon: 'i-lucide-circle-alert' })
}
</script>

<template>
  <article
    class="flex min-h-0 flex-col bg-default"
    aria-labelledby="contact-group-name"
  >
    <header class="flex h-12 shrink-0 items-center gap-1 px-3">
      <div class="ms-auto flex items-center gap-1">
        <UButton
          icon="i-lucide-pencil"
          label="Rename"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="openGroupDialog(group)"
        />
        <UTooltip text="Export group">
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Export group"
            :disabled="!group.members.length"
            @click="openExport('group')"
          />
        </UTooltip>
        <UTooltip text="Delete group">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Delete group"
            @click="confirmRemoveGroup(group)"
          />
        </UTooltip>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-xl flex-col gap-8 px-8 pt-6 pb-12">
        <div class="flex flex-col gap-1">
          <p class="text-xs font-medium text-muted">
            Group
          </p>
          <h1
            id="contact-group-name"
            ref="heading"
            tabindex="-1"
            class="text-2xl font-semibold tracking-tight text-highlighted outline-none"
          >
            {{ group.name }}
          </h1>
          <p class="text-sm text-muted">
            {{ peopleCount(group.members.length) }}<template v-if="outside">
              · {{ outside }} not in your contacts
            </template>
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UButton
              icon="i-lucide-square-pen"
              label="Write to everyone"
              size="sm"
              class="lb-press"
              :disabled="!group.members.length"
              @click="write(group)"
            />
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copied' : 'Copy addresses'"
              color="neutral"
              variant="subtle"
              size="sm"
              :disabled="!group.members.length"
              @click="copyAddresses"
            />
          </div>
        </div>

        <section aria-labelledby="contact-group-members">
          <h2
            id="contact-group-members"
            class="pb-1.5 text-xs font-semibold text-muted"
          >
            Members
          </h2>
          <p
            v-if="!members.length"
            class="py-3 text-sm text-muted"
          >
            Nobody yet. Drag people onto the group in the sidebar, tick several in the list and choose “Add to group”, or add them from a contact’s page.
          </p>
          <TransitionGroup
            v-else
            tag="ul"
            name="lb-list"
            class="flex flex-col"
          >
            <li
              v-for="{ member, contact } in members"
              :key="member.address"
              class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50"
            >
              <SenderAvatar
                :address="{ name: contact?.name ?? member.name, address: member.address }"
                size="sm"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">{{ contact?.name ?? member.name ?? member.address }}</span>
                <span class="block truncate text-xs text-muted">{{ member.address }}</span>
              </span>
              <UButton
                v-if="contact"
                label="Open"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Open ${contact.name}`"
                @click="selectedId = contact.id"
              />
              <UButton
                v-else
                label="Add to contacts"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Add ${member.name || member.address} to contacts`"
                @click="openCreate({ name: member.name ?? '', emails: [member.address] })"
              />
              <UTooltip :text="`Remove from ${group.name}`">
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Remove ${contact?.name ?? member.name ?? member.address} from ${group.name}`"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  @click="removeMembers(group, [member])"
                />
              </UTooltip>
            </li>
          </TransitionGroup>
        </section>
      </div>
    </div>
  </article>
</template>
