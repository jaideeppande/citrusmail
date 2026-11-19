<script setup lang="ts">
// Do not disturb, and the people it doesn't apply to
const dnd = useDoNotDisturb()
const { mine: vips } = useVips()
const { account } = useShell()

const MODES: { label: string, value: DndMode }[] = [
  { label: 'For 1 hour', value: 'hour' },
  { label: 'Until tomorrow morning', value: 'morning' },
  { label: 'Until I turn it off', value: 'on' }
]

const mode = dnd.mode
</script>

<template>
  <fieldset class="flex flex-col gap-6">
    <legend class="text-sm font-semibold text-highlighted mb-3">
      Do not disturb
    </legend>

    <UFormField :description="dnd.active.value ? `${dnd.label.value}. No sounds or banners, except from your VIPs. Mail still arrives.` : 'A pause from sounds and banners on this computer. Mail still arrives.'">
      <div class="flex flex-wrap gap-2 mb-2">
        <UButton
          label="Off"
          :color="mode === 'off' ? 'primary' : 'neutral'"
          :variant="mode === 'off' ? 'soft' : 'outline'"
          size="sm"
          :aria-pressed="mode === 'off'"
          @click="dnd.clear()"
        />
        <UButton
          v-for="item in MODES"
          :key="item.value"
          :label="item.label"
          :icon="mode === item.value ? 'i-lucide-bell-off' : undefined"
          :color="mode === item.value ? 'primary' : 'neutral'"
          :variant="mode === item.value ? 'soft' : 'outline'"
          size="sm"
          :aria-pressed="mode === item.value"
          @click="dnd.set(item.value)"
        />
      </div>
    </UFormField>

    <SettingsSenderList
      label="VIPs"
      :description="`Mail from these people and domains to ${account?.email ?? 'this mailbox'} still notifies you during quiet hours and do not disturb.`"
      :entries="vips"
      empty="Nobody yet. Add the few people you’d want to hear from at any hour."
      icon="i-lucide-star"
      @add="vips = [...vips.filter(entry => entry.toLowerCase() !== $event.toLowerCase()), $event]"
      @remove="vips = vips.filter(entry => entry !== $event)"
    />
  </fieldset>
</template>
