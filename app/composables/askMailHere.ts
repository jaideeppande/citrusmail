import { z } from 'zod'

const plan = z.object({
  from: z.string().max(200).nullish(),
  subject: z.string().max(200).nullish(),
  text: z.array(z.string().max(100)).max(6).nullish(),
  since: z.iso.date().nullish(),
  before: z.iso.date().nullish(),
  unread: z.boolean().nullish(),
  flagged: z.boolean().nullish(),
  attachments: z.boolean().nullish(),
  interpreted: z.string().max(300).nullish()
})

/**
 * "Ask about your mail", run on this computer: the model turns the question
 * into search terms, every folder but Trash and Junk is searched through the
 * ordinary list, and the model answers from what turned up. The server did
 * the same in one IMAP search; here it is a few list requests instead
 */
export async function askMailHere(question: string): Promise<AiSearchResult> {
  const ai = useAiClient()
  const { folders } = useMail()
  const today = new Date().toISOString().slice(0, 10)
  const terms = await ai.json({ feature: 'ask-mail', system: searchPlannerSystem(today), prompt: question, maxTokens: 1500, effort: 'low' }, plan)
    .catch(() => ({ text: question.split(/\s+/).filter(word => word.length > 3).slice(0, 4) }) as z.infer<typeof plan>)

  const words = (terms.text ?? []).filter(Boolean)
  const searchable = folders.value.filter(folder => folder.role !== 'trash' && folder.role !== 'junk' && folder.role !== 'flagged')
  // The list endpoint searches one phrase at a time: each word is asked for, and the answers pooled
  const queries = [terms.subject, ...words].filter((value): value is string => !!value).slice(0, 4)
  const asks = searchable.flatMap(folder => (queries.length ? queries : [undefined]).map(q => ({ folder: folder.path, q })))

  const found = new Map<string, MessageSummary>()
  for (let at = 0; at < asks.length; at += 3) {
    const pages = await Promise.all(asks.slice(at, at + 3).map(({ folder, q }) => $fetch<MessagePage>('/api/messages', {
      query: { folder, q, from: terms.from || undefined, unread: terms.unread ? 1 : undefined, flagged: terms.flagged ? 1 : undefined, attachments: terms.attachments ? 1 : undefined }
    }).catch(() => undefined)))
    for (const page of pages) {
      for (const message of page?.messages ?? []) {
        const day = message.date.slice(0, 10)
        if (terms.since && day < terms.since) continue
        if (terms.before && day >= terms.before) continue
        found.set(messageKey(message), message)
      }
    }
  }
  const messages = [...found.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)

  let answer = messages.length ? '' : 'Nothing in your mail matches that.'
  if (messages.length) {
    answer = await ai.text({ feature: 'ask-mail', system: searchAnswerSystem, prompt: `Question: ${question}\n\nSearch results (newest first):\n${messageLines(messages)}`, maxTokens: 1200, effort: 'low' }).catch(() => '')
  }
  return { answer, messages, interpreted: terms.interpreted || question }
}
