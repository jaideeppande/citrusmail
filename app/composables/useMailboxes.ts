// The mailboxes signed in on this browser, and moving between them. A switch
// reloads the app, so nothing from the last mailbox is left on screen
const _useMailboxes = () => {
  const { account } = useShell()
  const { clear } = useUserSession()
  const toast = useToast()

  const mailboxes = computed<MailboxSummary[]>(() => account.value?.mailboxes ?? (account.value ? [{ email: account.value.email, name: account.value.name }] : []))
  const others = computed(() => mailboxes.value.slice(1))
  const switching = ref('')

  // A move, a delete or a send still inside its undo time is sent now. Left
  // to the page closing, it would go out after the switch, in the other
  // mailbox: another message moved, or the message sent from the wrong address
  function settle() {
    return Promise.allSettled([useMail().settle(), useComposer().settleSends()])
  }

  /** Opens another signed-in mailbox, at its Inbox or at `to` (a path within the app) */
  async function switchTo(email: string, to = '/mail/INBOX') {
    if (email === account.value?.email) return
    const settled = settle()
    switching.value = email
    try {
      await settled
      await $fetch('/api/session/switch', { method: 'POST', body: { email } })
      window.location.assign(to.startsWith('/') && !to.startsWith('//') ? to : '/mail/INBOX')
    } catch {
      switching.value = ''
      toast.add({ title: 'Couldn’t open that mailbox', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function signOutOf(email: string) {
    await settle()
    const result = await $fetch<{ signedOut: boolean }>('/api/session/mailbox', { method: 'DELETE', query: { email } })
    if (result.signedOut) {
      await clear()
      return window.location.assign('/login')
    }
    window.location.assign('/mail/INBOX')
  }

  async function signOutAll() {
    await settle()
    // This browser stops getting pushes for mailboxes it's no longer signed in to
    await usePush().unsubscribe().catch(() => {})
    await clear()
    // A fresh load: nothing of this account (settings, contacts, the open list) is left for the next one
    window.location.assign('/login')
  }

  function add() {
    return navigateTo({ path: '/login', query: { add: '1' } })
  }

  return { mailboxes, others, switching, switchTo, signOutOf, signOutAll, add }
}

export const useMailboxes = createAppComposable(_useMailboxes)
