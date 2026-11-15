<script setup lang="ts">
// The line under the address that says what was found as you type: a quiet
// "Looking up…", then the provider easing in, or a calm note that the
// settings need entering. It opens and closes in place (grid rows) so the
// form below glides rather than jumps, and it never takes focus
const props = defineProps<{
  discovery: DiscoveryResult | null
  /** The domain being (or about to be) looked up; empty while the address isn't whole */
  domain: string
  /** Typed but not looked up yet, or being looked up */
  looking: boolean
  /** Signing in over JMAP already */
  jmap?: boolean
}>()

const emit = defineEmits<{
  chooseJmap: [jmap: boolean]
  openSettings: []
}>()

type HintState = 'none' | 'looking' | 'microsoft-off' | 'microsoft' | 'app-password' | 'found' | 'jmap-only' | 'missing'

const state = computed<HintState>(() => {
  const found = props.discovery
  if (!props.domain) return 'none'
  if (props.looking) return 'looking'
  if (!found) return 'none'
  if (found.oauth) return found.oauthReady ? 'microsoft' : 'microsoft-off'
  if (found.appPasswordUrl) return 'app-password'
  if (found.incoming) return 'found'
  if (found.jmap) return 'jmap-only'
  return 'missing'
})

const name = computed(() => props.discovery?.provider ?? (props.discovery?.incoming ? props.discovery.incoming.host : props.domain))
</script>

<template>
  <!-- -mt-5 cancels the form's gap while closed; pt-3 is the gap while open -->
  <div
    class="-mt-5 grid transition-[grid-template-rows] duration-(--lb-dur-3) ease-(--lb-ease-out)"
    :class="state === 'none' ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
  >
    <div class="min-h-0 overflow-hidden">
      <Transition
        name="lb-fade"
        mode="out-in"
      >
        <div
          v-if="state !== 'none'"
          :key="state"
          class="flex flex-col gap-2 pt-3 pb-0.5"
        >
          <p
            v-if="state === 'looking'"
            class="flex items-center gap-1.5 text-xs text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-3.5 animate-spin"
            />
            Looking up {{ domain }}…
          </p>

          <UAlert
            v-else-if="state === 'microsoft-off'"
            icon="i-lucide-key-round"
            color="warning"
            variant="subtle"
            title="Microsoft mailboxes need Sign in with Microsoft"
            description="Microsoft no longer accepts passwords from mail apps, and this copy isn’t set up for Sign in with Microsoft yet. Whoever runs it can add it in a few minutes (see the README)."
          />

          <UAlert
            v-else-if="state === 'app-password'"
            :icon="discovery?.icon ?? 'i-lucide-key-round'"
            color="neutral"
            variant="subtle"
            :title="`${name} needs an app password`"
            description="Your normal password won’t work here. Create an app password and paste it below."
            :actions="[{ label: 'Create app password', to: discovery?.appPasswordUrl, target: '_blank', trailingIcon: 'i-lucide-arrow-up-right', color: 'neutral', variant: 'outline', size: 'xs' }]"
          />

          <p
            v-else-if="state === 'missing'"
            class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted"
          >
            <UIcon
              name="i-lucide-info"
              class="size-3.5"
            />
            We couldn’t find settings for this domain.
            <UButton
              label="Enter them in server settings"
              color="neutral"
              variant="link"
              size="xs"
              class="p-0 underline"
              @click="emit('openSettings')"
            />
          </p>

          <p
            v-else
            class="flex items-start gap-1.5 text-xs text-toned"
          >
            <UIcon
              :name="discovery?.icon ?? 'i-lucide-check'"
              class="mt-px size-3.5 shrink-0 lb-in-scale"
              :class="discovery?.icon ? 'text-highlighted' : 'text-success'"
            />
            <span class="min-w-0 text-pretty">
              <span class="font-medium text-highlighted">{{ name }}</span>
              {{ state === 'microsoft' ? ' found. Microsoft signs you in on its own page, so there’s no password to type here.' : ' found' }}
            </span>
          </p>

          <p
            v-if="discovery?.note && state !== 'looking'"
            class="text-xs text-muted text-pretty"
          >
            {{ discovery.note }}
          </p>

          <AuthJmapOffer
            v-if="discovery?.jmap && !discovery.oauth && state !== 'looking'"
            :active="jmap"
            :can-switch="Boolean(discovery.incoming)"
            @choose="emit('chooseJmap', $event)"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>
