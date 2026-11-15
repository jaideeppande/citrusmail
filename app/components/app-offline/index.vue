<script setup lang="ts">
// A slim bar across the top while the app can't reach the network or its own
// server, saying what still works. What it claims is what the app does: the
// messages you opened are kept on this computer (useMessageCache), the lists
// you looked at last are kept too (useMail), and calendar changes wait in a
// queue and go out when the connection is back (useCalendarEvents). Mail is
// not queued, so it says sending needs a connection
const brand = useBrand()
const { online, serverUp, checking, retry } = useConnection()

const down = computed(() => !online.value || !serverUp.value)

const title = computed(() => !online.value ? 'You’re offline.' : `Can’t reach the ${brand.value.name} server.`)
const detail = 'Messages you’ve opened recently can still be read, and calendar changes are sent once you’re back. Sending mail needs a connection.'

// Said once as it appears and once as it goes, politely: it's news, not an emergency
watch(down, (now, before) => {
  if (now) announce(`${title.value} ${detail}`)
  else if (before) announce('Back online')
})

async function onRetry() {
  const up = await retry()
  if (up && online.value) return
  announce('Still can’t connect')
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="down">
      <div class="flex min-w-0 items-center gap-3 border-b border-default bg-elevated px-4 py-1.5 text-sm">
        <UIcon
          :name="online ? 'i-lucide-server-off' : 'i-lucide-cloud-off'"
          class="size-4 shrink-0 text-muted"
        />
        <p class="min-w-0 flex-1 truncate text-toned">
          <span class="font-medium text-highlighted">{{ title }}</span>
          {{ ' ' }}<span :title="detail">{{ detail }}</span>
        </p>
        <UButton
          label="Retry"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :loading="checking"
          class="shrink-0"
          @click="onRetry"
        />
      </div>
    </div>
  </Transition>
</template>
