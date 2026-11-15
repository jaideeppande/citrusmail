export interface ExtraSignature {
  id: string
  name: string
  html: string
}

/** "default", an extra signature's id, or "none" */
export type SignatureChoice = string

// Signatures to choose from in the composer. The one in Settings → Signature
// (kept on the mail server, the same everywhere) is "Default"; the others
// are kept on this computer, per mailbox
export function useSignatures() {
  const { settings } = useSettings()
  const extras = useAccountPref<ExtraSignature[]>('signatures', () => [])

  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const byName = (list: ExtraSignature[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const isEmpty = (html: string) => !html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() && !/<img/i.test(html)

  /** Which signature a draft carries */
  function choiceOf(draft: Pick<Draft, 'signature' | 'signatureId'>): SignatureChoice {
    if (!draft.signature) return 'none'
    if (draft.signatureId && extras.value.some(item => item.id === draft.signatureId)) return draft.signatureId
    return 'default'
  }

  /** The HTML that goes under a draft, if any */
  function htmlOf(draft: Pick<Draft, 'signature' | 'signatureId'>): string {
    const choice = choiceOf(draft)
    if (choice === 'none') return ''
    if (choice === 'default') return settings.value.signature ?? ''
    const html = extras.value.find(item => item.id === choice)?.html ?? ''
    return isEmpty(html) ? '' : html
  }

  function labelOf(choice: SignatureChoice): string {
    if (choice === 'none') return 'No signature'
    if (choice === 'default') return 'Default'
    return extras.value.find(item => item.id === choice)?.name ?? 'Default'
  }

  function add(name: string, html = ''): ExtraSignature {
    const fresh = { id: newId(), name: name.trim().slice(0, 60) || 'Signature', html }
    extras.value = byName([...extras.value, fresh])
    return fresh
  }

  function update(id: string, change: Partial<Omit<ExtraSignature, 'id'>>) {
    extras.value = byName(extras.value.map(item => item.id === id
      ? { ...item, ...change, name: (change.name ?? item.name).trim().slice(0, 60) || item.name }
      : item))
  }

  function remove(id: string) {
    extras.value = extras.value.filter(item => item.id !== id)
  }

  return { extras, choiceOf, htmlOf, labelOf, add, update, remove, hasDefault: computed(() => !!settings.value.signature) }
}
