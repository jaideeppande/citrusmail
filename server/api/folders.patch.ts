import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  path: z.string().min(1).max(1000),
  name: folderName
})

export default defineEventHandler(async (event) => {
  const { path, name } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const renamed = await withAccount(event, account => mailFor(account).renameFolder(path, name))
  // Rules that filed into the old folder follow it
  const rules = await readStore<MailRule[]>(account, 'rules', [])
  // So do rules for the folders inside it, whose paths start with its own.
  // A new path means paths are full names (IMAP), so the name saved beside it is the path again
  const inside = (rule: MailRule) => rule.folder === path || (rule.folder.startsWith(path) && /^[/.]/.test(rule.folder.slice(path.length)))
  if (renamed !== path && rules.some(inside)) {
    await writeStore(account, 'rules', rules.map(rule => inside(rule) ? { ...rule, folder: renamed + rule.folder.slice(path.length), folderName: undefined } : rule))
  }
  return { path: renamed }
})
