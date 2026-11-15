// An accent for each mailbox signed in here, so it's plain at a glance which
// one is open. Kept on this computer, keyed by address; the theme plugin
// puts the open mailbox's accent over the general one
export function useMailboxAccents() {
  const accents = useLocalPref<Record<string, string>>('mailbox-accents', {})
  const key = (email: string) => email.trim().toLowerCase()

  /** The mailbox's own accent (a hex color), or undefined when it uses the general one */
  function accentOf(email: string): string | undefined {
    const value = accents.value[key(email)]
    return isHexColor(value) ? value : undefined
  }

  /** Empty or undefined gives the mailbox the general accent again */
  function set(email: string, value: string | undefined) {
    const { [key(email)]: _, ...rest } = accents.value
    accents.value = isHexColor(value) ? { ...rest, [key(email)]: value } : rest
  }

  return { accents, accentOf, set }
}
