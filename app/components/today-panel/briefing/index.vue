<script setup lang="ts">
import type { BriefingBullet } from '~/utils/ai-calendar'

// The day's briefing, first thing in the Today panel. Each point that is
// about one message or event is a button that opens it
const emit = defineEmits<{
  navigate: []
}>()

const briefing = useAiBriefing()
const { revealEvent } = useEventEditor()

// Written on the panel's first opening of the day; the AI may only turn up
// a moment after the panel does
watch(briefing.on, on => on && briefing.ensureToday(), { immediate: true })

const now = useNow({ interval: 60_000 })
const written = computed(() => {
  const at = briefing.current.value?.at
  if (!at) return ''
  const minutes = Math.floor((now.value.getTime() - at) / 60_000)
  return minutes < 1 ? 'Written just now' : `Written at ${formatTime(new Date(at))}`
})

async function open(bullet: BriefingBullet) {
  const target = bullet.target
  if (!target) return
  emit('navigate')
  if (target.kind === 'message') {
    await navigateTo(`${folderLink(target.folder)}?m=${encodeURIComponent(target.id)}`)
    return
  }
  const start = new Date(target.start)
  await navigateTo(`/calendar/day/${toCalendarDate(start).toString()}`)
  revealEvent(target.id)
}
</script>

<template>
  <section
    v-if="briefing.on.value"
    class="relative -mx-1 flex flex-col gap-1.5 overflow-hidden rounded-lg bg-(--lb-ai-bg) px-3 py-2.5"
    aria-labelledby="today-briefing-title"
    :aria-busy="briefing.busy.value"
  >
    <span
      v-if="briefing.busy.value"
      class="lb-ai-progress absolute inset-x-0 top-0 h-px"
      aria-hidden="true"
    />
    <header class="flex items-center gap-2">
      <UIcon
        name="i-lucide-sparkles"
        class="size-3.5 text-(--lb-ai)"
        aria-hidden="true"
      />
      <h3
        id="today-briefing-title"
        class="text-xs font-semibold text-highlighted"
      >
        Briefing
      </h3>
      <span
        v-if="written && !briefing.busy.value"
        class="text-xs text-muted"
      >{{ written }}</span>
      <UTooltip text="Write it again">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Refresh briefing"
          class="ms-auto -me-1.5"
          :loading="briefing.busy.value"
          @click="briefing.generate()"
        />
      </UTooltip>
    </header>

    <p
      v-if="briefing.busy.value && !briefing.current.value"
      class="text-sm text-muted"
    >
      Reading your mail and today’s calendar<span class="lb-ai-dots" />
    </p>

    <p
      v-else-if="briefing.error.value && !briefing.current.value"
      class="text-sm text-muted"
    >
      {{ briefing.error.value }}
    </p>

    <ul
      v-else-if="briefing.current.value"
      class="-mx-1.5 flex flex-col"
    >
      <li
        v-for="(bullet, index) in briefing.current.value.bullets"
        :key="index"
        class="lb-stagger"
        :style="{ '--lb-i': index }"
      >
        <button
          v-if="bullet.target"
          type="button"
          class="lb-press lb-focus group flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-start text-sm text-default hover:bg-elevated/60"
          :aria-label="`${bullet.text} Opens ${bullet.target.kind === 'message' ? 'the message' : 'the event'} “${bullet.target.label}”`"
          @click="open(bullet)"
        >
          <UIcon
            :name="bullet.target.kind === 'message' ? 'i-lucide-mail' : 'i-lucide-calendar'"
            class="mt-0.5 size-3.5 shrink-0 text-muted group-hover:text-(--lb-ai)"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">{{ bullet.text }}</span>
        </button>
        <p
          v-else
          class="flex items-start gap-2 px-1.5 py-1 text-sm text-default"
        >
          <span
            class="mt-2 size-1 shrink-0 rounded-full bg-(--lb-ai)"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">{{ bullet.text }}</span>
        </p>
      </li>
    </ul>

    <p
      v-else
      class="text-sm text-muted"
    >
      A few lines on what needs you today.
      <UButton
        label="Write it now"
        color="neutral"
        variant="link"
        size="sm"
        class="p-0"
        @click="briefing.generate()"
      />
    </p>

    <p
      v-if="briefing.error.value && briefing.current.value"
      class="text-xs text-muted"
    >
      {{ briefing.error.value }}
    </p>
  </section>
</template>
