<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'

// The context menu wraps the row and renders nothing of its own, so the
// list's stagger class and style go to the <li> by hand
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  contact: Contact
  selected: boolean
  /** The row the keyboard is on: the only one in the tab order */
  active: boolean
}>()

const emit = defineEmits<{
  select: []
  focus: []
}>()

const { isFavourite, toggle } = useContactFavourites()
const { isChecked, toggleCheck, checkedIds, checked, openEdit, confirmRemove } = useContactsPage()
const { groups, addContacts, isMember } = useContactGroups()
const { openGroupDialog } = useContactsPage()
const { compose } = useComposer()

const favourite = computed(() => isFavourite(props.contact.id))
const ticked = computed(() => isChecked(props.contact))
// Once anything is ticked every row shows its box, as the mail list does
const checking = computed(() => checkedIds.value.length > 0)
const secondary = computed(() => props.contact.company || props.contact.emails[0])

const menu = computed<ContextMenuItem[][]>(() => [[
  ...(props.contact.emails[0] ? [{ label: 'Write', icon: 'i-lucide-square-pen', onSelect: () => compose([{ name: props.contact.name, address: props.contact.emails[0]! }]) }] : []),
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(props.contact) }
], [
  {
    label: 'Add to group',
    icon: 'i-lucide-users',
    children: [
      groups.value.map(group => ({
        label: group.name,
        ...(isMember(group, props.contact) ? { trailingIcon: 'i-lucide-check' } : {}),
        onSelect: () => void addContacts(group, targets())
      })),
      [{ label: 'New group…', icon: 'i-lucide-plus', onSelect: () => openGroupDialog(undefined, targets().map(contactMember).filter((member): member is Address => !!member)) }]
    ].filter(section => section.length)
  },
  { label: favourite.value ? 'Remove from favourites' : 'Add to favourites', icon: favourite.value ? 'i-ph-star-fill' : 'i-ph-star', onSelect: () => toggle(props.contact.id) },
  { label: ticked.value ? 'Deselect' : 'Select', icon: 'i-lucide-square-check', onSelect: () => toggleCheck(props.contact) }
], [
  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => confirmRemove(props.contact) }
]])

// This row, or every ticked row when it is one of them
function targets(): Contact[] {
  return ticked.value ? checked.value : [props.contact]
}

const dragging = ref(false)
function onDragStart(event: DragEvent) {
  if (!event.dataTransfer) return
  const people = targets()
  const members = people.map(contactMember).filter((member): member is Address => !!member)
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(CONTACT_DRAG_TYPE, JSON.stringify(members))
  event.dataTransfer.setData('text/plain', members.map(formatAddress).join(', '))
  const ghost = document.createElement('div')
  ghost.className = 'lb-drag-ghost'
  ghost.textContent = people.length === 1 ? props.contact.name : `${people.length} people`
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 12, 12)
  setTimeout(() => ghost.remove())
  dragging.value = true
}
</script>

<template>
  <UContextMenu :items="menu">
    <li
      v-bind="$attrs"
      class="group relative"
      draggable="true"
      :data-contact-dragging="dragging || undefined"
      @dragstart="onDragStart"
      @dragend="dragging = false"
    >
      <button
        type="button"
        data-contact-row
        :data-initial="initialOf(contact.name)"
        :tabindex="active ? 0 : -1"
        :aria-current="selected || undefined"
        :aria-label="[contact.name, secondary, favourite && 'favourite', ticked && 'selected'].filter(Boolean).join(', ')"
        class="lb-focus flex w-full items-center gap-3 rounded-md py-1.5 ps-2.5 pe-9 text-start transition-colors duration-(--lb-dur-1)"
        :class="ticked ? 'bg-primary/8 hover:bg-primary/10' : selected ? 'bg-(--lb-selected) text-highlighted hover:bg-(--lb-selected)' : 'hover:bg-elevated/60'"
        @click="emit('select')"
        @focus="emit('focus')"
      >
        <span
          class="transition-opacity duration-(--lb-dur-1)"
          :class="checking || ticked ? 'opacity-0' : 'group-hover:opacity-0'"
          aria-hidden="true"
        >
          <SenderAvatar
            :address="{ name: contact.name, address: contact.emails[0] ?? contact.name }"
            size="sm"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-highlighted">{{ contact.name }}</span>
          <span
            v-if="secondary"
            class="block truncate text-xs text-muted"
          >{{ secondary }}</span>
        </span>
      </button>

      <!-- A real checkbox laid over the avatar rather than inside the row:
        a control cannot sit inside a button -->
      <button
        type="button"
        role="checkbox"
        :aria-checked="ticked"
        :aria-label="`Select ${contact.name}`"
        :tabindex="active ? 0 : -1"
        class="lb-focus absolute start-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full transition-opacity duration-(--lb-dur-1)"
        :class="checking || ticked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'"
        @click.stop="toggleCheck(contact)"
      >
        <span
          class="grid size-4.5 place-items-center rounded-[calc(var(--ui-radius)*0.75)] shadow-[inset_0_0_0_1.5px_var(--ui-border-accented)] transition-colors duration-(--lb-dur-1)"
          :class="ticked ? 'bg-primary text-inverted shadow-none' : 'bg-default text-transparent hover:shadow-[inset_0_0_0_1.5px_var(--ui-primary)]'"
        >
          <UIcon
            name="i-lucide-check"
            class="size-3.5"
          />
        </span>
      </button>

      <!-- Lit, it stays; unlit, it only shows to a pointer or the keyboard -->
      <ContactsStar
        :contact="contact"
        size="xs"
        :tabindex="active ? 0 : -1"
        class="absolute inset-e-1.5 top-1/2 -translate-y-1/2 transition-opacity duration-(--lb-dur-1)"
        :class="!favourite && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'"
      />
    </li>
  </UContextMenu>
</template>
