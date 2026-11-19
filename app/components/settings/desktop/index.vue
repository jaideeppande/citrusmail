<script setup lang="ts">
// Settings → Desktop: how the app sits on this computer. Only in the
// desktop app; a browser tab can do none of this
const prefs = usePrefs()
const { system, quickComposeTaken, refresh, setLoginItem, setDefaultMailto, setCloseToTray, setQuickCompose } = useDesktopSettings()

onMounted(refresh)
// Being made the default mail app can happen in the system's own settings
useEventListener(window, 'focus', refresh)

/** The tray is a Windows and Linux thing; a Mac app stays in the Dock by itself */
const hasTray = computed(() => system.value?.tray ?? desktop()?.platform !== 'darwin')
</script>

<template>
  <div class="flex flex-col gap-8 max-w-xl">
    <div class="flex flex-col gap-5">
      <USwitch
        :model-value="system?.loginItem ?? false"
        :disabled="!system"
        label="Open at sign-in"
        description="CitrusMail starts when you sign in to this computer, so new mail finds you without opening it first."
        @update:model-value="setLoginItem($event)"
      />
      <USwitch
        :model-value="system?.defaultMailto ?? false"
        :disabled="!system"
        label="Default mail app"
        description="Email links (mailto:) in your browser and other apps open a new message here."
        @update:model-value="setDefaultMailto($event)"
      />
      <USwitch
        v-if="hasTray"
        :model-value="prefs.closeToTray"
        label="Keep running in the tray when the window is closed"
        description="Closing the last window leaves the app by the clock, still watching for new mail. Quit from its tray menu."
        @update:model-value="setCloseToTray($event)"
      />
    </div>

    <UFormField
      label="New message from anywhere"
      description="A shortcut that opens a new message whichever app is in front."
    >
      <SettingsAcceleratorRecorder
        :model-value="prefs.quickCompose"
        class="mt-2"
        @update:model-value="setQuickCompose($event)"
      />
      <Transition name="lb-collapse">
        <div v-if="quickComposeTaken">
          <p
            class="flex items-center gap-1.5 pt-2 text-sm text-error"
            role="alert"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4 shrink-0"
            />
            Another app is using that shortcut. Try a different one.
          </p>
        </div>
      </Transition>
    </UFormField>
  </div>
</template>
