import type { RemovableRef } from '@vueuse/core'

// What CitrusMail remembers on this computer rather than on the mail server:
// pins, snoozes, layouts, shortcuts and the like. Each lives under its own
// key in local storage, which every window of the app shares, so a change in
// one window shows in the others at once (the browser tells them)
const prefs = new Map<string, RemovableRef<unknown>>()

/** A value kept on this computer, the same one in every window */
export function useLocalPref<T>(name: string, initial: T): RemovableRef<T> {
  const key = `citrusmail-${name}`
  if (!prefs.has(key)) prefs.set(key, useLocalStorage<T>(key, initial, { mergeDefaults: true }) as RemovableRef<unknown>)
  return prefs.get(key) as RemovableRef<T>
}

/**
 * The same, kept apart for each mailbox signed in here: one person's pins
 * and templates never show up in another's
 */
export function useAccountPref<T>(name: string, initial: () => T) {
  const { account } = useShell()
  const all = useLocalPref<Record<string, T>>(name, {})
  return computed<T>({
    get: () => all.value[account.value?.email ?? ''] ?? initial(),
    set: (value) => {
      const email = account.value?.email
      if (email) all.value = { ...all.value, [email]: value }
    }
  })
}
