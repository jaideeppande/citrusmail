import { describe, expect, it, vi } from 'vitest'

// A reply or forward names the original's attachments; the server reads them
// from the mailbox and attaches them (server/utils/carry.ts)
const original = [
  'From: a@example.com', 'To: b@example.com', 'Subject: Files', 'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="x"', '',
  '--x', 'Content-Type: text/plain', '', 'See the files.',
  '--x', 'Content-Type: application/pdf; name="report.pdf"', 'Content-Disposition: attachment; filename="report.pdf"', 'Content-Transfer-Encoding: base64', '', Buffer.from('PDF bytes').toString('base64'),
  '--x', 'Content-Type: text/csv; name="data.csv"', 'Content-Disposition: attachment; filename="data.csv"', 'Content-Transfer-Encoding: base64', '', Buffer.from('a,b\n1,2').toString('base64'),
  '--x--', ''
].join('\r\n')

const getSource = vi.fn(async (folder: string) => {
  if (folder !== 'INBOX') throw new Error('gone')
  return Buffer.from(original)
})
vi.stubGlobal('mailFor', () => ({ getSource }))

const { withCarried } = await import('../server/utils/carry')
const account = {} as AccountSettings
const message = { to: [{ address: 'c@example.com' }], subject: 'Fwd: Files', html: '<p>fyi</p>' }
const own = { filename: 'mine.txt', contentType: 'text/plain', content: Buffer.from('mine').toString('base64') }

describe('the original’s attachments on a reply or forward', () => {
  it('are attached by the server, before the ones added by hand', async () => {
    const out = await withCarried(account, { ...message, attachments: [own], carry: { folder: 'INBOX', id: '7', indexes: [0, 1] } })
    expect(out.attachments?.map(file => file.filename)).toEqual(['report.pdf', 'data.csv', 'mine.txt'])
    expect(Buffer.from(out.attachments![0]!.content, 'base64').toString()).toBe('PDF bytes')
    expect(out.attachments![1]!.contentType).toBe('text/csv')
    expect('carry' in out).toBe(false)
  })

  it('leaves out the ones taken off in the composer', async () => {
    const out = await withCarried(account, { ...message, carry: { folder: 'INBOX', id: '7', indexes: [1] } })
    expect(out.attachments?.map(file => file.filename)).toEqual(['data.csv'])
  })

  it('passes a message with none through untouched', async () => {
    getSource.mockClear()
    expect(await withCarried(account, { ...message, attachments: [own] })).toEqual({ ...message, attachments: [own] })
    expect(await withCarried(account, { ...message, carry: { folder: 'INBOX', id: '7', indexes: [] } })).toEqual(message)
    expect(getSource).not.toHaveBeenCalled()
  })

  it('refuses rather than send without them when the original is gone or a file is missing', async () => {
    await expect(withCarried(account, { ...message, carry: { folder: 'Trash', id: '7', indexes: [0] } })).rejects.toMatchObject({ statusCode: 400 })
    await expect(withCarried(account, { ...message, carry: { folder: 'INBOX', id: '7', indexes: [5] } })).rejects.toMatchObject({ statusCode: 400 })
  })
})
