<script setup lang="ts">
// One line of recipients in the composer (To, Cc or Bcc). The people you
// write to most, and most lately, come first in the suggestions
const props = defineProps<{
  label: string
  autofocus?: boolean
}>()

const model = defineModel<Address[]>({ required: true })

const toast = useToast()
const { contacts } = useContacts()
const { messages } = useMail()
const tally = useAccountPref<RecipientTally>('recipients', () => ({}))

const searchTerm = ref('')

interface Suggestion {
  label: string
  value: string
  description?: string
  address: Address
  score: number
}

// People written to from here, then contacts, then anyone in the loaded
// mail: one entry per address, the most written-to first
const suggestions = computed(() => {
  const now = Date.now()
  const seen = new Map<string, Suggestion>()
  const add = (address: string, name?: string) => {
    const key = address.toLowerCase()
    const before = seen.get(key)
    // A contact's name is better than the one a message happened to carry
    if (before) {
      if (!before.address.name && name) seen.set(key, { ...before, label: name, description: before.value, address: { name, address: before.value } })
      return
    }
    seen.set(key, { label: name || address, value: address, description: name ? address : undefined, address: { name, address }, score: recipientScore(tally.value[key], now) })
  }
  for (const contact of contacts.value) contact.emails.forEach(email => add(email, contact.name))
  for (const [address, stat] of Object.entries(tally.value)) add(address, stat.name)
  for (const message of messages.value) add(message.from.address, message.from.name)
  for (const address of model.value) add(address.address, address.name)
  // The sort is stable: among people never written to, contacts stay first
  return [...seen.values()].sort((a, b) => b.score - a.score)
})

const selected = computed({
  get: () => model.value.map(address => address.address),
  set: (values: string[]) => {
    model.value = values.map((value) => {
      const known = model.value.find(address => address.address === value)
      return known ?? suggestions.value.find(item => item.value === value)?.address ?? { address: value }
    })
  }
})

function nameFor(value: string) {
  return suggestions.value.find(item => item.value === value)?.label ?? value
}

function onCreate(term: string) {
  const parsed = parseAddresses(term)
  if (!parsed.length) {
    toast.add({ title: `“${term.trim()}” isn’t an email address`, color: 'warning', icon: 'i-lucide-at-sign' })
    return
  }
  model.value = [...model.value, ...parsed.filter(address => !selected.value.includes(address.address))]
  searchTerm.value = ''
}

// A pasted list ("ada@x.com, bob@y.com") goes straight in as chips
watch(searchTerm, (term) => {
  if (/[,;\s]/.test(term.trim()) && parseAddresses(term).length) onCreate(term)
})
</script>

<template>
  <MailComposerField :label="props.label">
    <UInputMenu
      v-model="selected"
      v-model:search-term="searchTerm"
      :items="suggestions"
      value-key="value"
      :filter-fields="['label', 'value']"
      multiple
      create-item
      :aria-label="label"
      variant="none"
      :autofocus="autofocus"
      :trailing-icon="false"
      class="flex-1"
      :ui="{ base: 'px-0 py-2 gap-1.5', tagsItem: 'lb-in-scale h-7 inline-flex items-center rounded-full bg-elevated ring-0 ps-0.5 pe-1 py-0 gap-1 text-sm leading-none font-medium text-highlighted', tagsItemText: 'inline-flex items-center', tagsItemDelete: 'inline-flex items-center justify-center size-5 rounded-full text-muted hover:text-highlighted hover:bg-accented transition-colors', tagsItemDeleteIcon: 'size-3.5', tagsInput: 'min-w-24', content: 'min-w-80' }"
      @create="onCreate"
      @blur="searchTerm.trim() && onCreate(searchTerm)"
    >
      <template #tags-item-text="{ item }">
        <span class="inline-flex items-center gap-1.5">
          <SenderAvatar
            :address="{ name: nameFor(String(item)), address: String(item) }"
            size="2xs"
          />
          {{ nameFor(String(item)) }}
        </span>
      </template>
      <template #item-leading="{ item }">
        <SenderAvatar
          :address="(item as { address: Address }).address"
          size="xs"
        />
      </template>
      <template #create-item-label="{ item }">
        Send to “{{ item }}”
      </template>
    </UInputMenu>
    <slot />
  </MailComposerField>
</template>
