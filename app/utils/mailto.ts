import type { Draft } from '~/composables/useComposer'

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // A stray % in a hand-written link: take it as it is
    return value
  }
}

/**
 * A mailto: link as the start of a message: who it goes to, the subject and
 * the body (RFC 6068). Anything else in the link is ignored
 */
export function parseMailto(url: string): Partial<Draft> {
  const link = url.trim().replace(/^mailto:/i, '')
  const mark = link.indexOf('?')
  const path = mark === -1 ? link : link.slice(0, mark)
  const fields = new Map<string, string[]>()
  // Not URLSearchParams: it turns + into a space, which mailto: doesn't
  for (const pair of mark === -1 ? [] : link.slice(mark + 1).split('&')) {
    const equals = pair.indexOf('=')
    if (equals < 1) continue
    const name = decode(pair.slice(0, equals)).toLowerCase()
    fields.set(name, [...(fields.get(name) ?? []), decode(pair.slice(equals + 1))])
  }

  const people = (values: string[]) => {
    const seen = new Set<string>()
    return values.flatMap(value => parseAddresses(value)).filter((address) => {
      const key = address.address.toLowerCase()
      return !seen.has(key) && !!seen.add(key)
    })
  }

  const draft: Partial<Draft> = {}
  const to = people([decode(path), ...(fields.get('to') ?? [])])
  const cc = people(fields.get('cc') ?? [])
  const bcc = people(fields.get('bcc') ?? [])
  if (to.length) draft.to = to
  if (cc.length) draft.cc = cc
  if (bcc.length) draft.bcc = bcc
  const subject = fields.get('subject')?.[0]?.replace(/[\r\n]+/g, ' ').trim()
  if (subject) draft.subject = subject
  const body = fields.get('body')?.join('\n\n').replace(/\r\n?/g, '\n').trim()
  if (body) draft.html = body.split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
  return draft
}
