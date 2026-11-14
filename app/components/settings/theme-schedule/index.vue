<script setup lang="ts">
// Light by day, dark by night, at the hours you choose
const { schedule, turnOn, turnOff, setTimes } = useThemeSchedule()

const time = (event: Event) => (event.target as HTMLInputElement).value
</script>

<template>
  <div class="flex flex-col">
    <USwitch
      :model-value="schedule.on"
      label="Follow the time of day"
      description="Light in the daytime and dark in the evening, by the clock on this computer."
      @update:model-value="$event ? turnOn() : turnOff()"
    />
    <Transition name="lb-collapse">
      <div v-if="schedule.on">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 ps-11 pt-3">
          <label class="flex items-center gap-2 text-sm text-muted">
            <UIcon
              name="i-lucide-sun"
              class="size-4"
            />
            Light from
            <UInput
              type="time"
              :model-value="schedule.light"
              class="w-28"
              @change="time($event) && setTimes({ light: time($event) })"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-muted">
            <UIcon
              name="i-lucide-moon"
              class="size-4"
            />
            Dark from
            <UInput
              type="time"
              :model-value="schedule.dark"
              class="w-28"
              @change="time($event) && setTimes({ dark: time($event) })"
            />
          </label>
        </div>
      </div>
    </Transition>
  </div>
</template>
