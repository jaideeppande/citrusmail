// The prompts behind the AI features that used to run only on the server,
// word for word, so the answers read the same whichever side runs them

const who = (address: Address) => address.name ? `${address.name} <${address.address}>` : address.address

/** The message as the model reads it: headers and plain text, trimmed to a sensible length */
export function messageForPrompt(message: MessageDetail, limit = 24_000): string {
  const html = message.html && !message.text ? new DOMParser().parseFromString(message.html, 'text/html').body.textContent ?? '' : ''
  const body = (message.text || html).replace(/\n{3,}/g, '\n\n').trim()
  return [
    `From: ${who(message.from)}`,
    `To: ${message.to.map(who).join(', ')}`,
    message.cc.length ? `Cc: ${message.cc.map(who).join(', ')}` : '',
    `Date: ${message.date}`,
    `Subject: ${message.subject}`,
    '',
    body.length > limit ? `${body.slice(0, limit)}\n[…the rest is cut]` : body
  ].filter(line => line !== '').join('\n')
}

/** Always in the reader's language (Settings → Reading), whatever the email is written in */
export const summarizeSystem = (language: string) => `You summarize one email for its recipient, who is deciding what to do with it.
Write two to four short bullet points, each starting with "- ". Lead with what the sender wants or what happened, then any dates, amounts, deadlines or decisions. If the reader needs to act, the last bullet starts with "!" and says what to do. Plain text only, no headings, no preamble, no closing remark.
Write the summary in ${language}, even when the email is in another language. Keep names, product names and quoted titles as they are.`

export function replySystem(me: { email: string, name?: string }) {
  const writer = me.name ? `${me.name} <${me.email}>` : me.email
  return `You write email replies on behalf of ${writer}. Write only the body of the reply: no subject line, no quoted original, no signature (one is added automatically), and no notes to the writer.
Match the sender's language and level of formality. Be direct and warm, and keep it as short as the situation allows. Open with a greeting that uses the sender's first name when it's known.
Separate paragraphs with a blank line. Use plain text, no Markdown.
Never invent facts, dates, prices, promises or attachments the writer didn't give you. Where the reply needs something only the writer knows, write it in [square brackets] for them to fill in.`
}

export function replyPrompt(message: MessageDetail, body: { instruction?: string, draft?: string, tweak?: string }) {
  const parts = [`The email being replied to:\n\n${messageForPrompt(message)}`]
  if (body.draft && body.tweak) {
    parts.push(`The reply so far:\n\n${body.draft}`, `Rewrite the reply with this change: ${body.tweak}\nKeep everything else that still fits.`)
  } else {
    parts.push(body.instruction ? `What the reply should say: ${body.instruction}` : 'Write the reply the writer most likely wants to send.')
  }
  return parts.join('\n\n---\n\n')
}

export function translateSystem(to: string) {
  const language = languageName(to)
  return `You translate an email into ${language}.
You get the email's text as numbered segments in reading order. Together they form the message; a segment may be only part of a sentence, split off by a link or formatting, with the rest in its neighbours.
First write ⟦lang:xx⟧ with the ISO 639-1 code of the email's original language. Then, for every segment in order, write ⟦n⟧ followed by its translation, and nothing else.
Keep each segment's share of the meaning inside that segment, so links and bold text stay on the right words. Keep names, email addresses, URLs, numbers and codes as they are. A segment already in ${language}, or with nothing to translate, is copied unchanged. Never skip, merge or add segments.`
}

export const translatePrompt = (segments: string[]) => segments.map((text, index) => `⟦${index}⟧${text}`).join('\n')

export const searchPlannerSystem = (today: string) => `You turn a person's question about their own mailbox into search terms. Today is ${today}.
Answer with one JSON object and nothing else, using only these optional keys:
"from" (a name, address or domain fragment), "subject" (one short phrase), "text" (up to 6 words or short phrases that would appear in the message; any of them may match), "since" and "before" (YYYY-MM-DD), "unread", "flagged", "attachments" (booleans), and "interpreted" (a short plain-English line describing the search, e.g. "From Ada, since March, about invoices").
Prefer few, distinctive terms: a search with too many terms finds nothing. Include likely synonyms in "text" (e.g. invoice, receipt, bill). Leave out anything the question doesn't imply.`

export const searchAnswerSystem = 'You answer a question about the reader\'s mailbox from the search results given, in one or two plain sentences. Name the most relevant message by sender and date. If the results don\'t answer it, say what they do contain. No lists, no Markdown.'

/** A list of messages as the model reads it: one line each, numbered */
export function messageLines(messages: MessageSummary[], limit = 20) {
  return messages.slice(0, limit).map((message, index) => `${index + 1}. ${message.date.slice(0, 10)} — from ${message.from.name || message.from.address} — “${message.subject}” — ${message.preview}`).join('\n')
}
