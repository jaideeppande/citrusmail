<script setup lang="ts">
import type { ShortcutId, ShortcutPreset } from '~/utils/shortcuts'

// Settings → Shortcuts: pick a set of keys, then make any of them your own.
// A change is recorded by pressing the key, not by spelling it
const { prefs, keysOf, clash, rebind } = useShortcutKeys()

const PRESETS = (Object.keys(SHORTCUT_PRESETS) as ShortcutPreset[]).map(value => ({ value, label: SHORTCUT_PRESETS[value].label, description: SHORTCUT_PRESETS[value].description }))
const preset = computed({
  get: () => prefs.value.preset,
  set: (value: ShortcutPreset) => (prefs.value = { ...prefs.value, preset: value })
})

const search = ref('')
const groups = computed(() => {
  const query = search.value.trim().toLowerCase()
  const byGroup = new Map<string, { id: ShortcutId, label: string, keys: string[], custom: boolean }[]>()
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const { group, label } = SHORTCUTS[id]
    const keys = keysOf(id)
    // A search finds a shortcut by what it does, where it is, or its key
    if (query && ![label, group, ...keys.map(key => shortcutParts(key).join(' '))].some(text => text.toLowerCase().includes(query))) continue
    byGroup.set(group, [...(byGroup.get(group) ?? []), { id, label, keys, custom: !!prefs.value.custom[id] }])
  }
  return [...byGroup].map(([title, items]) => ({ title, items }))
})
const changed = computed(() => Object.keys(prefs.value.custom).length)

/** The shortcut waiting for its new key */
const recording = ref<ShortcutId>()
/** The first key of what may become a sequence, such as the g of g then i */
const pending = ref('')
/** A recorded key that another shortcut already has */
const conflict = ref<{ id: ShortcutId, key: string, other: ShortcutId }>()
let timer: ReturnType<typeof setTimeout> | undefined

/** How long a second key has to arrive to make a sequence */
const SEQUENCE = 1000
/** Only plain single keys chain: g then i, never Ctrl+K then something */
const chains = (key: string) => key.length === 1 && key !== '-' && key !== '_'

function record(id: ShortcutId) {
  cancel()
  recording.value = id
  announce(`Press the new key for ${SHORTCUTS[id].label}. Escape cancels.`)
}

function cancel() {
  clearTimeout(timer)
  recording.value = undefined
  pending.value = ''
  conflict.value = undefined
}

function commit(key: string) {
  const id = recording.value
  clearTimeout(timer)
  recording.value = undefined
  pending.value = ''
  if (!id) return
  const other = clash(id, key)
  if (other) {
    conflict.value = { id, key, other }
    announce(`${keyName(key)} is already ${SHORTCUTS[other].label}. Use it anyway, or cancel.`, true)
  } else {
    rebind(id, [key])
    announce(`${SHORTCUTS[id].label} is now ${keyName(key)}`)
  }
}

/** The key moves here; the shortcut that had it keeps its other keys, if it has any */
function useAnyway() {
  if (!conflict.value) return
  const { id, key, other } = conflict.value
  rebind(other, keysOf(other).filter(item => item !== key))
  rebind(id, [key])
  conflict.value = undefined
  announce(`${SHORTCUTS[id].label} is now ${keyName(key)}`)
}

function resetAll() {
  cancel()
  prefs.value = { ...prefs.value, custom: {} }
  announce('Every key is back to the preset’s')
}

// Caught before anything else hears it, so the key being recorded doesn't
// also archive a message or open the palette
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!recording.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    cancel()
    return announce('Cancelled. The key is unchanged.')
  }
  const key = keyFromEvent(event)
  if (!key) return
  if (pending.value) return commit(chains(key) ? `${pending.value}-${key}` : key)
  if (!chains(key)) return commit(key)
  pending.value = key
  timer = setTimeout(() => commit(key), SEQUENCE)
}, { capture: true })

// Clicking anywhere else is a change of mind
useEventListener(window, 'pointerdown', () => recording.value && cancel(), { capture: true })
onBeforeUnmount(() => clearTimeout(timer))

/** Said under the row whose new key belongs to another shortcut */
const warning = computed(() => {
  if (!conflict.value) return ''
  const other = SHORTCUTS[conflict.value.other].label
  return `${keyName(conflict.value.key)} is already “${other}”. Use it here and ${other} gives it up.`
})

const keyName = (key: string) => shortcutParts(key).map(part => part === 'meta' ? (isMac() ? '⌘' : 'Ctrl') : part.length === 1 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)).join(key.includes('_') ? '+' : ' then ')
</script>

<template>
  <div class="flex flex-col gap-8">
    <UFormField
      label="Keys"
      description="Start from the keys you already know. Your own changes below stay when you switch."
    >
      <URadioGroup
        v-model="preset"
        :items="PRESETS"
        variant="card"
        class="mt-2"
        :ui="{ fieldset: 'grid grid-cols-1 sm:grid-cols-2 gap-2' }"
      />
    </UFormField>

    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Find a shortcut"
          aria-label="Find a shortcut"
          class="flex-1 max-w-xs"
        />
        <span class="flex-1" />
        <UButton
          v-if="changed"
          label="Reset all"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="sm"
          class="lb-in"
          @click="resetAll"
        />
      </div>

      <p
        v-if="!groups.length"
        class="py-6 text-sm text-muted"
      >
        No shortcut matches “{{ search.trim() }}”.
      </p>

      <section
        v-for="group in groups"
        :key="group.title"
      >
        <h2 class="mb-1 text-sm font-semibold text-highlighted">
          {{ group.title }}
        </h2>
        <ul class="divide-y divide-default">
          <li
            v-for="item in group.items"
            :key="item.id"
          >
            <div class="flex min-h-11 items-center gap-3 py-1.5">
              <span class="min-w-0 flex-1 truncate text-sm">
                {{ item.label }}
                <UBadge
                  v-if="item.custom"
                  label="Yours"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="lb-in ms-1.5"
                />
              </span>

              <span
                v-if="recording === item.id"
                class="lb-recording flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-primary ring ring-primary"
              >
                <template v-if="pending">
                  <UKbd
                    :value="pending"
                    variant="soft"
                  />
                  then…
                </template>
                <template v-else>
                  Press a key
                </template>
                <span class="text-xs text-muted">Esc cancels</span>
              </span>
              <SettingsShortcutKeys
                v-else
                :keys="item.keys"
              />

              <UButton
                v-if="recording !== item.id"
                label="Change"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Change the key for ${item.label}`"
                @click="record(item.id)"
              />
              <UTooltip
                v-if="item.custom && recording !== item.id"
                text="Back to the preset’s key"
              >
                <UButton
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Reset the key for ${item.label}`"
                  @click="rebind(item.id, undefined)"
                />
              </UTooltip>
            </div>

            <Transition name="lb-collapse">
              <div v-if="conflict?.id === item.id">
                <div
                  class="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm"
                  role="alert"
                >
                  <UIcon
                    name="i-lucide-triangle-alert"
                    class="size-4 shrink-0 text-warning"
                  />
                  <span class="min-w-0 flex-1">
                    {{ warning }}
                  </span>
                  <UButton
                    label="Use anyway"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="useAnyway"
                  />
                  <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="conflict = undefined"
                  />
                </div>
              </div>
            </Transition>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
