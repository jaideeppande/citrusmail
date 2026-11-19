import { describe, expect, it } from 'vitest'
import { codeLanguage, highlightForMail } from '../app/utils/code-highlight'

describe('code in outgoing mail', () => {
  it('understands the names people type after ```', () => {
    expect(codeLanguage('js')).toBe('javascript')
    expect(codeLanguage('HTML')).toBe('xml')
    expect(codeLanguage('yml')).toBe('yaml')
    expect(codeLanguage('cobol')).toBe('plaintext')
    expect(codeLanguage(null)).toBe('plaintext')
  })

  it('writes the colours as inline styles', () => {
    const html = highlightForMail('const answer = 42 // yes', 'js')
    expect(html).toContain('<span style="color:#cf222e">const</span>')
    expect(html).toContain('<span style="color:#0550ae">42</span>')
    expect(html).toContain('font-style:italic')
    expect(html).not.toContain('class=')
  })

  it('escapes what would otherwise be read as markup', () => {
    expect(highlightForMail('<b>&</b>', 'text')).toBe('&lt;b&gt;&amp;&lt;/b&gt;')
    expect(highlightForMail('if (a < b) return "<p>"', 'javascript')).not.toMatch(/<p>|< b/)
  })

  it('keeps every character of the code', () => {
    const code = 'SELECT name, COUNT(*) FROM people WHERE age > 30 GROUP BY name;'
    const text = highlightForMail(code, 'sql').replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    expect(text).toBe(code)
  })
})
