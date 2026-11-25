import { simpleParser } from 'mailparser'
import { createError } from 'nuxt/server'

const MAX_ATTACHMENTS = 25 * 1024 * 1024

/**
 * A reply or a forward takes the original's files with it. The composer only
 * names them (`carry`: the message and which of its attachments); they are
 * read from the mailbox here, so they never pass through the browser or sit
 * in a draft there. Returns the message with those files attached, first
 */
export async function withCarried(account: AccountSettings, message: OutgoingMessage): Promise<OutgoingMessage> {
  const { carry, ...rest } = message
  if (!carry?.indexes.length) return rest

  const source = await mailFor(account).getSource(carry.folder, carry.id).catch(() => undefined)
  if (!source) throw createError({ status: 400, message: 'The original message isn’t there any more, so its attachments can’t go along. Remove them and send again.' })
  const parsed = await simpleParser(source, { skipImageLinks: true })

  const files = [...new Set(carry.indexes)].map((index) => {
    const file = parsed.attachments[index]
    if (!file) throw createError({ status: 400, message: 'One of the original’s attachments couldn’t be read. Remove it and send again.' })
    // Named as the reader names them (see toMessageDetail)
    return { filename: file.filename || `attachment-${index + 1}`, contentType: file.contentType || 'application/octet-stream', content: file.content.toString('base64') }
  })

  const attachments = [...files, ...(rest.attachments ?? [])]
  if (attachments.reduce((sum, file) => sum + file.content.length, 0) > MAX_ATTACHMENTS) {
    throw createError({ status: 400, message: 'With the original’s files, the attachments come to more than 25 MB. Remove some and send again.' })
  }
  return { ...rest, attachments }
}
