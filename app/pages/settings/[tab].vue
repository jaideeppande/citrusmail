<script setup lang="ts">
const route = useRoute()

const TABS = {
  profile: { title: 'Profile', description: 'How you appear to the people you write to.' },
  signature: { title: 'Signature', description: 'Added under the messages you write.' },
  appearance: { title: 'Appearance', description: 'How CitrusMail looks for you.' },
  accessibility: { title: 'Accessibility', description: 'Easier to see, hear and use: contrast, size, motion and sound.' },
  reading: { title: 'Reading', description: 'How messages open, and when pictures from the web load in them.' },
  notifications: { title: 'Notifications', description: 'When and how CitrusMail tells you about new mail.' },
  shortcuts: { title: 'Shortcuts', description: 'The keys that do things, and which ones you’d rather they were.' },
  senders: { title: 'Senders', description: 'People and domains that always reach your Inbox, and those that never do.' },
  rules: { title: 'Rules', description: 'Sort incoming mail into folders on its own.' },
  tracking: { title: 'Tracking', description: 'Find out when messages you send are delivered and opened.' },
  ai: { title: 'AI', description: 'Bring your own key to draft replies, summarize long messages and ask questions of all your mail.' },
  privacy: { title: 'Privacy', description: 'Who can see your mail when you step away from this computer.' },
  desktop: { title: 'Desktop', description: 'How CitrusMail sits on this computer: when it starts, what it opens and how you reach it.' },
  insights: { title: 'Insights', description: 'Your mail in numbers: how much comes and goes, when, and from whom.' },
  about: { title: 'About', description: 'The app, its version and where its code is.' }
} as const

// Desktop is about the desktop app: a browser tab has nothing to show there
const tab = computed(() => {
  const asked = route.params.tab as string
  return asked in TABS && (asked !== 'desktop' || desktop()) ? asked as keyof typeof TABS : 'profile'
})
useSeoMeta({ title: () => `${TABS[tab.value].title} · Settings` })
</script>

<template>
  <SettingsPage
    :title="TABS[tab].title"
    :description="TABS[tab].description"
  >
    <!-- Keyed, so each tab's content fades in as you move between them -->
    <div
      :key="tab"
      class="lb-in"
    >
      <SettingsProfile v-if="tab === 'profile'" />
      <SettingsSignature v-else-if="tab === 'signature'" />
      <SettingsAppearance v-else-if="tab === 'appearance'" />
      <SettingsAccessibility v-else-if="tab === 'accessibility'" />
      <SettingsReading v-else-if="tab === 'reading'" />
      <SettingsNotifications v-else-if="tab === 'notifications'" />
      <SettingsShortcuts v-else-if="tab === 'shortcuts'" />
      <SettingsSenders v-else-if="tab === 'senders'" />
      <SettingsAi v-else-if="tab === 'ai'" />
      <SettingsTracking v-else-if="tab === 'tracking'" />
      <SettingsPrivacy v-else-if="tab === 'privacy'" />
      <SettingsDesktop v-else-if="tab === 'desktop'" />
      <SettingsInsights v-else-if="tab === 'insights'" />
      <SettingsAbout v-else-if="tab === 'about'" />
      <SettingsRules v-else />
    </div>
  </SettingsPage>
</template>
