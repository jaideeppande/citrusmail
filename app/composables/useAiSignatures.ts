import type { SignatureDetails } from '~/utils/ai-calendar'

export interface SignatureSuggestion extends SignatureDetails {
  /** The address the message came from */
  from: string
  at: number
}

/** At most this many messages read in one request */
const PER_BATCH = 12

/**
 * Contact details from signatures. New Inbox mail from someone in your
 * contacts has its last stretch (where a signature lives) read by the AI
 * for a phone number, job title and company. What differs from the contact
 * waits on their page as a suggestion; nothing changes without a click
 */
const _useAiSignatures = () => {
  const ai = useAiClient()
  const { account } = useShell()
  const { contacts, status, save } = useContacts()

  /** Contact id → what their latest signature says that the contact doesn't */
  const suggestions = useAccountPref<Record<string, SignatureSuggestion>>('ai-signature-suggestions', () => ({}))
  /** Contact id → the suggestions turned down, so the same one doesn't come back */
  const dismissed = useAccountPref<Record<string, string[]>>('ai-signature-dismissed', () => ({}))

  const fingerprint = (details: SignatureDetails) => [details.phone, details.title, details.company].map(value => (value ?? '').trim().toLowerCase()).join('|')

  const byAddress = computed(() => {
    const map = new Map<string, Contact>()
    for (const contact of contacts.value) {
      for (const email of contact.emails) {
        const key = email.trim().toLowerCase()
        if (key && !map.has(key)) map.set(key, contact)
      }
    }
    return map
  })

  /** The background worker: one request for the batch's messages from contacts */
  async function work(messages: MessageSummary[]) {
    if (!account.value?.hasContacts) return
    // Straight after launch the address book may still be on its way: these messages wait for it rather than pass unread
    if (status.value !== 'success') await until(status).toBe('success', { timeout: 10_000 }).catch(() => {})
    if (status.value !== 'success') throw new Error('The address book isn’t loaded yet')
    const self = account.value.email.toLowerCase()
    const fromContacts = messages
      .filter(message => message.from.address.toLowerCase() !== self && byAddress.value.has(message.from.address.toLowerCase()))
      .slice(0, PER_BATCH)
    if (!fromContacts.length) return

    const cache = useMessageCache()
    const items = (await Promise.all(fromContacts.map(async (message) => {
      try {
        const { message: detail } = await cache.peek(message.folder, message.id)
        const tail = signatureTail(ownWords(messageText(detail)))
        return tail ? { message, from: message.from, tail } : undefined
      } catch {
        return undefined
      }
    }))).filter(item => !!item)
    if (!items.length) return

    const answer = await ai.json({
      feature: 'signature',
      system: SIGNATURE_SYSTEM,
      prompt: signaturePrompt(items),
      maxTokens: 120 + items.length * 60,
      effort: 'low',
      background: true
    }, signatureSchema)

    const next = { ...suggestions.value }
    for (const person of answer.people) {
      const item = items[person.n - 1]
      if (!item) continue
      const contact = byAddress.value.get(item.from.address.toLowerCase())
      if (!contact) continue
      const changes = signatureChanges(contact, { phone: person.phone ?? undefined, title: person.title ?? undefined, company: person.company ?? undefined })
      if (!changes || dismissed.value[contact.id]?.includes(fingerprint(changes))) continue
      next[contact.id] = { ...changes, from: item.from.address, at: Date.now() }
    }
    suggestions.value = next
  }

  /** What to suggest for a contact now: worked out again, since it may have been edited since */
  function suggestionFor(contact: Contact): SignatureSuggestion | undefined {
    const stored = suggestions.value[contact.id]
    if (!stored) return undefined
    const changes = signatureChanges(contact, stored)
    if (!changes || dismissed.value[contact.id]?.includes(fingerprint(changes))) return undefined
    return { ...changes, from: stored.from, at: stored.at }
  }

  function forget(contact: Contact) {
    const { [contact.id]: _gone, ...rest } = suggestions.value
    suggestions.value = rest
  }

  async function accept(contact: Contact) {
    const suggestion = suggestionFor(contact)
    if (!suggestion) return
    const saved = await save(applySignature(contact, suggestion))
    if (saved) {
      forget(contact)
      announce(`${contact.name} updated from their signature`)
    }
  }

  function dismiss(contact: Contact) {
    const suggestion = suggestionFor(contact)
    if (suggestion) {
      dismissed.value = { ...dismissed.value, [contact.id]: [...(dismissed.value[contact.id] ?? []), fingerprint(suggestion)].slice(-10) }
    }
    forget(contact)
    announce('Suggestion dismissed')
  }

  return { work, suggestionFor, accept, dismiss }
}

export const useAiSignatures = createAppComposable(_useAiSignatures)

/**
 * The contacts side of background AI, started once for the whole app (the
 * layout calls this): details from signatures, read from new Inbox mail
 */
export function useAiContactWorkers() {
  const { work } = useAiSignatures()
  useAiBackground().register('signature', work)
}
