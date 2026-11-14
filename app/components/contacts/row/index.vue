<script setup lang="ts">
const props = defineProps<{
  contact: Contact
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

const { isFavourite } = useContactFavourites()

const favourite = computed(() => isFavourite(props.contact.id))
</script>

<template>
  <!-- The star sits beside the row rather than in it: a button cannot hold
    another, and the row itself is one -->
  <div class="group relative">
    <UButton
      color="neutral"
      variant="ghost"
      :aria-current="selected || undefined"
      block
      class="lb-press justify-start gap-3 ps-3 pe-10 py-2 rounded-md font-normal"
      :class="selected ? 'bg-(--lb-selected) hover:bg-(--lb-selected) text-highlighted' : 'hover:bg-elevated/60'"
      @click="emit('select')"
    >
      <SenderAvatar
        :address="{ name: contact.name, address: contact.emails[0] ?? contact.name }"
        size="sm"
      />
      <span class="flex-1 min-w-0 text-start">
        <span class="block truncate font-medium">{{ contact.name }}</span>
        <span
          v-if="contact.company || contact.emails[0]"
          class="block truncate text-xs text-muted"
        >{{ contact.company || contact.emails[0] }}</span>
      </span>
    </UButton>

    <!-- Lit, it stays; unlit, it only shows to a pointer or the keyboard -->
    <ContactsStar
      :contact="contact"
      size="xs"
      class="absolute inset-e-1.5 top-1/2 -translate-y-1/2 transition-opacity duration-(--lb-dur-1)"
      :class="!favourite && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'"
    />
  </div>
</template>
