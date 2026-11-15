<script setup lang="ts">
const brand = useBrand()
const props = defineProps<{
  signIn: ReturnType<typeof useSignIn>
}>()

const { form, adding, locked, discovery, discovering, pending, advancedOpen, touched, advice, stage, submitting, submit, oauth, oauthUrl, chooseJmap } = props.signIn

// A Microsoft mailbox takes no password: the button hands over to Microsoft,
// unless the person opened the server settings to use their own servers
const viaOauth = computed(() => !!oauth.value && !advancedOpen.value && !touched.value)
const oauthReady = computed(() => viaOauth.value && !!discovery.value?.oauthReady)

const domain = computed(() => isEmail(form.email) ? form.email.trim().split('@')[1] ?? '' : '')
const looking = computed(() => !!domain.value && (pending.value || discovering.value))

const leadingIcon = computed(() => discovery.value?.icon && !looking.value ? discovery.value.icon : 'i-lucide-at-sign')

const STAGES = {
  idle: '',
  connecting: 'Connecting…',
  loading: 'Loading your mail…',
  done: 'Signed in'
}
const submitLabel = computed(() => STAGES[stage.value] || (adding.value ? 'Add mailbox' : 'Sign in'))
const busy = computed(() => stage.value === 'connecting' || stage.value === 'loading')

const passwordField = useTemplateRef<{ focus: () => void }>('passwordField')

// Enter in the address field moves on to the password while it's empty,
// rather than submitting a form that can't succeed yet. With Microsoft (no
// password) it submits, which hands over to Microsoft
function onEmailEnter(event: KeyboardEvent) {
  if (viaOauth.value || form.password || !isEmail(form.email)) return
  event.preventDefault()
  passwordField.value?.focus()
}

const emailAdvice = computed(() => advice.value?.field === 'email' ? advice.value : null)
const passwordAdvice = computed(() => advice.value?.field === 'password' ? advice.value : null)
const formAdvice = computed(() => advice.value && (advice.value.field === 'form' || advice.value.field === 'server') ? advice.value : null)

// Screen readers hear what sighted people see change: the lookup's result,
// each stage of signing in, and an error at once
watch(discovery, (found) => {
  if (!found || !domain.value) return
  if (found.oauth || found.incoming) announce(`${found.provider ?? found.incoming?.host ?? domain.value} found`)
  else if (!found.jmap) announce('We couldn’t find settings for this domain. You can enter them in server settings.')
})
watch(stage, (now) => {
  if (now !== 'idle') announce(STAGES[now])
})
watch(advice, (now) => {
  if (now) announce(now.message, true)
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <header>
      <h1 class="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.025em] text-highlighted text-balance">
        {{ adding ? 'Add a mailbox' : brand.loginTitle }}
      </h1>
      <p class="mt-2.5 text-[15px] leading-relaxed text-muted text-pretty">
        {{ adding ? 'Sign in to another address. You can switch between them from the menu at the bottom of the sidebar.' : brand.loginSubtitle }}
      </p>
    </header>

    <UForm
      :state="form"
      class="flex flex-col gap-5"
      @submit="submit"
    >
      <UFormField
        label="Email address"
        name="email"
        :error="emailAdvice ? emailAdvice.message : undefined"
      >
        <UInput
          v-model="form.email"
          type="email"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          placeholder="you@example.com"
          size="xl"
          autofocus
          required
          class="w-full"
          :icon="leadingIcon"
          :ui="{ leadingIcon: discovery?.icon && !looking ? 'text-highlighted lb-in-scale' : 'text-dimmed' }"
          @keydown.enter="onEmailEnter"
        />
      </UFormField>

      <AuthProviderHint
        :discovery="discovery"
        :domain="domain"
        :looking="looking"
        :jmap="form.incoming.protocol === 'jmap'"
        @choose-jmap="chooseJmap"
        @open-settings="advancedOpen = true"
      />

      <Transition name="lb-collapse">
        <div v-if="!viaOauth">
          <AuthPasswordField
            ref="passwordField"
            v-model="form.password"
            :advice="passwordAdvice"
          />
        </div>
      </Transition>

      <Transition name="lb-collapse">
        <div v-if="formAdvice">
          <UAlert
            icon="i-lucide-circle-alert"
            color="error"
            variant="subtle"
            :title="formAdvice.message"
            :description="formAdvice.detail"
            :actions="formAdvice.openSettings && !locked
              ? [{ label: 'Open server settings', icon: 'i-lucide-sliders-horizontal', color: 'neutral', variant: 'outline', size: 'xs', onClick: () => { advancedOpen = true } }]
              : undefined"
            :ui="{ description: 'text-xs opacity-80 wrap-anywhere' }"
          />
        </div>
      </Transition>

      <Transition
        name="lb-fade"
        mode="out-in"
      >
        <UButton
          v-if="oauthReady"
          key="microsoft"
          :label="adding ? 'Add with Microsoft' : 'Sign in with Microsoft'"
          icon="i-simple-icons-microsoft"
          size="xl"
          block
          class="mt-1"
          :href="oauthUrl"
          external
        />
        <UButton
          v-else-if="!viaOauth"
          key="submit"
          type="submit"
          :label="submitLabel"
          size="xl"
          block
          :loading="busy"
          :disabled="stage === 'done'"
          class="mt-1 disabled:opacity-100"
        >
          <template
            v-if="stage === 'done'"
            #leading
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
              aria-hidden="true"
              data-lb-check
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                path-length="1"
              />
              <path
                d="M6.5 10.2l2.4 2.4 4.6-5"
                path-length="1"
              />
            </svg>
          </template>
        </UButton>
      </Transition>

      <UButton
        v-if="adding"
        label="Back to your mail"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        size="sm"
        to="/mail/INBOX"
        class="self-center -mt-2"
      />

      <UButton
        v-if="!locked"
        label="Enter server settings yourself"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="link"
        size="sm"
        :disabled="submitting"
        class="self-center"
        @click="advancedOpen = true"
      />
    </UForm>

    <AuthServerSettings
      v-if="!locked"
      v-model:open="advancedOpen"
      v-model:form="form"
      :advice="advice?.field === 'server' ? advice : null"
      @touch="touched = true"
    />
  </div>
</template>
