<script setup lang="ts">
// Settings → Privacy: the app lock. Honest about what it is: a screen in
// front of the app, not encryption
const { config, available, enabled, lock, check, setPin, disable, setIdle, setTouchId } = useAppLock()
const toast = useToast()

/** Which form is open: turning the lock on, changing its PIN or turning it off */
const form = ref<'on' | 'change' | 'off'>()
const current = ref('')
const pin = ref('')
const repeat = ref('')
const error = ref('')
const busy = ref(false)

const touchId = ref(false)
onMounted(async () => {
  touchId.value = !!(await desktop()?.getSystem().catch(() => undefined))?.touchId
})

function show(which: 'on' | 'change' | 'off' | undefined) {
  form.value = which
  current.value = pin.value = repeat.value = error.value = ''
}

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 8)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (form.value === 'off') {
      if (!await disable(current.value)) return (error.value = 'That’s not the current PIN.')
      toast.add({ title: 'App lock is off', icon: 'i-lucide-lock-open' })
      return show(undefined)
    }
    if (!isPin(pin.value)) return (error.value = 'A PIN is 4 to 8 digits.')
    if (pin.value !== repeat.value) return (error.value = 'The two PINs don’t match.')
    if (form.value === 'change') {
      if (!await check(current.value)) return (error.value = 'That’s not the current PIN.')
      await setPin(pin.value)
      toast.add({ title: 'PIN changed', icon: 'i-lucide-check' })
    } else {
      if (!await setPin(pin.value)) return (error.value = 'The PIN couldn’t be saved on this computer.')
      toast.add({ title: 'App lock is on', icon: 'i-lucide-lock' })
    }
    show(undefined)
  } finally {
    busy.value = false
  }
}

const TITLES = { on: 'Choose a PIN', change: 'Change your PIN', off: 'Turn off app lock' }
</script>

<template>
  <div class="flex flex-col gap-8 max-w-xl">
    <section class="flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-full"
          :class="enabled ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
        >
          <UIcon
            :name="enabled ? 'i-lucide-lock' : 'i-lucide-lock-open'"
            class="size-4.5"
          />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold text-highlighted">
            App lock
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ enabled ? 'On. The app asks for your PIN after you’ve been away, in every window.' : 'Ask for a PIN before the app shows anything, after you’ve been away or when you lock it.' }}
          </p>
        </div>
      </div>

      <p class="rounded-md bg-elevated px-3 py-2.5 text-sm text-muted">
        This hides your mail from someone at your desk. It doesn’t encrypt anything: mail kept on this computer is only as safe as the computer’s own sign-in.
      </p>

      <p
        v-if="!available"
        class="text-sm text-warning"
      >
        App lock needs a secure (https) address or the desktop app.
      </p>

      <div
        v-else-if="!form"
        class="lb-in flex flex-wrap gap-2"
      >
        <UButton
          v-if="!enabled"
          label="Turn on app lock"
          icon="i-lucide-lock"
          @click="show('on')"
        />
        <template v-else>
          <UButton
            label="Lock now"
            icon="i-lucide-lock"
            @click="lock()"
          />
          <UButton
            label="Change PIN"
            color="neutral"
            variant="outline"
            @click="show('change')"
          />
          <UButton
            label="Turn off"
            color="neutral"
            variant="outline"
            @click="show('off')"
          />
        </template>
      </div>

      <form
        v-else
        class="lb-in-up flex flex-col gap-4 rounded-lg p-4 ring ring-default"
        @submit.prevent="submit"
      >
        <h3 class="text-sm font-semibold text-highlighted">
          {{ TITLES[form] }}
        </h3>
        <UFormField
          v-if="form !== 'on'"
          label="Current PIN"
        >
          <UInput
            :model-value="current"
            type="password"
            inputmode="numeric"
            autocomplete="off"
            autofocus
            class="w-40"
            @update:model-value="current = digits(String($event))"
          />
        </UFormField>
        <template v-if="form !== 'off'">
          <UFormField
            :label="form === 'change' ? 'New PIN' : 'PIN'"
            description="4 to 8 digits. It’s kept on this computer only, as a code that can be checked but not read back."
          >
            <UInput
              :model-value="pin"
              type="password"
              inputmode="numeric"
              autocomplete="off"
              :autofocus="form === 'on'"
              class="w-40 mt-1"
              @update:model-value="pin = digits(String($event))"
            />
          </UFormField>
          <UFormField label="Again, to be sure">
            <UInput
              :model-value="repeat"
              type="password"
              inputmode="numeric"
              autocomplete="off"
              class="w-40"
              @update:model-value="repeat = digits(String($event))"
            />
          </UFormField>
        </template>
        <p
          v-if="error"
          class="lb-in text-sm text-error"
          role="alert"
        >
          {{ error }}
        </p>
        <div class="flex gap-2">
          <UButton
            type="submit"
            :label="form === 'off' ? 'Turn off' : form === 'change' ? 'Change PIN' : 'Turn on'"
            :loading="busy"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="show(undefined)"
          />
        </div>
      </form>
    </section>

    <Transition name="lb-collapse">
      <div v-if="enabled">
        <div class="flex flex-col gap-6">
          <UFormField
            label="Lock after"
            description="Time without a key press or a move of the pointer, in any window. Time the app spends closed counts as away."
          >
            <USelect
              :model-value="config.idle"
              :items="APP_LOCK_IDLE"
              class="w-56 mt-1"
              @update:model-value="setIdle(Number($event))"
            />
          </UFormField>

          <USwitch
            v-if="touchId"
            :model-value="config.touchId"
            label="Unlock with Touch ID"
            description="Your fingerprint instead of the PIN. The PIN still works."
            @update:model-value="setTouchId($event)"
          />

          <p class="text-sm text-muted">
            If you forget the PIN, sign out from the lock screen: you’ll sign in again with your mail password, and the lock turns off.
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
