<script setup lang="ts">
import colors from 'tailwindcss/colors'
import type { CitrusMailTheme } from '~/utils/theme'

// A miniature of the app drawn in a theme: a slice of the sidebar, three
// messages (one unread, one selected) and the top of the reader with its
// main button. It wears the theme's own tokens on its root, so it can show
// light and dark side by side, or a preset that isn't chosen yet. Measured
// in pixels so it keeps its shape whatever the text size. Only a picture:
// hidden from screen readers and out of the tab order
const props = defineProps<{
  theme: CitrusMailTheme
  mode: 'light' | 'dark'
  /** The small one on a gallery card: the same parts, fewer words */
  compact?: boolean
}>()

const root = useTemplateRef<HTMLElement>('root')
defineExpose({ root })

const style = computed(() => themeVars(props.theme, props.mode, colors))

const ROWS = [
  { from: 'Maya Lin', subject: 'Draft for Thursday', snippet: 'I’ve put the numbers in the second tab', time: '9:41', unread: true },
  { from: 'Theo Park', subject: 'Re: Office move', snippet: 'Keys are at the front desk from Monday', time: '8:05', selected: true },
  { from: 'Billing', subject: 'Your receipt', snippet: 'Thanks for your payment of $24.00', time: 'Tue' }
]
const NAV = ['Inbox', 'Later', 'Sent', 'Drafts']
</script>

<template>
  <div
    ref="root"
    class="lb-theme-preview flex overflow-hidden select-none"
    :class="[mode, compact ? 'h-24 gap-1 rounded-md p-1' : 'h-64 gap-1.5 rounded-lg p-1.5']"
    :style="style"
    aria-hidden="true"
    inert
  >
    <!-- The sidebar, on the desk -->
    <div
      class="flex shrink-0 flex-col gap-0.5"
      :class="compact ? 'w-7 pt-1' : 'w-24 px-1 pt-1.5'"
    >
      <template v-if="compact">
        <span
          v-for="(item, index) in 3"
          :key="item"
          class="h-1.5 rounded-full"
          :class="index ? 'w-4 bg-(--ui-text-muted) opacity-50' : 'w-5 bg-(--ui-text-highlighted)'"
        />
      </template>
      <template v-else>
        <span class="mb-1.5 px-1.5 font-semibold text-(--ui-text-highlighted)">Mail</span>
        <span
          v-for="(item, index) in NAV"
          :key="item"
          class="flex items-center justify-between rounded-(--ui-radius) px-1.5 py-1"
          :class="index ? 'text-(--ui-text-muted)' : 'bg-(--ui-bg-accented) font-medium text-(--ui-text-highlighted)'"
        >
          {{ item }}
          <span
            v-if="!index"
            class="text-[10px] text-(--ui-text-muted)"
          >3</span>
        </span>
      </template>
    </div>

    <!-- The sheet: the list beside the reader -->
    <div class="lb-theme-preview-sheet flex min-w-0 flex-1 overflow-hidden">
      <div
        class="flex shrink-0 flex-col border-e border-(--ui-border)"
        :class="compact ? 'w-1/2' : 'w-[46%]'"
      >
        <div
          v-for="row in ROWS"
          :key="row.from"
          class="relative flex flex-col border-b border-(--ui-border)"
          :class="[compact ? 'gap-0.5 px-1.5 py-1.5' : 'gap-0.5 px-2.5 py-2', row.selected && 'bg-(--lb-selected)']"
        >
          <span
            v-if="row.selected"
            class="absolute inset-y-0 start-0 w-0.5 bg-(--lb-selected-edge)"
          />
          <template v-if="compact">
            <span class="flex items-center gap-1">
              <span
                class="size-1 shrink-0 rounded-full"
                :class="row.unread ? 'bg-(--lb-unread)' : 'bg-transparent'"
              />
              <span
                class="h-1 rounded-full"
                :class="row.unread ? 'w-8 bg-(--ui-text-highlighted)' : 'w-6 bg-(--ui-text)'"
              />
            </span>
            <span class="ms-2 h-1 w-10 rounded-full bg-(--ui-text-muted) opacity-60" />
          </template>
          <template v-else>
            <span class="flex items-center gap-1.5">
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="row.unread ? 'bg-(--lb-unread)' : 'bg-transparent'"
              />
              <span
                class="min-w-0 flex-1 truncate"
                :class="row.unread ? 'font-semibold text-(--ui-text-highlighted)' : 'text-(--ui-text)'"
              >{{ row.from }}</span>
              <span class="shrink-0 text-[10px] text-(--ui-text-muted)">{{ row.time }}</span>
            </span>
            <span
              class="truncate ps-3"
              :class="row.unread ? 'font-medium text-(--ui-text-highlighted)' : 'text-(--ui-text)'"
            >{{ row.subject }}</span>
            <span class="truncate ps-3 text-(--ui-text-muted)">{{ row.snippet }}</span>
          </template>
        </div>
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col"
        :class="compact ? 'gap-1 p-1.5' : 'gap-1.5 p-3'"
      >
        <template v-if="compact">
          <span class="h-1.5 w-3/4 rounded-full bg-(--ui-text-highlighted)" />
          <span class="h-1 w-1/2 rounded-full bg-(--ui-text-muted) opacity-60" />
          <span class="mt-auto h-3 w-8 rounded-(--ui-radius) bg-(--ui-primary)" />
        </template>
        <template v-else>
          <span class="text-[13px] leading-tight font-semibold text-(--ui-text-highlighted)">Re: Office move</span>
          <span class="text-(--ui-text-muted)">Theo Park · to you · 8:05</span>
          <span class="mt-1.5 text-(--ui-text)">Keys are at the front desk from Monday. The new room is on the third floor, past the kitchen.</span>
          <span class="mt-auto flex items-center gap-1.5">
            <UButton
              label="Reply"
              size="xs"
              tabindex="-1"
            />
            <UButton
              label="Archive"
              color="neutral"
              variant="outline"
              size="xs"
              tabindex="-1"
            />
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
