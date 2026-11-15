<script setup lang="ts">
// The favourite star, on a list row and on the detail header alike: a
// toggle button, so its name stays put and `aria-pressed` says whether it is
// on. The tooltip renders no element of its own, so what the caller passes
// goes to the button by hand
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  contact: Contact
  size?: 'xs' | 'sm' | 'md'
}>()

const { isFavourite, toggle } = useContactFavourites()

const favourite = computed(() => isFavourite(props.contact.id))

// Only a star that was just pressed pops: one drawn already lit, as the list
// scrolls or the page loads, has nothing to answer
const popped = ref(false)

function onClick() {
  toggle(props.contact.id)
  popped.value = true
  announce(favourite.value ? `${props.contact.name} added to favourites` : `${props.contact.name} removed from favourites`)
}
</script>

<template>
  <UTooltip :text="favourite ? 'Remove from favourites' : 'Add to favourites'">
    <UButton
      v-bind="$attrs"
      color="neutral"
      variant="ghost"
      :size="size ?? 'md'"
      :aria-label="`Favourite ${contact.name}`"
      :aria-pressed="favourite"
      @click.stop="onClick"
    >
      <UIcon
        :key="String(favourite)"
        :name="favourite ? 'i-ph-star-fill' : 'i-ph-star'"
        class="size-4"
        :class="[favourite ? 'text-warning' : 'text-muted', popped && 'lb-mark-pop']"
        aria-hidden="true"
      />
    </UButton>
  </UTooltip>
</template>
