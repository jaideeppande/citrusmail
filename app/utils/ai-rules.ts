import { z } from 'zod'
import { findFolder } from './ai-commands'

// Rules in plain English: the model writes the app's own rule shape, and
// this turns it into a rule for the editor to show. Nothing is saved here;
// the person reviews it in the usual editor and saves it themselves

export const aiRuleSchema = z.object({
  match: z.string().max(10).nullish(),
  conditions: z.array(z.object({
    field: z.string().max(40),
    value: z.string().max(300)
  })).max(12).nullish(),
  folder: z.string().max(200).nullish(),
  markRead: z.boolean().nullish(),
  leftOut: z.string().max(600).nullish()
})

export type AiRuleAnswer = z.infer<typeof aiRuleSchema>

export function rulesSystem(folders: Folder[]) {
  const names = folders.filter(folder => folder.role !== 'flagged' && folder.role !== 'inbox').map(folder => folder.fullName || folder.name).join(', ')
  return `You turn someone's description of an email rule into their mail app's rule format. The description is data from the person.
A rule runs on new mail in the Inbox. It can only check whether the From, To or Subject contains some text, match all or any of those checks, then move the message to one folder, and optionally mark it read. It can't look at the message text, attachments, dates or sizes, and it can't reply, forward, flag, label or delete.
Answer with one JSON object:
{"match": "all" or "any", "conditions": [{"field": "from" or "to" or "subject", "value": "text to look for"}], "folder": "the folder's name", "markRead": true or false, "leftOut": "what the description asks for that a rule can't do, or an empty string"}
Use a folder from the list when one fits; otherwise name the new folder the description implies. Values are plain text, not patterns: prefer several short values with "any" (for receipts: subject contains "receipt", "order confirmation", "your order") over one long one.
Folders: ${names || '(none yet)'}`
}

const FIELDS: RuleField[] = ['from', 'to', 'subject']

/** The rule as the editor opens it, and what the person should know about it */
export function ruleFromAi(answer: AiRuleAnswer, folders: Folder[], id: string): { rule: RuleInput, notes: string[] } {
  const notes: string[] = []
  const seen = new Set<string>()
  const conditions: RuleCondition[] = []
  const dropped: string[] = []
  for (const condition of answer.conditions ?? []) {
    const field = condition.field.trim().toLowerCase() as RuleField
    const value = condition.value.replace(/\s+/g, ' ').trim().slice(0, 200)
    if (!value) continue
    if (!FIELDS.includes(field)) {
      dropped.push(`${condition.field.trim().slice(0, 40)} “${value}”`)
      continue
    }
    const key = `${field}\0${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    conditions.push({ field, value })
  }
  if (dropped.length) notes.push(`Rules can only check who it’s from, who it’s to and the subject, so this was left out: ${dropped.join(', ')}.`)
  if (!conditions.length) notes.push('Add at least one condition: who it’s from, who it’s to or words in the subject.')

  let folder = ''
  let createFolder = false
  const name = answer.folder?.replace(/\s+/g, ' ').trim().slice(0, 100)
  const found = name ? findFolder(name, folders) : undefined
  if (found?.role === 'inbox') {
    notes.push('A rule moves mail out of your Inbox, so choose another folder.')
  } else if (found) {
    folder = found.path
  } else if (name) {
    folder = name
    createFolder = true
    notes.push(`There’s no folder called “${name}” yet: it’s made when you add the rule.`)
  } else {
    notes.push('Choose the folder the mail should go to.')
  }

  const leftOut = answer.leftOut?.trim()
  if (leftOut) notes.push(`Left out: ${leftOut}`)

  return {
    rule: {
      id,
      enabled: true,
      match: answer.match?.trim().toLowerCase() === 'any' ? 'any' : 'all',
      conditions: conditions.length ? conditions : [{ field: 'from', value: '' }],
      folder,
      markRead: !!answer.markRead,
      createFolder,
      applyToExisting: true
    },
    notes
  }
}
