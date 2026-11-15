<script setup lang="ts">
// The strip above the page in the main window: search and commands in the
// middle, and on the right what arranges the window itself. In the Mac app
// it's also what the window is dragged by
const { open: openPalette } = useCommandPalette()
const { kbds } = useShortcutKeys()
const { focus } = useWindowChrome()
const today = useTodayPanel()
const { account } = useShell()
</script>

<template>
  <header class="max-lg:hidden shrink-0 flex items-center gap-2 h-(--lb-bar) pe-(--lb-sheet-inset) in-[.desktop]:[-webkit-app-region:drag]">
    <div class="flex-1" />

    <UButton
      data-tour="palette"
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-search"
      aria-label="Search and commands"
      class="w-full max-w-88 justify-start gap-2 px-2.5 h-7 font-normal text-muted rounded-full bg-(--lb-tab-track) ring ring-inset ring-(--lb-tab-ring) hover:bg-(--lb-tab-track) hover:text-toned lb-press [-webkit-app-region:no-drag]"
      @click="openPalette"
    >
      <span class="flex-1 text-start truncate">Search or run a command</span>
      <span class="flex items-center gap-0.5">
        <UKbd
          v-for="key in kbds('app.palette')"
          :key="key"
          :value="key"
          size="sm"
          variant="soft"
        />
      </span>
    </UButton>

    <div class="flex-1 flex items-center justify-end gap-0.5 [-webkit-app-region:no-drag]">
      <AppNotificationsDnd />
      <NotificationCentre />
      <UTooltip
        text="Open this page in a new window"
        :kbds="kbds('window.popout')"
      >
        <UButton
          data-tour="popout"
          icon="i-lucide-picture-in-picture-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Open this page in a new window"
          class="text-muted hover:text-highlighted"
          @click="openPopout(currentPath())"
        />
      </UTooltip>
      <UTooltip
        v-if="account?.hasCalendar"
        text="Today"
        :kbds="kbds('window.today')"
      >
        <UButton
          data-tour="today"
          icon="i-lucide-calendar-check-2"
          color="neutral"
          :variant="today.isOpen.value ? 'soft' : 'ghost'"
          size="xs"
          aria-label="Today"
          :aria-pressed="today.isOpen.value"
          class="text-muted hover:text-highlighted"
          @click="today.toggle()"
        />
      </UTooltip>
      <UTooltip
        text="Focus mode"
        :kbds="kbds('window.focus')"
      >
        <UButton
          icon="i-lucide-focus"
          color="neutral"
          :variant="focus ? 'soft' : 'ghost'"
          size="xs"
          aria-label="Focus mode"
          :aria-pressed="focus"
          class="text-muted hover:text-highlighted"
          @click="focus = !focus"
        />
      </UTooltip>
      <WindowLayouts />
    </div>
  </header>
</template>
