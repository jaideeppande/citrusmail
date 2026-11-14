<script setup lang="ts">
// Rest the pointer on a person in the reader and a card comes up: who they
// are, what your address book knows about them, and what you can do next
const props = defineProps<{
  address: Address
}>()

const route = useRoute()
const toast = useToast()
const { account } = useShell()
const { compose } = useComposer()
const { contacts, books, save } = useContacts()
const { search, filter, filters, folderPath } = useMail()
const { block, remove, isBlocked } = useSenders()
const { copy, copied } = useClipboard({ copiedDuring: 1400, legacy: true })

const open = ref(false)
const email = computed(() => props.address.address.toLowerCase())
const contact = computed(() => contacts.value.find(item => item.emails.some(value => value.toLowerCase() === email.value)))
const name = computed(() => contact.value?.name || personName(props.address))
const role = computed(() => [contact.value?.title, contact.value?.company].filter(Boolean).join(' · '))
const isSelf = computed(() => email.value === account.value?.email.toLowerCase())
const blocked = computed(() => isBlocked(props.address.address))

function write() {
  open.value = false
  compose([{ name: contact.value?.name ?? props.address.name, address: props.address.address }])
}

function openContact() {
  open.value = false
  if (contact.value) navigateTo({ path: '/contacts', query: { c: contact.value.id } })
}

// Straight into the first address book, with what the message says about them; the contacts page is where the rest is filled in
const adding = ref(false)
async function addContact() {
  const book = books.value[0]
  if (!book || adding.value) return
  adding.value = true
  const saved = await save({ id: '', bookId: book.id, name: personName(props.address), emails: [props.address.address], phones: [] })
  adding.value = false
  if (saved) tellWindows({ type: 'contacts:changed' })
}

async function searchMail() {
  open.value = false
  search.value = ''
  filter.value = 'all'
  filters.value = { from: props.address.address }
  if (!route.path.startsWith('/mail')) await navigateTo(folderLink(folderPath.value))
}

async function copyAddress() {
  await copy(props.address.address)
  if (!copied.value) toast.add({ title: 'Couldn’t copy', description: props.address.address, color: 'error', icon: 'i-lucide-circle-alert' })
}
</script>

<template>
  <UPopover
    v-model:open="open"
    mode="hover"
    :open-delay="350"
    :close-delay="120"
    :content="{ align: 'start', side: 'bottom', sideOffset: 6 }"
    :ui="{ content: 'bg-transparent ring-0 shadow-none overflow-visible' }"
  >
    <slot />

    <template #content>
      <Transition
        name="lb-pop"
        appear
      >
        <div class="w-72 origin-top-left rounded-lg bg-default ring ring-default shadow-lg p-3">
          <div class="flex items-start gap-3">
            <SenderAvatar
              :address="address"
              size="xl"
            />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-highlighted truncate">
                {{ name }}
              </p>
              <p
                v-if="role"
                class="text-xs text-muted truncate"
              >
                {{ role }}
              </p>
              <UTooltip :text="copied ? 'Copied' : 'Copy address'">
                <UButton
                  :label="address.address"
                  :trailing-icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                  color="neutral"
                  variant="link"
                  size="xs"
                  class="p-0 max-w-full text-muted"
                  :ui="{ label: 'truncate', trailingIcon: copied ? 'size-3 text-primary' : 'size-3' }"
                  @click="copyAddress"
                />
              </UTooltip>
            </div>
          </div>

          <dl
            v-if="contact?.phones.length"
            class="mt-2.5 flex flex-col gap-1 text-sm"
          >
            <div
              v-for="phone in contact.phones.slice(0, 2)"
              :key="phone"
              class="flex items-center gap-2 text-toned"
            >
              <dt class="shrink-0">
                <UIcon
                  name="i-lucide-phone"
                  class="block size-3.5 text-dimmed"
                />
                <span class="sr-only">Phone</span>
              </dt>
              <dd class="truncate tabular-nums">
                {{ phone }}
              </dd>
            </div>
          </dl>

          <div class="mt-3 pt-2 border-t border-default flex flex-col">
            <UButton
              label="New message"
              icon="i-lucide-square-pen"
              color="neutral"
              variant="ghost"
              size="sm"
              class="justify-start lb-press"
              @click="write"
            />
            <template v-if="account?.hasContacts">
              <UButton
                v-if="contact"
                label="Open contact"
                icon="i-lucide-book-user"
                color="neutral"
                variant="ghost"
                size="sm"
                class="justify-start lb-press"
                @click="openContact"
              />
              <UButton
                v-else-if="books.length && !isSelf"
                label="Add to contacts"
                icon="i-lucide-user-round-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                class="justify-start lb-press"
                :loading="adding"
                @click="addContact"
              />
            </template>
            <UButton
              label="Search their mail"
              icon="i-lucide-search"
              color="neutral"
              variant="ghost"
              size="sm"
              class="justify-start lb-press"
              @click="searchMail"
            />
            <UButton
              v-if="account?.protocol !== 'pop3' && !isSelf"
              :label="blocked ? 'Unblock sender' : 'Block sender'"
              :icon="blocked ? 'i-lucide-shield-off' : 'i-lucide-ban'"
              :color="blocked ? 'neutral' : 'error'"
              variant="ghost"
              size="sm"
              class="justify-start lb-press"
              @click="blocked ? remove(address.address) : block(address.address)"
            />
          </div>
        </div>
      </Transition>
    </template>
  </UPopover>
</template>
