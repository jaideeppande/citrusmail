<script setup lang="ts">
// The thin bar of a pop-out window: what you drag it by, with the sidebar on
// demand and a way to hand the page back to the main window
const { sidebarShown } = useWindowChrome()
// Follows the page's own title as it changes
const title = useTitle(null, { observe: true })
</script>

<template>
  <header class="shrink-0 flex items-center gap-1 h-(--lb-bar) px-2 in-[.desktop-darwin]:ps-20 in-[.desktop]:[-webkit-app-region:drag]">
    <UTooltip :text="sidebarShown ? 'Hide sidebar' : 'Show sidebar'">
      <UButton
        :icon="sidebarShown ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="sidebarShown ? 'Hide sidebar' : 'Show sidebar'"
        :aria-pressed="sidebarShown"
        class="text-dimmed hover:text-highlighted [-webkit-app-region:no-drag]"
        @click="sidebarShown = !sidebarShown"
      />
    </UTooltip>

    <p class="flex-1 min-w-0 text-center text-xs font-medium text-muted truncate">
      {{ title }}
    </p>

    <UTooltip text="Move back to the main window">
      <UButton
        icon="i-lucide-square-arrow-down-left"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Move back to the main window"
        class="text-dimmed hover:text-highlighted [-webkit-app-region:no-drag]"
        @click="dockBack(currentPath())"
      />
    </UTooltip>
  </header>
</template>
