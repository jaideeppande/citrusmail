// AI Reply: the model writes a reply into the composer as you watch, then
// quick changes ("Shorter", "Warmer") rewrite it in place
/** Tone rewrite: what the toolbar's popover offers for a reply you wrote yourself */
export const TONE_EDITS = [
  { label: 'Shorter', icon: 'i-lucide-minimize-2', change: 'Make it noticeably shorter. Keep every fact and the meaning.' },
  { label: 'Friendlier', icon: 'i-lucide-smile', change: 'Make the tone warmer and friendlier. Keep the content the same.' },
  { label: 'More formal', icon: 'i-lucide-briefcase', change: 'Make the tone more formal and professional. Keep the content the same.' },
  { label: 'Fix grammar', icon: 'i-lucide-spell-check', change: 'Fix spelling, grammar and punctuation only. Change nothing else: keep the wording, tone and length.' }
]

export const QUICK_EDITS = [
  { label: 'Shorter', icon: 'i-lucide-minimize-2', change: 'Make it noticeably shorter.' },
  { label: 'Longer', icon: 'i-lucide-maximize-2', change: 'Add a little more detail and context.' },
  { label: 'Warmer', icon: 'i-lucide-smile', change: 'Make the tone warmer and friendlier.' },
  { label: 'More formal', icon: 'i-lucide-briefcase', change: 'Make the tone more formal and professional.' },
  { label: 'Say yes', icon: 'i-lucide-check', change: 'Accept or agree to what was asked.' },
  { label: 'Decline politely', icon: 'i-lucide-x', change: 'Politely decline what was asked.' }
]

const _useAiReply = () => {
  const toast = useToast()
  const { stream } = useAi()
  const { draft, editor, reply } = useComposer()

  const writing = ref(false)
  const written = ref(false)
  const instruction = ref('')
  const lastChange = ref('')
  /** The words as they were before the last rewrite, to go back to */
  const previous = ref<string>()
  let controller: AbortController | undefined

  // Another draft on screen starts the AI panel over
  watch(() => draft.value.id, () => {
    // What was being written belongs to the message left behind
    controller?.abort()
    written.value = false
    instruction.value = ''
    previous.value = undefined
  })

  async function run(body: Record<string, unknown>): Promise<boolean> {
    // The draft it started on, even if another takes the screen meanwhile
    const target = draft.value
    const source = target.replyingTo
    if (!source) return false
    controller?.abort()
    const mine = controller = new AbortController()
    const before = target.html
    writing.value = true
    editor.value?.setEditable(false)
    try {
      const text = await stream('/api/ai/reply', { ...source, ...body }, (sofar) => {
        if (!mine.signal.aborted) target.html = textToHtml(sofar)
      }, mine.signal)
      target.html = textToHtml(text)
      written.value = true
      return true
    } catch (error) {
      // Half a rewrite is worse than none: your own words come back
      if (body.tweak) target.html = before
      if ((error as Error).name !== 'AbortError') {
        toast.add({ title: 'AI Reply didn’t work', description: (error as Error).message, color: 'error', icon: 'i-lucide-circle-alert' })
      }
      return false
    } finally {
      // Unless a newer run has taken over the editor
      if (controller === mine) {
        writing.value = false
        editor.value?.setEditable(true)
        editor.value?.commands.focus('end')
      }
    }
  }

  function write() {
    lastChange.value = ''
    return run({ instruction: instruction.value.trim() || undefined })
  }

  function tweak(change: string) {
    lastChange.value = change
    const current = editor.value?.getText({ blockSeparator: '\n\n' }) ?? ''
    return run({ draft: current, tweak: change })
  }

  /**
   * Tone rewrite, from the toolbar or /tone: the reply as you wrote it,
   * changed as asked. Undo puts your own words back
   */
  async function rewrite(change: string) {
    const target = draft.value
    const before = target.html
    if (!await tweak(change)) return
    previous.value = before
    const id = `rewrite-${target.id}`
    toast.add({
      id,
      title: 'Rewritten',
      description: 'Read it through before you send.',
      icon: 'i-lucide-sparkles',
      duration: 10_000,
      actions: [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => {
        toast.remove(id)
        undoRewrite()
      } }]
    })
  }

  function undoRewrite() {
    if (previous.value === undefined || writing.value) return
    draft.value.html = previous.value
    previous.value = undefined
  }

  function stop() {
    controller?.abort()
  }

  /** From a message: opens the reply and starts writing it */
  async function replyWithAi(message: MessageDetail, all = false) {
    reply(message, all)
    await nextTick()
    await write()
  }

  return { writing, written, instruction, lastChange, previous, write, tweak, rewrite, undoRewrite, stop, replyWithAi }
}

export const useAiReply = createAppComposable(_useAiReply)
