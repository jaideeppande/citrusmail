import { DEFAULT_APP_LOCK_STATE } from '~/utils/app-lock'

/** When any window last saw a key or the pointer, in ms. Plain storage: it's written often and nothing draws from it */
const ACTIVE_KEY = 'citrusmail-app-lock-active'
const ACTIVE_EVERY = 10_000

// App lock: a PIN before the app shows anything, after you've been away or
// when you lock it yourself. The state lives in storage every window shares,
// so locking one locks them all and a reload doesn't unlock it
const _useAppLock = () => {
  const config = useLocalPref<AppLockConfig>('app-lock', DEFAULT_APP_LOCK)
  const state = useLocalPref<AppLockState>('app-lock-state', DEFAULT_APP_LOCK_STATE)
  const now = useNow({ interval: 1000 })

  /** Hashing needs the browser's crypto, which only a secure page has */
  const available = import.meta.client && !!globalThis.crypto?.subtle
  const enabled = computed(() => config.value.enabled && !!config.value.hash)
  const locked = computed(() => enabled.value && state.value.locked)
  /** Seconds left before another PIN can be tried; 0 when one can */
  const cooldown = computed(() => Math.max(0, Math.ceil((state.value.cooldown - now.value.getTime()) / 1000)))
  const triesLeft = computed(() => Math.max(0, APP_LOCK_TRIES - state.value.tries))

  function lock() {
    if (enabled.value && !state.value.locked) state.value = { ...state.value, locked: true }
  }

  function open() {
    state.value = { ...DEFAULT_APP_LOCK_STATE }
    touch(true)
  }

  const matches = async (pin: string) => !!config.value.hash && await hashPin(pin, config.value.salt) === config.value.hash

  /** Unlocks with the right PIN. A wrong one counts towards the pause */
  async function unlock(pin: string) {
    if (cooldown.value) return false
    if (await matches(pin)) {
      open()
      return true
    }
    const tries = state.value.tries + 1
    state.value = tries >= APP_LOCK_TRIES
      ? { locked: true, tries: 0, cooldown: Date.now() + APP_LOCK_COOLDOWN }
      : { ...state.value, tries }
    return false
  }

  async function unlockWithTouchId() {
    if (!config.value.touchId || !locked.value) return false
    const ok = await desktop()?.promptTouchId('unlock CitrusMail').catch(() => false)
    if (ok) open()
    return !!ok
  }

  /** Turns the lock on, or changes the PIN of one that's on */
  async function setPin(pin: string) {
    if (!available || !isPin(pin)) return false
    const salt = newSalt()
    config.value = { ...config.value, enabled: true, salt, hash: await hashPin(pin, salt), length: pin.length }
    state.value = { ...DEFAULT_APP_LOCK_STATE }
    return true
  }

  /** Turning it off takes the PIN, so it can't be done by whoever walks up */
  async function disable(pin: string) {
    if (!await matches(pin)) return false
    reset()
    return true
  }

  /** Signing out is the way past a forgotten PIN: the mail password is asked for instead */
  function reset() {
    config.value = { ...DEFAULT_APP_LOCK, idle: config.value.idle }
    state.value = { ...DEFAULT_APP_LOCK_STATE }
  }

  function setIdle(idle: number) {
    config.value = { ...config.value, idle }
  }

  function setTouchId(touchId: boolean) {
    config.value = { ...config.value, touchId }
  }

  // Being away: no key or pointer in any window for the chosen time. Each
  // window notes activity in shared storage, so reading in one window
  // doesn't lock the app because another sat untouched
  let noted = 0
  function touch(force = false) {
    const at = Date.now()
    if (!force && at - noted < ACTIVE_EVERY) return
    noted = at
    try {
      localStorage.setItem(ACTIVE_KEY, String(at))
    } catch {
      // Storage is full or blocked: this window's own clock still counts
    }
  }

  function lastActive() {
    try {
      return Math.max(noted, Number(localStorage.getItem(ACTIVE_KEY)) || 0)
    } catch {
      return noted
    }
  }

  function checkIdle() {
    if (!enabled.value || state.value.locked || !config.value.idle) return
    if (Date.now() - lastActive() > config.value.idle * 60_000) lock()
  }

  if (import.meta.client) {
    // Before the first touch: time the app spent closed counts as time away
    checkIdle()
    touch(true)
    // The first move after a long absence is what finds the app idle: it
    // has to lock it, not count as activity
    const active = () => {
      if (Date.now() - noted < ACTIVE_EVERY) return
      checkIdle()
      if (!state.value.locked) touch()
    }
    for (const name of ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const) {
      window.addEventListener(name, active, { passive: true, capture: true })
    }
    setInterval(checkIdle, 15_000)
    // A computer waking from sleep runs no timers until it's looked at
    document.addEventListener('visibilitychange', () => !document.hidden && checkIdle())
    window.addEventListener('focus', checkIdle)
  }

  // In the palette once there's a lock to put on
  useCommands(() => enabled.value
    ? [{ id: 'app-lock', label: 'Privacy', items: [{ label: 'Lock CitrusMail', icon: 'i-lucide-lock', onSelect: lock }] }]
    : [])

  return { config, available, enabled, locked, cooldown, triesLeft, lock, check: matches, unlock, unlockWithTouchId, setPin, disable, reset, setIdle, setTouchId }
}

export const useAppLock = createAppComposable(_useAppLock)
