<script setup lang="ts">
// Under the recipients: what time it is for the people you write to, when
// their clocks are not the same as yours ("It’s 23:40 for Ana (Lisbon)").
// Their zones are set on their contact
const { draft } = useComposer()
const { timeZoneOf } = useContactExtras()
const now = useNow({ interval: 30_000 })

const MOST = 2

const elsewhere = computed(() => {
  const mine = myTimeZone()
  const seen = new Set<string>()
  const people: { name: string, zone: string, time: string }[] = []
  for (const person of [...draft.value.to, ...draft.value.cc]) {
    const zone = timeZoneOf(person.address)
    if (!isTimeZone(zone) || seen.has(person.address.toLowerCase())) continue
    seen.add(person.address.toLowerCase())
    if (!zonesDiffer(zone, mine, now.value)) continue
    people.push({ name: personName(person).split(/\s+/)[0] ?? person.address, zone, time: clockInZone(zone, now.value) })
  }
  return people
})

const line = computed(() => {
  const shown = elsewhere.value.slice(0, MOST).map(item => `${item.time} for ${item.name} (${zoneCity(item.zone)})`)
  const more = elsewhere.value.length - shown.length
  return `It’s ${shown.join(', ')}${more > 0 ? `, and ${more} more elsewhere` : ''}`
})
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="elsewhere.length">
      <p class="flex items-center gap-1.5 px-5 py-1 ps-22 text-xs text-muted">
        <UIcon
          name="i-lucide-globe-2"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate">{{ line }}</span>
      </p>
    </div>
  </Transition>
</template>
