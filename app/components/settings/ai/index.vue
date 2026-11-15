<script setup lang="ts">
const { status, saving, saveKey, use, remove, onDesktop, noticeOpen } = useAiKeys()
const ai = useAiClient()
const secure = computed(() => (status.value as DesktopAiStatus).secure)
</script>

<template>
  <div class="flex flex-col gap-10 max-w-2xl">
    <SettingsSection
      title="Your AI provider"
      :description="onDesktop ? 'Your key stays on this computer, encrypted by the system’s keychain. CitrusMail sends your requests to the provider from this computer, under their terms.' : 'Keys are encrypted and stay on this server. In the desktop app, they stay on your computer instead.'"
    >
      <ul class="flex flex-col gap-3">
        <SettingsAiProvider
          v-for="item in status.providers"
          :key="item.provider"
          :item="item"
          :active="status.active === item.provider"
          :saving="saving === item.provider"
          @save="(key, model) => saveKey(item.provider, key, model)"
          @use="use(item.provider)"
          @remove="remove(item.provider)"
        />
      </ul>
      <p
        v-if="onDesktop && status.active && !secure"
        class="flex items-start gap-2 text-sm text-warning"
        role="note"
      >
        <UIcon
          name="i-lucide-shield-alert"
          class="size-4 mt-0.5 shrink-0"
        />
        This system has no keychain CitrusMail can use, so your key is stored with weaker protection. On Linux, installing GNOME Keyring or KWallet fixes this.
      </p>
    </SettingsSection>

    <template v-if="onDesktop && ai.available.value">
      <SettingsSection
        title="What AI does"
        description="Features marked “Runs on its own” work on new mail and as you type, without being asked. Everything else waits for you."
      >
        <SettingsAiFeatures />
      </SettingsSection>

      <SettingsSection title="Use and limits">
        <SettingsAiUsage />
      </SettingsSection>
    </template>

    <p
      v-else-if="!onDesktop"
      class="text-sm text-muted max-w-prose text-pretty"
    >
      In a browser, only summaries, AI Reply, tone rewrite, translation and questions about your mail are available, through this server. The rest of CitrusMail’s AI features run in the desktop app.
    </p>

    <SettingsAiNotice v-model:open="noticeOpen" />
  </div>
</template>
