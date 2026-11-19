<script setup lang="ts">
import type { SelectMenuItem } from '@nuxt/ui'

// The time zone someone lives in: searchable, yours and the usual ones
// first. An empty value means “not set”
const model = defineModel<string | undefined>()

defineProps<{
  id?: string
}>()

// Every zone with its offset is a few hundred formatters, so the list is
// only built once someone opens it
const opened = ref(false)

function item(zone: string, now: Date): SelectMenuItem & { value: string } {
  const offset = contactZoneOffset(zone, now)
  return { label: contactZoneLabel(zone), value: zone, suffix: offset === undefined ? undefined : contactOffsetLabel(offset) }
}

const items = computed(() => {
  const now = new Date()
  const none = [{ label: 'Not set', value: '', icon: 'i-lucide-circle-slash' }]
  if (!opened.value) return [none, ...(model.value ? [[item(model.value, now)]] : [])]
  const common = contactCommonZones()
  const shown = new Set(common)
  return [
    none,
    common.map(zone => item(zone, now)),
    contactZoneList().filter(zone => !shown.has(zone)).map(zone => item(zone, now))
  ]
})

const value = computed({
  get: () => model.value ?? '',
  set: (zone: string) => {
    model.value = zone || undefined
    announce(zone ? `Time zone set to ${contactZoneLabel(zone)}` : 'Time zone cleared')
  }
})
</script>

<template>
  <USelectMenu
    :id="id"
    v-model="value"
    :items="items"
    value-key="value"
    :filter-fields="['label', 'value']"
    :search-input="{ placeholder: 'Search cities and regions' }"
    placeholder="Not set"
    icon="i-lucide-globe"
    class="w-full"
    @update:open="(open: boolean) => open && (opened = true)"
  />
</template>
