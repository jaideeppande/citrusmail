<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { MailLabel } from '~/utils/labels'

// Labels in the sidebar. Choosing one narrows the open folder to the
// messages that carry it; choosing it again shows everything
defineProps<{
  collapsed?: boolean
}>()

const { labels, counts, update, remove } = useLabels()
const { labelFilter } = useMail()

const renaming = ref<string>()
const name = ref('')
function startRename(label: MailLabel) {
  renaming.value = label.id
  name.value = label.name
}
function finishRename() {
  if (renaming.value && name.value.trim()) update(renaming.value, { name: name.value })
  renaming.value = undefined
}

const menu = (label: MailLabel): DropdownMenuItem[][] => [[
  { label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => startRename(label) }
], LABEL_COLORS.map(color => ({
  label: color.charAt(0).toUpperCase() + color.slice(1),
  type: 'checkbox' as const,
  checked: label.color === color,
  slot: 'color' as const,
  swatch: color,
  onSelect: () => update(label.id, { color })
})), [
  { label: 'Delete label', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(label.id) }
]]

function choose(label: MailLabel) {
  labelFilter.value = labelFilter.value === label.id ? undefined : label.id
  announce(labelFilter.value ? `Showing messages labelled ${label.name}` : 'Showing every message')
}

const colorOf = (item: unknown) => labelVar((item as { swatch: MailLabel['color'] }).swatch)
</script>

<template>
  <section
    v-if="labels.length"
    aria-label="Labels"
    class="flex flex-col gap-0.5"
  >
    <h2
      v-if="!collapsed"
      class="px-2.5 pb-1 text-xs font-medium text-muted"
    >
      Labels
    </h2>
    <ul class="flex flex-col gap-0.5">
      <li
        v-for="label in labels"
        :key="label.id"
        class="group relative"
      >
        <form
          v-if="renaming === label.id"
          class="px-1"
          @submit.prevent="finishRename"
        >
          <UInput
            v-model="name"
            size="sm"
            maxlength="40"
            autofocus
            :aria-label="`Rename ${label.name}`"
            @blur="finishRename"
            @keydown.escape.stop="renaming = undefined"
          />
        </form>
        <template v-else>
          <UTooltip
            :text="label.name"
            :disabled="!collapsed"
            :content="{ side: 'right' }"
          >
            <UButton
              color="neutral"
              :variant="labelFilter === label.id ? 'soft' : 'ghost'"
              size="sm"
              :square="collapsed"
              :aria-label="collapsed ? label.name : undefined"
              :aria-pressed="labelFilter === label.id"
              class="w-full justify-start gap-2.5 px-2.5 font-medium"
              :class="[labelFilter === label.id ? 'text-highlighted' : 'text-muted hover:text-highlighted', collapsed && 'justify-center px-0']"
              @click="choose(label)"
            >
              <span
                class="size-2.5 rounded-full shrink-0 mx-[3px]"
                :style="{ background: labelVar(label.color) }"
                aria-hidden="true"
              />
              <span
                v-if="!collapsed"
                class="flex-1 truncate text-start"
              >{{ label.name }}</span>
              <span
                v-if="!collapsed && counts.get(label.id)"
                class="text-xs tabular-nums text-muted group-hover:invisible group-focus-within:invisible"
              >{{ counts.get(label.id) }}</span>
            </UButton>
          </UTooltip>
          <UDropdownMenu
            v-if="!collapsed"
            :items="menu(label)"
            :content="{ align: 'start', side: 'right' }"
          >
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="link"
              size="xs"
              :aria-label="`Options for ${label.name}`"
              class="absolute end-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 transition-opacity text-muted"
            />
            <template #color-leading="{ item }">
              <span
                class="size-2.5 rounded-full"
                :style="{ background: colorOf(item) }"
                aria-hidden="true"
              />
            </template>
          </UDropdownMenu>
        </template>
      </li>
    </ul>
  </section>
</template>
