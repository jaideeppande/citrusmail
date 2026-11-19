export interface PrintPart {
  message: MessageDetail
  /** The reader chose to see this message's remote images, so the print has them too */
  remote: boolean
}

const PRINT_STYLE = `
  @page{margin:18mm 16mm}
  html,body{margin:0;padding:0;background:#fff;color:#1c1917}
  body{font:11pt/1.5 system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:16pt;line-height:1.25;margin:0 0 2pt}
  .count{margin:0 0 6pt;font-size:9pt;color:#78716c}
  article{padding-top:10pt}
  article+article{margin-top:16pt;border-top:1px solid #d6d3d1}
  dl{display:grid;grid-template-columns:auto 1fr;gap:1pt 10pt;margin:0 0 12pt;padding-bottom:8pt;border-bottom:1px solid #e7e5e4;font-size:9.5pt}
  dt{color:#78716c}
  dd{margin:0}
  img{max-width:100%;height:auto}
  pre,.plain{white-space:pre-wrap;font:inherit;margin:0}
  blockquote{margin:0 0 0 .25em;padding-left:1em;border-left:2px solid #d6d3d1;color:#57534e}
  .files{margin:12pt 0 0;padding-top:6pt;border-top:1px solid #e7e5e4;font-size:9.5pt;color:#57534e}
`

function headRow(label: string, list: Address[]): string {
  return list.length ? `<dt>${label}</dt><dd>${escapeHtml(list.map(formatAddress).join(', '))}</dd>` : ''
}

function part({ message }: PrintPart): string {
  // The HTML is the server's sanitized copy, the same the reader's frame shows
  const body = message.html ?? `<div class="plain">${escapeHtml(message.text || 'This message has no text.')}</div>`
  const files = message.attachments.length
    ? `<p class="files">${message.attachments.length === 1 ? 'Attachment' : 'Attachments'}: ${message.attachments.map(file => `${escapeHtml(file.filename)} (${formatSize(file.size)})`).join(', ')}</p>`
    : ''
  return `<article><dl>${headRow('From', [message.from])}${headRow('To', message.to)}${headRow('Cc', message.cc)}<dt>Date</dt><dd>${escapeHtml(fullDate(message.date))}</dd></dl><div>${body}</div>${files}</article>`
}

/** The page that gets printed: the subject once, then each message under its own header */
export function printDocument(parts: PrintPart[]): string {
  // The same policy as the reader's frame: nothing remote loads unless the reader already let this message's images in
  const remote = parts.some(item => item.remote) ? ' https: http:' : ''
  const policy = `default-src 'none'; img-src 'self' data: cid:${remote}; style-src 'unsafe-inline'; font-src data:${remote}; media-src 'none'; form-action 'none'`
  const subject = parts.at(-1)?.message.subject || '(No subject)'
  const count = parts.length > 1 ? `<p class="count">${parts.length} messages</p>` : ''
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta charset="utf-8"><title>${escapeHtml(subject)}</title><style>${PRINT_STYLE}</style></head><body><h1>${escapeHtml(subject)}</h1>${count}${parts.map(part).join('')}</body></html>`
}

/**
 * Prints only the message (or the open messages of a conversation), not the
 * app around it: the page is drawn in a frame nobody sees, printed from
 * there (Save as PDF is in the print dialog), and the frame is taken away
 */
export function printMessages(parts: PrintPart[]): Promise<boolean> {
  if (!parts.length || !import.meta.client) return Promise.resolve(false)
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    // No scripts in there, like the reader's own frame; `allow-modals` is what lets it open the print dialog
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'

    let removed = false
    const remove = () => {
      if (removed) return
      removed = true
      frame.remove()
    }

    frame.addEventListener('load', async () => {
      const page = frame.contentWindow
      const doc = frame.contentDocument
      if (!page || !doc) {
        remove()
        return resolve(false)
      }
      // Pictures still on their way would print as gaps; a slow one doesn't hold the dialog for long
      const images = [...doc.images].filter(image => !image.complete)
      await Promise.race([
        Promise.all(images.map(image => new Promise<void>((done) => {
          image.addEventListener('load', () => done(), { once: true })
          image.addEventListener('error', () => done(), { once: true })
        }))),
        new Promise(done => setTimeout(done, 2500))
      ])
      page.addEventListener('afterprint', () => setTimeout(remove, 300), { once: true })
      // Some browsers never say the dialog closed
      setTimeout(remove, 10 * 60_000)
      try {
        page.focus()
        page.print()
        resolve(true)
      } catch {
        remove()
        resolve(false)
      }
    }, { once: true })

    frame.srcdoc = printDocument(parts)
    document.body.appendChild(frame)
  })
}
