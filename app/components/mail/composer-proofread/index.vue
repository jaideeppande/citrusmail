<script setup lang="ts">
// Spelling and grammar corrections, waiting to be taken or left. Each
// changed paragraph shows with the old words struck through and the new
// ones underlined (not colour alone), and the same changes are listed as
// plain text, which is what a screen reader reads
const writing = useAiWriting()
const { proofreading } = writing
const { draft } = useComposer()

const proposal = computed(() => proofreading.value?.draftId === draft.value.id ? proofreading.value : undefined)
const changes = computed(() => proposal.value?.changed.flatMap(item => item.changes) ?? [])
const count = computed(() => Math.max(changes.value.length, proposal.value?.changed.length ?? 0))

const titleId = useId()
const accept = useTemplateRef('accept')
watch(proposal, (value, before) => {
  if (value && !before) nextTick(() => accept.value?.$el?.focus())
})

function change(item: { before: string, after: string }) {
  if (!item.after) return `Remove “${item.before}”`
  if (!item.before) return `Add “${item.after}”`
  return `“${item.before}” to “${item.after}”`
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  writing.dismissProofreading()
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="proposal">
      <section
        :aria-labelledby="titleId"
        class="border-b border-default bg-(--lb-ai-bg)"
        @keydown="onKey"
      >
        <header class="flex items-center gap-2 ps-5 pe-2 pt-2">
          <UIcon
            name="i-lucide-spell-check"
            class="size-4 shrink-0 text-(--lb-ai)"
          />
          <h3
            :id="titleId"
            class="flex-1 text-sm font-medium text-highlighted"
          >
            {{ count }} {{ count === 1 ? 'correction' : 'corrections' }}
            <span class="font-normal text-muted">· Suggested by AI</span>
          </h3>
          <UButton
            label="Dismiss"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="writing.dismissProofreading()"
          />
          <UButton
            ref="accept"
            label="Accept"
            icon="i-lucide-check"
            color="neutral"
            variant="subtle"
            size="xs"
            @click="writing.acceptProofreading()"
          />
        </header>

        <div
          class="max-h-36 space-y-1.5 overflow-y-auto px-5 pt-1.5 pb-1 text-sm leading-relaxed text-default"
          aria-hidden="true"
        >
          <p
            v-for="item in proposal.changed"
            :key="item.index"
          >
            <template
              v-for="(part, index) in item.parts"
              :key="index"
            >
              <del
                v-if="part.type === 'removed'"
                class="lb-diff-removed"
              >{{ part.text }}</del><ins
                v-else-if="part.type === 'added'"
                class="lb-diff-added"
              >{{ part.text }}</ins><span v-else>{{ part.text }}</span>{{ ' ' }}
            </template>
          </p>
        </div>

        <ul
          v-if="changes.length"
          aria-label="Changes"
          class="flex flex-wrap gap-x-3 gap-y-0.5 px-5 pb-2 text-xs text-muted"
        >
          <li
            v-for="(item, index) in changes"
            :key="index"
          >
            {{ change(item) }}
          </li>
        </ul>
        <p
          v-else
          class="px-5 pb-2 text-xs text-muted"
        >
          Only spacing changes
        </p>
      </section>
    </div>
  </Transition>
</template>
