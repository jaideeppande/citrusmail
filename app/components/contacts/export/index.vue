<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const { contacts, checked, group, exportScope } = useContactsPage()
const { isMember } = useContactGroups()

const format = ref<'vcf' | 'csv'>('vcf')

const scopes = computed(() => [
  { label: `All contacts (${contacts.value.length})`, value: 'all' },
  ...(group.value ? [{ label: `The group ${group.value.name}`, value: 'group', description: 'Everyone in it, including people who aren’t in your contacts' }] : []),
  ...(checked.value.length ? [{ label: `The ${checked.value.length} selected`, value: 'selection' }] : [])
])

// A group may hold people the address book never had: they go out with a name and an address
const people = computed<ContactDraft[]>(() => {
  if (exportScope.value === 'selection' && checked.value.length) return checked.value
  const current = group.value
  if (exportScope.value === 'group' && current) {
    const inBook = contacts.value.filter(contact => isMember(current, contact))
    const known = new Set(inBook.flatMap(contact => contact.emails.map(email => email.toLowerCase())))
    const others = current.members
      .filter(member => !known.has(member.address.toLowerCase()))
      .map(member => ({ name: member.name || member.address, emails: [member.address], phones: [] }))
    return [...inBook, ...others]
  }
  return contacts.value
})

// What was asked for may have gone (the group closed, the ticks cleared): fall back to everyone
watch(open, (value) => {
  if (value && !scopes.value.some(scope => scope.value === exportScope.value)) exportScope.value = 'all'
})

function download() {
  const list = people.value.map(({ name, emails, phones, company, title, note, birthday }) => ({ name, emails, phones, company, title, note, birthday }))
  const base = exportScope.value === 'group' && group.value ? fileSlug(group.value.name) : 'contacts'
  if (format.value === 'vcf') downloadFile(`${base}.vcf`, contactsToVCard(list), 'text/vcard;charset=utf-8')
  else downloadFile(`${base}.csv`, contactsToCsv(list), 'text/csv;charset=utf-8')
  announce(`Exported ${list.length === 1 ? '1 contact' : `${list.length} contacts`}`)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Export contacts"
    description="Saved as a file on this computer. Photos, groups and time zones stay here."
    :ui="{ content: 'sm:max-w-md', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <UFormField
          v-if="scopes.length > 1"
          label="Who"
        >
          <URadioGroup
            v-model="exportScope"
            :items="scopes"
            class="mt-1.5"
          />
        </UFormField>
        <UFormField label="Format">
          <URadioGroup
            v-model="format"
            :items="[
              { label: 'vCard (.vcf)', value: 'vcf', description: 'For Apple Contacts, Outlook, phones and other address books' },
              { label: 'CSV (.csv)', value: 'csv', description: 'For spreadsheets and Google Contacts' }
            ]"
            class="mt-1.5"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        icon="i-lucide-download"
        :label="people.length === 1 ? 'Export 1 contact' : `Export ${people.length} contacts`"
        :disabled="!people.length"
        @click="download"
      />
    </template>
  </UModal>
</template>
