<script setup lang="ts">
// The frame around every signed-in page. A window is one of three kinds
// (app/utils/window.ts), and each gets the chrome that suits it: the main
// window has the sidebar and the bar above the page, a pop-out has a thin
// bar and no sidebar until asked, and a pane of a split layout has only a
// header saying what it shows
const { isMain, isPopout, isPane, sidebarShown, focus } = useWindowChrome()
const route = useRoute()
const { compose, composeFromMailto } = useComposer()
const { isOpen: paletteOpen } = useCommandPalette()
const { open: openShortcuts } = useShortcutsHelp()
const panes = usePanes()
const { folders, inboxTabs } = useMail()
inboxTabs.value = useInboxTabs()
const lock = useAppLock()

useAppCommands()
// AI that works on new mail without being asked (each feature registers itself)
useAiBackground()
useAiMailWorkers()
useAiContactWorkers()
useDesktopSettings().apply()

// The composer page is the whole window: nothing else belongs around it
const bare = computed(() => route.path.startsWith('/compose'))
const showSidebar = computed(() => !isPane && sidebarShown.value && !focus.value && !bare.value)

// A pop-out handing its page back
onWindowEvent((event) => {
  if (isMain && event.type === 'window:dock') navigateTo(event.path)
  if (isMain && event.type === 'compose') compose(event.to)
})

// What was chosen in the app's menu bar, tray, Dock or jump list. Every
// window hears it; only the one in front (or the main one) acts
const app = isPane ? undefined : desktop()
let stopCommands: (() => void) | undefined
onMounted(() => {
  stopCommands = app?.onCommand((command) => {
    if (command.type === 'compose') return command.mailto ? composeFromMailto(command.mailto) : compose()
    // The menu bar knows the calendar by name, not by today's date
    if (command.type === 'navigate') return navigateTo(command.path === '/calendar' ? `/calendar/week/${todayDate().toString()}` : command.path)
    if (command.type === 'palette') return (paletteOpen.value = true)
    if (command.type === 'shortcuts') return openShortcuts()
    if (command.type === 'focus') return (focus.value = !focus.value)
    if (command.type === 'lock') return lock.lock()
    if (command.type === 'layout' && LAYOUTS.some(item => item.id === command.layout)) return panes.setLayout(command.layout as LayoutId)
  })
})
onBeforeUnmount(() => stopCommands?.())

// The unread count on the Dock, the taskbar and the tray. Windows has no
// number badge of its own, so the number is drawn here and sent as a picture
const unread = computed(() => folders.value.find(folder => folder.role === 'inbox' || folder.path === 'INBOX')?.unread ?? 0)
watch(unread, (count) => {
  if (!isMain || !app) return
  app.setBadge(count, count ? badgeImage(count) : undefined)
}, { immediate: true })
</script>

<template>
  <div class="isolate relative flex h-svh overflow-hidden bg-(--lb-desk)">
    <SkipLink v-if="!isPane" />
    <AppBackground />
    <AppSidebar v-if="showSidebar" />

    <div
      class="relative flex-1 min-w-0 flex flex-col"
      :class="[!isPane && 'lg:pb-(--lb-sheet-inset) lg:pe-(--lb-sheet-inset)', !isPane && !showSidebar && 'lg:ps-(--lb-sheet-inset)']"
    >
      <WindowBar
        v-if="isMain && !bare"
        class="-me-(--lb-sheet-inset)"
      />
      <WindowPopoutBar v-else-if="isPopout" />
      <!-- Nothing above the page on a phone, where the bars are hidden -->
      <div
        v-if="isMain && bare"
        class="max-lg:hidden h-(--lb-sheet-inset)"
      />

      <!-- The sheet: everything you read and write sits on one page with a
        hairline edge, set into the desk on desktop and edge to edge on a phone.
        A split layout puts more sheets beside it -->
      <AppOffline v-if="!isPane" />

      <WindowPanes v-if="isMain">
        <!-- `isolate`: pages put layers of their own under their content (the
          calendar grid does), and those must stay above the sheet -->
        <main
          id="main"
          tabindex="-1"
          class="isolate relative flex-1 min-w-0 flex outline-none"
        >
          <slot />
        </main>
      </WindowPanes>
      <main
        v-else
        id="main"
        tabindex="-1"
        class="isolate relative flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden outline-none"
        :class="isPopout && 'lb-sheet'"
      >
        <WindowPaneBar v-if="isPane" />
        <div class="isolate relative flex-1 min-h-0 flex">
          <slot />
        </div>
      </main>
    </div>

    <MailComposer v-if="!bare" />
    <MailTriage />
    <MailAttachmentGallery />
    <MailSearchAll />
    <MailAiTasksDialog />
    <CommandPalette />
    <ShortcutsHelp />
    <template v-if="isMain">
      <TodayPanel />
      <AssistantPanel />
      <AppNotifications />
      <AppTour />
      <WhatsNew />
    </template>
    <AppLock />
    <AppAnnouncer />
  </div>
</template>
