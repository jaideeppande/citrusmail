import type { SignInAdvice } from '~/utils/sign-in-errors'
import { signInAdvice, UNREACHABLE_ADVICE } from '~/utils/sign-in-errors'

/**
 * Where a sign-in is: `connecting` while the mail server is tried (connect
 * and password check are one request, so they're one stage), `loading`
 * while the session and first page load, `done` for the moment before the
 * app takes over
 */
export type SignInStage = 'idle' | 'connecting' | 'loading' | 'done'

/** How long the "signed in" check stays before the app replaces it */
const SUCCESS_PAUSE = 400

export interface SignInForm {
  email: string
  password: string
  name: string
  username: string
  incoming: AccountSettings['incoming']
  outgoing: ServerSettings
  caldav: string
  carddav: string
}

// The sign-in page: discovery runs as the address is typed, so by the time
// the password is in, the servers are known and the form only shows them
// when someone opens the advanced settings
export function useSignIn() {
  const { loggedIn } = useUserSession()
  const config = useRuntimeConfig()
  const route = useRoute()
  /** Adding a mailbox next to the ones already signed in */
  const adding = computed(() => loggedIn.value && Boolean(route.query.add))

  const locked = computed(() => !!config.public.mail?.locked)

  const form = reactive<SignInForm>({
    email: '',
    password: '',
    name: '',
    username: '',
    incoming: { protocol: 'imap', host: '', port: 993, security: 'tls' },
    outgoing: { host: '', port: 465, security: 'tls' },
    caldav: '',
    carddav: ''
  })

  const discovery = ref<DiscoveryResult | null>(null)
  const discovering = ref(false)
  const advancedOpen = ref(false)
  // Fields the person changed by hand are never overwritten by discovery
  const touched = ref(false)
  // Sign in with Microsoft comes back here with what went wrong, if anything
  const error = ref(typeof route.query.error === 'string' ? route.query.error : '')
  const submitting = ref(false)
  const stage = ref<SignInStage>('idle')
  /** The error, placed on the field it concerns and said as what to do next */
  const advice = computed<SignInAdvice | null>(() => {
    if (!error.value) return null
    return error.value === UNREACHABLE_ADVICE.message ? UNREACHABLE_ADVICE : signInAdvice(error.value)
  })

  /** The provider that takes no password, once discovery has said so */
  const oauth = computed(() => discovery.value?.oauth)
  /** Where the Sign in with Microsoft button goes: the server starts the flow */
  const oauthUrl = computed(() => {
    const query = new URLSearchParams({ ...(isEmail(form.email) ? { email: form.email.trim() } : {}), ...(adding.value ? { add: '1' } : {}) })
    return `/api/oauth/${oauth.value}?${query}`
  })

  const email = refDebounced(toRef(form, 'email'), 450)
  /** An address typed but not looked up yet */
  const pending = computed(() => email.value !== form.email)

  // An error is about what was sent; changing it starts over
  watch(() => [form.email, form.password], () => {
    error.value = ''
  })

  let lookup = 0
  watch(email, async (value) => {
    discovery.value = null
    if (!isEmail(value) || locked.value) return

    const current = ++lookup
    discovering.value = true
    try {
      const result = await $fetch<DiscoveryResult>('/api/discover', { method: 'POST', body: { email: value } })
      if (value !== form.email) return
      discovery.value = result
      if (!touched.value) {
        // A JMAP server goes first, as the server will try it first
        const incoming = (result.jmap && !result.oauth ? jmapIncoming(result.jmap) : undefined) ?? result.incoming
        if (incoming) form.incoming = { ...incoming }
        if (result.outgoing) form.outgoing = { ...result.outgoing }
        form.caldav = result.caldav ?? ''
        form.carddav = result.carddav ?? ''
      }
    } catch {
      // Sign-in still works: the server runs discovery again, and the
      // advanced settings are there when it can't
    } finally {
      // An older lookup finishing late leaves the newer one's spinner alone
      if (current === lookup) discovering.value = false
    }
  })

  /** The check-mark moment: long enough to see, short enough not to wait on */
  async function succeed() {
    stage.value = 'done'
    await new Promise(resolve => setTimeout(resolve, SUCCESS_PAUSE))
  }

  /** Discovery found both: switch between JMAP (the default) and IMAP */
  function chooseJmap(jmap: boolean) {
    const found = discovery.value
    const incoming = jmap ? found?.jmap && jmapIncoming(found.jmap) : found?.incoming
    if (!incoming) return
    form.incoming = { ...incoming }
    touched.value = true
  }

  async function submit() {
    // A Microsoft address has no password to send: Enter in the address field goes there instead
    if (oauth.value && !advancedOpen.value && !touched.value) {
      if (discovery.value?.oauthReady) window.location.assign(oauthUrl.value)
      return
    }
    error.value = ''
    submitting.value = true
    stage.value = 'connecting'
    try {
      await $fetch('/api/session', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          add: adding.value || undefined,
          ...(touched.value || advancedOpen.value
            ? {
                username: form.username.trim() || undefined,
                incoming: form.incoming.host ? form.incoming : undefined,
                outgoing: form.outgoing.host ? form.outgoing : undefined,
                caldav: form.caldav.trim() || undefined,
                carddav: form.carddav.trim() || undefined
              }
            : {})
        }
      })
      stage.value = 'loading'
      // A fresh load, so the new mailbox starts with nothing of the last one on screen
      if (adding.value) {
        await succeed()
        return window.location.assign('/mail/INBOX')
      }
      await succeed()
      // A fresh load here too: after a sign-out in this window, the last account's
      // settings, signature and contacts would otherwise still be the ones loaded
      return window.location.assign('/mail/INBOX')
    } catch (failure) {
      stage.value = 'idle'
      const { data, response } = failure as { data?: { message?: string }, response?: unknown }
      // No response at all: the request never reached the server
      error.value = data?.message ?? (response ? 'Couldn’t sign in. Try again in a moment.' : UNREACHABLE_ADVICE.message)
      // When the error is about the servers and discovery had none to
      // offer, the settings come forward with it. A wrong password stays
      // on the form, where it gets fixed
      if (!discovery.value?.incoming && advice.value?.field === 'server') advancedOpen.value = true
    } finally {
      submitting.value = false
    }
  }

  return { form, adding, locked, discovery, discovering, pending, advancedOpen, touched, error, advice, stage, submitting, submit, oauth, oauthUrl, chooseJmap }
}
