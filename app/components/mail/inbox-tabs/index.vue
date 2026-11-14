<script setup lang="ts">
// The Inbox as tabs: people first, then the mail that machines send. One
// pill slides under the open tab, as it does under the section switch
const { messages, inboxTabs } = useMail()

const tabs = computed(() => inboxTabs.value?.tabs.value ?? [])
const counts = computed(() => inboxTabs.value?.counts(messages.value))
const active = computed(() => tabs.value.findIndex(tab => tab.value === inboxTabs.value?.tab.value))

const nav = useTemplateRef('nav')
const pill = ref({ left: 0, width: 0 })
function place() {
  const el = nav.value?.children[active.value + 1] as HTMLElement | undefined
  if (el) pill.value = { left: el.offsetLeft, width: el.offsetWidth }
}
watch([active, tabs, counts], () => nextTick(place), { immediate: true, flush: 'post' })
useResizeObserver(nav, place)
</script>

<template>
  <nav
    v-if="tabs.length > 1"
    ref="nav"
    aria-label="Inbox tabs"
    class="relative shrink-0 flex items-center gap-1 px-3 h-10 border-b border-default overflow-x-auto"
  >
    <span
      class="absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-(--lb-dur-3) ease-(--lb-ease-out)"
      :style="{ left: `${pill.left}px`, width: `${pill.width}px` }"
    />
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      :aria-pressed="inboxTabs?.tab.value === tab.value"
      class="shrink-0 flex items-center gap-1.5 h-full px-2 text-sm transition-colors duration-(--lb-dur-1) lb-focus rounded-sm"
      :class="inboxTabs?.tab.value === tab.value ? 'text-highlighted font-medium' : 'text-muted hover:text-toned'"
      @click="inboxTabs && (inboxTabs.tab.value = tab.value)"
    >
      <UIcon
        :name="tab.icon"
        class="size-4"
      />
      <span class="@max-[26rem]:sr-only">{{ tab.label }}</span>
      <span
        v-if="tab.value !== 'tracked' && counts?.unread[tab.value]"
        class="text-xs tabular-nums text-primary font-semibold"
      >{{ counts.unread[tab.value] }}</span>
    </button>
  </nav>
</template>
