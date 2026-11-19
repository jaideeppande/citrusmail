<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const brand = useBrand()
const notFound = computed(() => props.error.statusCode === 404)

const title = computed(() => notFound.value ? 'This page doesn’t exist' : 'Something went wrong')
const description = computed(() => notFound.value
  ? 'The link may be old, or the page has moved. Your mail is where you left it.'
  : `${brand.value.name} hit a problem it couldn’t get past. Reloading usually fixes it, and your mail is safe on your mail server.`)

// What a developer or a bug report needs, kept out of the way
const detail = computed(() => {
  const { statusCode, statusMessage, message } = props.error
  return [statusCode && `${statusCode}${statusMessage ? ` ${statusMessage}` : ''}`, message && message !== statusMessage ? message : '']
    .filter(Boolean)
    .join('\n')
})

useSeoMeta({
  title: () => notFound.value ? 'Page not found' : 'Something went wrong'
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})

// Words a desktop app can use: no "browser", no "back"
const actions = computed(() => [
  { label: 'Go to Inbox', icon: 'i-lucide-inbox', onClick: () => clearError({ redirect: '/mail/INBOX' }) },
  ...(notFound.value ? [] : [{ label: 'Reload', icon: 'i-lucide-rotate-cw', color: 'neutral' as const, variant: 'subtle' as const, onClick: () => window.location.reload() }])
])
</script>

<template>
  <UApp>
    <div class="flex min-h-svh flex-col bg-default">
      <!-- The Mac app has no title bar: this strip is what the window is dragged by -->
      <div class="hidden h-10 shrink-0 in-[.desktop]:block [-webkit-app-region:drag]" />

      <main
        id="main"
        tabindex="-1"
        class="flex flex-1 items-center justify-center p-6 outline-none"
      >
        <AppEmpty
          :illustration="notFound ? 'not-found' : 'error'"
          :title="title"
          :description="description"
          :actions="actions"
          :level="1"
          class="w-full max-w-lg"
        >
          <details
            v-if="detail"
            class="group mt-6 w-full max-w-md text-start"
          >
            <summary class="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted lb-focus hover:text-highlighted [&::-webkit-details-marker]:hidden">
              Details
              <UIcon
                name="i-lucide-chevron-down"
                class="size-3.5 transition-transform duration-(--lb-dur-2) group-open:rotate-180"
              />
            </summary>
            <pre class="mt-2 overflow-x-auto rounded-md bg-elevated px-3 py-2 font-mono text-xs/relaxed whitespace-pre-wrap text-toned select-text">{{ detail }}</pre>
          </details>
        </AppEmpty>
      </main>
    </div>
  </UApp>
</template>
