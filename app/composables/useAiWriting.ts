import type { JSONContent } from '@tiptap/core'
import { z } from 'zod'
import { AiError } from '~/composables/useAiClient'
import type { AiAsk } from '~/composables/useAiClient'
import type { DiffPart } from '~/utils/ai-writing'

/** What the AI is writing into the draft on screen */
export type AiWritingKind = 'draft' | 'rewrite' | 'proofread' | 'follow-up' | 'meeting'

/** Corrections waiting for Accept or Dismiss: each changed paragraph with what changed in it */
export interface Proofreading {
  draftId: string
  /** The editor's document and HTML they were made for: any edit since and they no longer apply */
  doc: JSONContent
  html: string
  fixed: (string | undefined)[]
  changed: { index: number, parts: DiffPart[], changes: { before: string, after: string }[] }[]
}

const SUBJECT_SCHEMA = z.object({ subjects: z.array(z.string()).min(1).max(6) })

const LABELS: Record<AiWritingKind, string> = {
  'draft': 'Writing your draft',
  'rewrite': 'Rewriting',
  'proofread': 'Checking spelling and grammar',
  'follow-up': 'Writing a follow-up',
  'meeting': 'Writing a reply with your free times'
}

// AI writing for the message being written, beyond the replies AI Reply
// writes: a draft from a few words, tone and proofreading for any message,
// subject lines, follow-ups and replies that offer free times. Everything
// goes through useAiClient, so it runs in the desktop app with the key kept
// there. Every change the AI makes can be taken back in one step: what the
// draft held before goes on a small stack that Undo pops
const _useAiWriting = () => {
  const client = useAiClient()
  const toast = useToast()
  const { account } = useShell()
  const { draft, editor } = useComposer()
  const tools = useComposerTools()

  const busy = ref<AiWritingKind>()
  /** What the AI last wrote into this draft, so the AI line can offer what fits next */
  const landed = ref<AiWritingKind>()
  /** The few words a draft is written from */
  const instruction = ref('')
  let lastInstruction = ''
  const proofreading = shallowRef<Proofreading>()
  const subjects = ref<string[]>([])
  const suggestingSubjects = ref(false)
  /** The draft's words before each AI change, newest last */
  const history = ref<{ draftId: string, html: string }[]>([])
  let controller: AbortController | undefined

  const me = () => ({ email: account.value?.email ?? '', name: account.value?.name })
  const canUndo = computed(() => history.value.at(-1)?.draftId === draft.value.id)
  const label = computed(() => busy.value ? LABELS[busy.value] : '')

  // Another draft on screen starts over: what was asked belongs to the one left behind
  watch(() => draft.value.id, () => {
    controller?.abort()
    landed.value = undefined
    instruction.value = ''
    proofreading.value = undefined
    subjects.value = []
    tools.aiDraft.value = false
  })

  // Corrections are for the words they were made from: typing on drops them
  watch(() => draft.value.html, (html) => {
    if (proofreading.value && html !== proofreading.value.html) proofreading.value = undefined
  })

  function remember(draftId: string, html: string) {
    history.value = [...history.value, { draftId, html }].slice(-20)
  }

  function failed(error: unknown, title: string) {
    if (error instanceof AiError && error.code === 'aborted') return
    if ((error as Error).name === 'AbortError') return
    const description = (error as Error).message || 'Try again in a moment.'
    toast.add({ title, description, color: 'error', icon: 'i-lucide-circle-alert' })
    announce(`${title}. ${description}`, true)
  }

  /** The editor's words as plain text, paragraphs apart */
  function plainDraft() {
    return editor.value?.getText({ blockSeparator: '\n\n' }).trim() ?? ''
  }

  /**
   * Streams the model's answer into the draft as it is written. `show`
   * turns what has come so far into what the editor shows, or undefined to
   * hold it back. A failure puts the draft back as it was; Stop keeps what
   * was written so far. Resolves with the whole answer, or undefined
   */
  async function streamInto(kind: AiWritingKind, ask: AiAsk, show: (text: string) => string | undefined = text => text): Promise<string | undefined> {
    const target = draft.value
    controller?.abort()
    const mine = controller = new AbortController()
    const before = target.html
    busy.value = kind
    landed.value = undefined
    editor.value?.setEditable(false)
    announce(`${LABELS[kind]}…`)
    let text = ''
    try {
      for await (const part of client.stream({ ...ask, signal: mine.signal })) {
        text += part
        const shown = show(text)
        if (shown !== undefined && !mine.signal.aborted) target.html = textToHtmlBlocks(shown)
      }
      remember(target.id, before)
      // Stopped, and the answer simply ended there: what was written stays, unfinished
      return mine.signal.aborted ? undefined : text
    } catch (error) {
      if (mine.signal.aborted && text && target.html !== before) {
        // Stopped by hand: the words so far stay, and Undo still goes back
        remember(target.id, before)
        return undefined
      }
      target.html = before
      failed(error, 'AI writing didn’t work')
      return undefined
    } finally {
      if (controller === mine) {
        busy.value = undefined
        editor.value?.setEditable(true)
        editor.value?.commands.focus('end')
      }
    }
  }

  function stop() {
    controller?.abort()
    announce('Stopped')
  }

  /** Back to the words from before the last AI change, in one step */
  function undo() {
    const last = history.value.at(-1)
    if (!last || last.draftId !== draft.value.id || busy.value) return
    history.value = history.value.slice(0, -1)
    draft.value.html = last.html
    landed.value = undefined
    proofreading.value = undefined
    announce('AI change undone')
  }

  /** Offers Undo for a change made in one go, from a notice */
  function confirmChange(title: string) {
    const id = `ai-writing-${draft.value.id}`
    toast.add({
      id,
      title,
      description: 'Read it through before you send.',
      icon: 'i-lucide-sparkles',
      duration: 10_000,
      actions: [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => {
        toast.remove(id)
        undo()
      } }]
    })
    announce(`${title}. Undo is in the notification.`)
  }

  /* Draft from a few words */

  const people = () => [...draft.value.to, ...draft.value.cc]

  async function writeDraft(words = instruction.value) {
    const asked = words.trim()
    if (!asked || busy.value) return
    lastInstruction = asked
    const wantSubject = !draft.value.subject.trim()
    let subject: string | undefined
    const answer = await streamInto('draft', {
      feature: 'draft',
      system: draftSystem(me(), wantSubject),
      prompt: draftPrompt({ instruction: asked, to: people(), subject: draft.value.subject }),
      maxTokens: 2000,
      effort: 'medium'
    }, (text) => {
      const split = splitDraftAnswer(text, wantSubject)
      subject = split.subject
      return split.settled ? split.body : undefined
    })
    if (answer === undefined) return
    tools.aiDraft.value = false
    landed.value = 'draft'
    // Offered under the subject field, to take with a click
    if (subject && !draft.value.subject.trim()) subjects.value = [subject]
    announce(subject ? `Draft written. Suggested subject: ${subject}. Read it through before you send.` : 'Draft written. Read it through before you send.')
  }

  /** Shorter, friendlier, more formal: the draft on screen rewritten as a whole */
  async function reviseDraft(change: string) {
    const current = plainDraft()
    if (!current || busy.value) return
    const answer = await streamInto('draft', {
      feature: 'draft',
      system: draftSystem(me(), false),
      prompt: draftRevisePrompt({ draft: current, change, to: people(), subject: draft.value.subject }),
      maxTokens: 2000,
      effort: 'medium'
    })
    if (answer === undefined) return
    landed.value = 'draft'
    announce('Draft rewritten')
  }

  function retryDraft() {
    if (lastInstruction) writeDraft(lastInstruction)
  }

  /* Tone and proofreading for a message with no original to read */

  /** Runs `work` with the editor locked, as one AI change with its own Stop */
  async function locked<T>(kind: AiWritingKind, work: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    controller?.abort()
    const mine = controller = new AbortController()
    busy.value = kind
    editor.value?.setEditable(false)
    announce(`${LABELS[kind]}…`)
    try {
      return await work(mine.signal)
    } catch (error) {
      failed(error, kind === 'proofread' ? 'Couldn’t check the spelling' : 'Couldn’t rewrite it')
      return undefined
    } finally {
      if (controller === mine) {
        busy.value = undefined
        editor.value?.setEditable(true)
      }
    }
  }

  /** Puts a new document in the editor and keeps the draft in step with it */
  function replaceDoc(doc: JSONContent) {
    const instance = editor.value
    if (!instance) return
    instance.commands.setContent(doc)
    draft.value.html = instance.getHTML()
  }

  /**
   * Tone rewrite of a new message. Only the words go to the model; tables,
   * pictures, code, quotes and headings stay where they are (see docRuns)
   */
  async function rewrite(change: string) {
    const instance = editor.value
    if (!instance || busy.value) return
    const target = draft.value
    const { runs, layout } = docRuns(instance.getJSON())
    if (!runs.length) {
      toast.add({ title: 'Write something first', description: 'Then it can be rewritten.', icon: 'i-lucide-wand-sparkles' })
      return
    }
    const before = target.html
    const done = await locked('rewrite', async (signal) => {
      const answer = await client.text({
        feature: 'proofread',
        system: rewriteSystem(me(), runs.length),
        prompt: rewritePrompt(runs, change),
        maxTokens: tokensFor(runs.join('\n\n')),
        effort: 'medium',
        signal
      })
      const texts = parseSegments(answer, runs.length)
      if (texts.every(text => text === undefined)) throw new AiError('The AI’s answer didn’t make sense. Try again, or try another provider.', 'invalid')
      // Gone off screen meanwhile: its editor isn't this one any more
      if (draft.value.id !== target.id) return false
      replaceDoc(docFromRuns(layout, texts))
      return true
    })
    if (!done) return
    remember(target.id, before)
    landed.value = 'rewrite'
    confirmChange('Rewritten')
  }

  /**
   * Spelling and grammar, for any message. The corrections wait in a
   * preview (each changed paragraph, changed words marked and listed) for
   * Accept or Dismiss. One paragraph per part, so a fix never moves words
   * between paragraphs, and nothing but paragraph text is sent or changed
   */
  async function proofread() {
    const instance = editor.value
    if (!instance || busy.value) return
    const target = draft.value
    const doc = instance.getJSON()
    const segments = blockSegments(doc)
    if (!segments.length) {
      toast.add({ title: 'Write something first', description: 'Then the spelling can be checked.', icon: 'i-lucide-spell-check' })
      return
    }
    proofreading.value = undefined
    const result = await locked('proofread', async (signal) => {
      const answer = await client.text({
        feature: 'proofread',
        system: proofreadSystem(segments.length),
        prompt: segmentsPrompt(segments),
        maxTokens: tokensFor(segments.join('\n\n')),
        effort: 'low',
        signal
      })
      const fixed = parseSegments(answer, segments.length)
      if (fixed.every(text => text === undefined)) throw new AiError('The AI’s answer didn’t make sense. Try again, or try another provider.', 'invalid')
      return fixed
    })
    if (!result || draft.value.id !== target.id || !editor.value) return
    // Read again now the editor is free: locking and unlocking it can tidy
    // its HTML, and the corrections must match exactly what is on screen
    const now = editor.value.getJSON()
    if (JSON.stringify(blockSegments(now)) !== JSON.stringify(segments)) return
    const changed = segments.flatMap((before, index) => {
      const after = result[index]
      if (after === undefined || after === before) return []
      const parts = wordDiff(before, after)
      return [{ index, parts, changes: diffChanges(parts) }]
    })
    if (!changed.length) {
      toast.add({ title: 'No mistakes found', icon: 'i-lucide-spell-check' })
      announce('No mistakes found')
      return
    }
    proofreading.value = { draftId: target.id, doc: now, html: draft.value.html, fixed: result, changed }
    const count = changed.reduce((sum, item) => sum + Math.max(1, item.changes.length), 0)
    announce(`${count} ${count === 1 ? 'correction' : 'corrections'} suggested. Review them above the editor.`)
  }

  function acceptProofreading() {
    const proposal = proofreading.value
    if (!proposal || proposal.draftId !== draft.value.id) return
    proofreading.value = undefined
    if (!editor.value || JSON.stringify(editor.value.getJSON()) !== JSON.stringify(proposal.doc)) {
      toast.add({ title: 'The message changed', description: 'Check the spelling again to see corrections for it.', icon: 'i-lucide-spell-check' })
      return
    }
    replaceDoc(applyBlockSegments(proposal.doc, proposal.fixed))
    remember(proposal.draftId, proposal.html)
    landed.value = 'proofread'
    confirmChange('Corrections applied')
    editor.value?.commands.focus()
  }

  function dismissProofreading() {
    if (!proofreading.value) return
    proofreading.value = undefined
    announce('Corrections dismissed')
    editor.value?.commands.focus()
  }

  /* Subject lines */

  async function suggestSubjects() {
    const body = plainDraft()
    if (suggestingSubjects.value) return
    if (!body) {
      toast.add({ title: 'Write a little first', description: 'A subject is suggested from what the message says.', icon: 'i-lucide-sparkles' })
      return
    }
    const target = draft.value.id
    suggestingSubjects.value = true
    subjects.value = []
    announce('Suggesting subjects…')
    try {
      const answer = await client.json({
        feature: 'subject',
        system: subjectSystem(),
        prompt: subjectPrompt(body, people()),
        maxTokens: 200,
        effort: 'low'
      }, SUBJECT_SCHEMA)
      if (draft.value.id !== target) return
      subjects.value = cleanSubjects(answer.subjects)
      announce(subjects.value.length ? `${subjects.value.length} subjects suggested: ${subjects.value.join('; ')}` : 'No subject to suggest')
    } catch (error) {
      failed(error, 'Couldn’t suggest a subject')
    } finally {
      suggestingSubjects.value = false
    }
  }

  function pickSubject(subject: string) {
    draft.value.subject = subject
    subjects.value = []
    announce(`Subject set to ${subject}`)
  }

  /* Follow-ups and meeting replies, written into a reply */

  /**
   * A follow-up to your own unanswered message, in place of the fixed one
   * the draft opened with. That one stays when the AI can't write
   */
  async function writeFollowUp(body: { to: Address[], subject: string, days?: number, original: string }) {
    if (!client.enabled('follow-up')) return
    const answer = await streamInto('follow-up', {
      feature: 'follow-up',
      system: followUpSystem(me()),
      prompt: followUpPrompt(body),
      maxTokens: 800,
      effort: 'low'
    })
    if (answer !== undefined) {
      landed.value = 'follow-up'
      announce('Follow-up written. Read it through before you send.')
    }
  }

  /** A reply to a message that asks to meet, offering three of the free times given */
  async function writeMeetingReply(message: MessageDetail, slots: string[], zone: string) {
    const answer = await streamInto('meeting', {
      feature: 'meeting-reply',
      system: meetingSystem(me(), zone),
      prompt: meetingPrompt(slots, messageForPrompt(message, 12_000)),
      maxTokens: 1200,
      effort: 'medium'
    }, text => holdsNoMeeting(text) ? undefined : text)
    if (answer === undefined) return
    if (answer.trim() === NO_MEETING) {
      // Nothing was shown, so there is nothing to take back
      history.value = history.value.slice(0, -1)
      toast.add({ title: 'This message doesn’t seem to ask to meet', description: 'Nothing was written.', icon: 'i-lucide-calendar-x' })
      announce('This message doesn’t seem to ask to meet. Nothing was written.')
      return
    }
    landed.value = 'meeting'
    announce('Reply with three times written. Read it through before you send.')
  }

  return {
    busy, label, landed, instruction, proofreading, subjects, suggestingSubjects, canUndo,
    writeDraft, reviseDraft, retryDraft, rewrite, proofread, acceptProofreading, dismissProofreading,
    suggestSubjects, pickSubject, writeFollowUp, writeMeetingReply, stop, undo
  }
}

export const useAiWriting = createAppComposable(_useAiWriting)
