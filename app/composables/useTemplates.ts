/** Offered once, on request: a thank-you, a follow-up and a meeting proposal */
export const STARTER_TEMPLATES: Omit<ComposeTemplate, 'id'>[] = [
  {
    name: 'Thank you',
    html: '<p>Thank you for getting back to me so quickly.</p><p>This is exactly what I needed. I’ll take it from here and let you know how it goes.</p>'
  },
  {
    name: 'Following up',
    html: '<p>I wanted to follow up on my message below, in case it slipped through.</p><p>Is there anything you need from me to move this forward?</p>'
  },
  {
    name: 'Propose a meeting',
    subject: 'Time to talk this week?',
    html: '<p>Would you have half an hour this week to talk it through?</p><p>I’m free on [day] at [time], or tell me what suits you and I’ll make it work.</p>'
  }
]

// Templates: pieces of text you write often, saved on this computer for each
// mailbox and dropped into a message where the cursor is
const _useTemplates = () => {
  const toast = useToast()
  const { draft, editor, open, hasDraft, drafts, activate, compose } = useComposer()
  const templates = useAccountPref<ComposeTemplate[]>('templates', () => [])

  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const byName = (list: ComposeTemplate[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  function add(template: Omit<ComposeTemplate, 'id'>) {
    templates.value = byName([...templates.value, { ...template, id: newId() }])
  }

  /** The message on screen, as it stands, under a name */
  function saveCurrent(name: string): boolean {
    const html = draft.value.html.trim()
    if (!name.trim() || !html || html === '<p></p>') return false
    add({ name: name.trim(), subject: draft.value.subject.trim() || undefined, html })
    toast.add({ title: 'Template saved', description: name.trim(), icon: 'i-lucide-file-text' })
    return true
  }

  function rename(id: string, name: string) {
    if (!name.trim()) return
    templates.value = byName(templates.value.map(item => item.id === id ? { ...item, name: name.trim() } : item))
  }

  function remove(id: string) {
    const gone = templates.value.find(item => item.id === id)
    if (!gone) return
    templates.value = templates.value.filter(item => item.id !== id)
    toast.add({
      title: 'Template deleted',
      description: gone.name,
      icon: 'i-lucide-trash-2',
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => (templates.value = byName([...templates.value, gone])) }]
    })
  }

  /** The three starters, leaving out any whose name is already taken */
  function addStarters() {
    const taken = new Set(templates.value.map(item => item.name.toLowerCase()))
    const fresh = STARTER_TEMPLATES.filter(item => !taken.has(item.name.toLowerCase()))
    templates.value = byName([...templates.value, ...fresh.map(item => ({ ...item, id: newId() }))])
  }

  /** Puts a template where the cursor is, in a new message if none is on screen */
  function insert(template: ComposeTemplate) {
    if (!open.value || !hasDraft.value) {
      const waiting = hasDraft.value ? draft.value : drafts.value.at(-1)
      if (waiting) activate(waiting.id)
      else compose()
    }
    const target = draft.value
    if (!target.subject.trim() && template.subject) target.subject = template.subject
    const live = editor.value
    // An editor that is on screen takes it at the cursor; one still opening starts with it
    if (live && !live.isDestroyed && live.isEditable) live.chain().focus().insertContent(template.html).run()
    else target.html = `${target.html === '<p></p>' ? '' : target.html}${template.html}`
  }

  return { templates, add, saveCurrent, rename, remove, addStarters, insert }
}

export const useTemplates = createAppComposable(_useTemplates)
