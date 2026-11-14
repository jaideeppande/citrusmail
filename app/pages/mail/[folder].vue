<script setup lang="ts">
definePageMeta({
  // One mounted page for every folder, so switching folders keeps the panes
  // in place and only the list reloads
  key: 'mail'
})

const { folder, selectedId, selectedFolder } = useMail()
const { view, listWidth } = useMailLayout()
const { isMobile } = useShell()
const { focus } = useWindowChrome()

useSeoMeta({ title: () => folder.value?.name ?? 'Mail' })

// A message found by AI search can live in another folder; the route keeps
// which, so leaving the search doesn't open a namesake here
const readerFolder = selectedFolder

const readerOpen = computed({
  get: () => !!selectedId.value,
  set: (open) => {
    if (!open) selectedId.value = undefined
  }
})

// Focus mode leaves only the open message: the list steps aside as if this were the list-only view
const split = computed(() => !isMobile.value && view.value === 'split' && !(focus.value && selectedId.value))
</script>

<template>
  <div class="relative flex-1 flex min-w-0">
    <MailSnoozePicker />

    <MailListPanel
      v-show="split || isMobile || !selectedId"
      class="shrink-0"
      :class="split ? 'w-(--list-width)' : 'flex-1 min-w-0'"
      :style="{ '--list-width': `${listWidth}px` }"
    />

    <template v-if="split">
      <MailResizeHandle />
      <MailReader
        v-if="selectedId"
        :id="selectedId"
        :key="`${readerFolder}/${selectedId}`"
        :folder="readerFolder"
        class="flex-1"
      />
      <MailEmpty
        v-else
        class="flex-1"
      />
    </template>

    <!-- List view: the message takes the whole sheet, Escape or Back returns to the list -->
    <MailReader
      v-else-if="!isMobile && selectedId"
      :id="selectedId"
      :key="`${readerFolder}/${selectedId}`"
      :folder="readerFolder"
      class="flex-1 lb-reader-enter"
      back
    />

    <USlideover
      v-else-if="isMobile"
      v-model:open="readerOpen"
      side="right"
      :ui="{ content: 'max-w-none' }"
    >
      <template #content>
        <MailReader
          v-if="selectedId"
          :id="selectedId"
          :key="`${readerFolder}/${selectedId}`"
          :folder="readerFolder"
          class="h-full"
        />
      </template>
    </USlideover>
  </div>
</template>
