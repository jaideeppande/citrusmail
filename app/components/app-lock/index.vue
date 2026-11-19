<script setup lang="ts">
// The lock screen: a blurred sheet over the whole window with a PIN field.
// Mounted once in the layout. It hides the app from someone at your desk;
// it does not encrypt anything
const { config, locked, cooldown, triesLeft, unlock, unlockWithTouchId, reset } = useAppLock()
const { signOutAll } = useMailboxes()
const brand = useBrand()
// Mounted once in every window, so the palette has these wherever it opens

const sheet = useTemplateRef<HTMLElement>('sheet')
const pin = ref<number[]>([])
const wrong = ref(false)
const shaking = ref(false)
const signingOut = ref(false)
const signOutFailed = ref(false)

const firstField = () => sheet.value?.querySelector<HTMLInputElement>('input:not(:disabled)')

async function submit(value: (number | string | undefined)[]) {
  const ok = await unlock(value.join(''))
  if (ok) return
  pin.value = []
  wrong.value = true
  // Restarted each time, so a second wrong PIN shakes again
  shaking.value = false
  await nextTick()
  shaking.value = true
  firstField()?.focus()
  // Said at once, over whatever was being read: the PIN has to be typed again
  if (!cooldown.value) announce(`That’s not the PIN. ${triesLeft.value} ${triesLeft.value === 1 ? 'try' : 'tries'} left before a short pause.`, true)
}

watch(pin, value => value.length && (wrong.value = false))

// Everything under the sheet is out of reach while it's up: not clickable,
// not focusable, not read out
watch(locked, async (on) => {
  document.getElementById('__nuxt')?.toggleAttribute('inert', on)
  if (!on) return
  pin.value = []
  wrong.value = false
  signOutFailed.value = false
  await nextTick()
  firstField()?.focus()
  if (config.value.touchId && document.hasFocus()) unlockWithTouchId()
}, { immediate: true })
onBeforeUnmount(() => document.getElementById('__nuxt')?.removeAttribute('inert'))

// The pause starts and ends out loud; when it's over the field takes the
// cursor again
watch(cooldown, async (left, before) => {
  if (!locked.value) return
  if (left && !before) return announce(`Too many wrong PINs. Try again in ${left} seconds.`, true)
  if (left || !before) return
  announce('You can try your PIN again.', true)
  await nextTick()
  firstField()?.focus()
})

// Keys pressed in the sheet stay in it, and Tab goes round the sheet's own
// controls and never out of it
function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key !== 'Tab' || !sheet.value) return
  const items = [...sheet.value.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')]
  if (!items.length) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at === -1 || at === items.length - 1 ? 0 : at + 1)
  // Between the PIN's own digits the browser's order is right
  const inPin = (element?: HTMLElement) => element?.tagName === 'INPUT'
  if (at !== -1 && inPin(items[at]) && inPin(items[next]) && Math.abs(next - at) === 1) return
  event.preventDefault()
  items[next]?.focus()
}

// Keys pressed anywhere but in the sheet go nowhere, so no shortcut can
// archive or open something in the app behind it
for (const name of ['keydown', 'keyup', 'keypress'] as const) {
  useEventListener(window, name, (event: KeyboardEvent) => {
    if (!locked.value || sheet.value?.contains(event.target as Node)) return
    event.preventDefault()
    event.stopPropagation()
    firstField()?.focus()
  }, { capture: true })
}
useEventListener(window, 'focus', () => locked.value && !sheet.value?.contains(document.activeElement) && firstField()?.focus())

// The way past a forgotten PIN: the mail password is asked for again
// instead, and the lock is taken off since its PIN is gone
async function signOut() {
  signingOut.value = true
  signOutFailed.value = false
  try {
    await signOutAll()
    reset()
  } catch {
    signOutFailed.value = true
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="lb-fade">
      <div
        v-if="locked"
        ref="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-lock-title"
        class="lb-lock-sheet fixed inset-0 z-1000 flex flex-col items-center justify-center gap-6 p-6 [-webkit-app-region:no-drag]"
        aria-describedby="app-lock-hint"
        @keydown="onKeydown"
        @keyup.stop
        @keypress.stop
      >
        <div class="lb-in-up flex flex-col items-center gap-5 text-center">
          <AppLogo
            size="lg"
            mark-only
          />
          <div>
            <h1
              id="app-lock-title"
              class="text-lg font-bold tracking-tight text-highlighted"
            >
              {{ brand.name }} is locked
            </h1>
            <p
              id="app-lock-hint"
              class="mt-1 text-sm text-muted"
            >
              Enter your PIN to carry on.
            </p>
          </div>

          <div
            :class="shaking && 'lb-shake'"
            @animationend="shaking = false"
          >
            <UPinInput
              v-model="pin"
              :length="config.length || 4"
              type="number"
              mask
              autofocus
              size="xl"
              :disabled="!!cooldown"
              :color="wrong ? 'error' : 'primary'"
              :highlight="wrong"
              aria-label="PIN"
              @complete="submit($event)"
            />
          </div>

          <p
            class="min-h-5 text-sm"
            :class="cooldown || wrong ? 'text-error' : 'text-muted'"
          >
            <template v-if="cooldown">
              Too many wrong PINs. Try again in {{ cooldown }} {{ cooldown === 1 ? 'second' : 'seconds' }}.
            </template>
            <template v-else-if="wrong">
              That’s not the PIN. {{ triesLeft }} {{ triesLeft === 1 ? 'try' : 'tries' }} left before a short pause.
            </template>
          </p>

          <UButton
            v-if="config.touchId"
            label="Unlock with Touch ID"
            icon="i-lucide-fingerprint"
            color="neutral"
            variant="outline"
            @click="unlockWithTouchId()"
          />
        </div>

        <div class="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-6 text-center">
          <UButton
            label="Sign out instead"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="signingOut"
            @click="signOut"
          />
          <p class="max-w-sm text-xs text-muted">
            <template v-if="signOutFailed">
              Couldn’t sign out. Check your connection and try again.
            </template>
            <template v-else>
              Forgot your PIN? Signing out asks for your mail password again and turns the lock off.
            </template>
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
