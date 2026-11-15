// The editor's HTML made ready for other people's mail programs, which read
// no stylesheet: everything a table, a code block or a picture needs to look
// right is written on the element itself

const TABLE = 'border-collapse:collapse;margin:8px 0'
const CELL = 'border:1px solid #d4d4d4;padding:6px 10px;vertical-align:top;text-align:left'
const HEAD = `${CELL};background-color:#f5f5f5;font-weight:600`
const PRE = `margin:8px 0;padding:12px 14px;background-color:#f6f8fa;border:1px solid #e5e7eb;border-radius:6px;font-family:${MAIL_MONO};font-size:13px;line-height:1.5;color:#24292f;white-space:pre-wrap;word-break:break-word`
const CODE = `font-family:${MAIL_MONO};font-size:0.9em;background-color:#f3f4f6;border-radius:4px;padding:1px 4px`

function addStyle(el: Element, style: string) {
  const before = el.getAttribute('style')?.trim().replace(/;$/, '')
  el.setAttribute('style', before ? `${before};${style}` : style)
}

/** Whether a message has anything that needs the treatment below */
const NEEDS_STYLES = /<(table|pre|code|img)\b/i

export function mailReadyHtml(html: string): string {
  if (!NEEDS_STYLES.test(html)) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

  for (const table of doc.querySelectorAll('table')) {
    // The editor's own sizing (a min-width per column) means nothing in mail
    table.removeAttribute('style')
    table.querySelectorAll('colgroup').forEach(group => group.remove())
    addStyle(table, TABLE)
    table.setAttribute('cellspacing', '0')
    table.setAttribute('cellpadding', '0')
  }
  for (const cell of doc.querySelectorAll('td')) addStyle(cell, CELL)
  for (const cell of doc.querySelectorAll('th')) addStyle(cell, HEAD)

  for (const pre of doc.querySelectorAll('pre')) {
    const code = pre.querySelector('code')
    const language = code?.className.match(/language-([\w-]+)/)?.[1]
    addStyle(pre, PRE)
    if (!code) continue
    code.innerHTML = highlightForMail(code.textContent ?? '', language)
    code.removeAttribute('class')
    addStyle(code, `font-family:${MAIL_MONO}`)
  }
  for (const code of doc.querySelectorAll('code')) {
    if (!code.closest('pre')) addStyle(code, CODE)
  }

  for (const image of doc.querySelectorAll('img')) {
    const style = image.getAttribute('style') ?? ''
    // A width given as an attribute is repeated as a style, which more programs honour
    const width = image.getAttribute('width')
    if (width && !/(^|;)\s*width\s*:/.test(style)) addStyle(image, `width:${/^\d+$/.test(width) ? `${width}px` : width}`)
    if (!/max-width/.test(style)) addStyle(image, 'max-width:100%;height:auto')
  }

  return doc.body.innerHTML
}
