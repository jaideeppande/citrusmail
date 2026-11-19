<script setup lang="ts">
import type { LaterColumn } from '~/composables/useLaterBoard'

// The Later board: mail as cards in three columns
useSeoMeta({ title: 'Later' })

const board = useLaterBoard()
const { isSidebarOpen } = useShell()

const over = ref<LaterColumn>()
function onDragOver(event: DragEvent, column: LaterColumn) {
  if (!event.dataTransfer?.types.includes(LATER_DRAG_TYPE)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  over.value = column
}
function onDrop(event: DragEvent, column: LaterColumn) {
  over.value = undefined
  const key = event.dataTransfer?.getData(LATER_DRAG_TYPE)
  if (!key) return
  event.preventDefault()
  // Onto a card: in front of it. Onto the column: at its end
  const before = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-later-card]')?.dataset.laterCard
  board.move(key, column, before)
}
</script>

<template>
  <section class="flex-1 min-w-0 flex flex-col">
    <header class="shrink-0 flex items-center gap-2 h-14 px-4 border-b border-default">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="lg:hidden shrink-0 -ms-1.5"
        @click="isSidebarOpen = true"
      />
      <h1 class="text-lg font-bold tracking-tight text-highlighted">
        Later
      </h1>
      <p class="text-sm text-muted max-md:hidden">
        Kept on this computer. A card points at a message, which stays in its folder.
      </p>
    </header>

    <AppEmpty
      v-if="!board.cards.value.length"
      illustration="later-empty"
      title="Nothing set aside"
      description="Right-click a message and choose Add to Later, or drag it onto Later in the sidebar, to keep it here until it’s dealt with."
      :actions="[{ label: 'Go to the Inbox', icon: 'i-lucide-inbox', to: '/mail/INBOX' }]"
      class="flex-1"
    />

    <div
      v-else
      class="flex-1 min-h-0 grid grid-cols-3 gap-3 p-4 overflow-x-auto"
    >
      <section
        v-for="(column, index) in LATER_COLUMNS"
        :key="column.id"
        :aria-labelledby="`later-${column.id}`"
        class="min-w-56 flex flex-col min-h-0 rounded-xl bg-elevated/50 transition-colors duration-(--lb-dur-1) lb-stagger"
        :class="over === column.id && 'bg-primary/8 ring-1 ring-primary/40'"
        :style="{ '--lb-i': index }"
        @dragover="onDragOver($event, column.id)"
        @dragleave="over = undefined"
        @drop="onDrop($event, column.id)"
      >
        <header class="shrink-0 flex items-center gap-2 px-3 h-10">
          <UIcon
            :name="column.icon"
            class="size-4 text-muted"
          />
          <h2
            :id="`later-${column.id}`"
            class="text-sm font-semibold text-highlighted"
          >
            {{ column.label }}
          </h2>
          <span class="text-xs text-muted tabular-nums">{{ board.column(column.id).length }}</span>
          <UButton
            v-if="column.id === 'done' && board.column('done').length"
            label="Clear"
            color="neutral"
            variant="ghost"
            size="xs"
            class="ms-auto"
            @click="board.clearDone()"
          />
        </header>

        <TransitionGroup
          name="lb-list"
          tag="ul"
          class="relative flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 px-2 pb-2"
        >
          <LaterCard
            v-for="card in board.column(column.id)"
            :key="card.key"
            :card="card"
          />
          <li
            v-if="!board.column(column.id).length"
            key="empty"
            class="px-2 py-6 text-center text-xs text-muted"
          >
            {{ column.hint }}
          </li>
        </TransitionGroup>
      </section>
    </div>
  </section>
</template>
