<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

// Choosing the calendar's second time zone: every zone the browser knows,
// searchable, with the common ones first. The modal hands the focus back to
// whatever opened it when it closes
const { prefs, local, second, setSecond, pickerOpen } = useCalendarZones()

// Read once the modal opens, the offsets are those of the day it is opened on
const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  if (!pickerOpen.value) return []

  const now = new Date()
  const { common, all } = calZoneList()

  const item = (zone: string): CommandPaletteItem => ({
    label: calZoneCity(zone),
    suffix: `${calZoneName(now, zone)} · ${zone}`,
    icon: prefs.value.second === zone ? 'i-lucide-check' : 'i-lucide-globe',
    active: prefs.value.second === zone,
    disabled: zone === local,
    onSelect: () => choose(zone)
  })

  return [{
    id: 'none',
    items: [{
      label: 'No second time zone',
      icon: second.value ? 'i-lucide-circle-off' : 'i-lucide-check',
      active: !second.value,
      onSelect: () => choose('')
    }]
  }, {
    id: 'common',
    label: 'Common',
    items: common.map(item)
  }, {
    id: 'all',
    label: 'All time zones',
    items: all.map(item)
  }]
})

function choose(zone: string) {
  setSecond(zone)
  pickerOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="pickerOpen"
    title="Time zones"
    :description="`Your calendar is in ${calZoneCity(local)} time (${calZoneName(new Date(), local)}). Pick a second zone to show beside it.`"
    :ui="{ content: 'sm:max-w-lg', body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <UCommandPalette
        :groups="groups"
        placeholder="Search for a city or zone"
        :fuse="{ resultLimit: 60, fuseOptions: { keys: ['label', 'suffix'], threshold: 0.3 } }"
        class="h-96"
        :ui="{ input: '[&>input]:text-sm' }"
      />
    </template>
  </UModal>
</template>
