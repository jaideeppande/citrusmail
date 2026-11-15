import { common, createLowlight } from 'lowlight'

// Code in a message: the languages the composer colours, and the same
// colouring written out as inline styles for the copy that is sent (a mail
// program reads no stylesheet)

/** What the select on a code block offers. `value` is the grammar's name in highlight.js */
export const CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'HTML / XML' },
  { value: 'css', label: 'CSS' },
  { value: 'bash', label: 'Shell' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'diff', label: 'Diff' },
  { value: 'markdown', label: 'Markdown' }
] as const

// What people type after ``` and what pasted code is tagged with
const ALIASES: Record<string, string> = {
  text: 'plaintext', txt: 'plaintext', plain: 'plaintext',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  html: 'xml', svg: 'xml', vue: 'xml',
  sh: 'bash', shell: 'bash', zsh: 'bash',
  py: 'python',
  yml: 'yaml',
  patch: 'diff',
  md: 'markdown'
}

/** The grammar a language name means, or plain text when it isn't one of ours */
export function codeLanguage(name?: string | null): string {
  const key = (name ?? '').trim().toLowerCase()
  const known = ALIASES[key] ?? key
  return CODE_LANGUAGES.some(language => language.value === known) ? known : 'plaintext'
}

// Only these grammars are registered, so nothing else is ever run over a message
export const lowlight = createLowlight(Object.fromEntries(CODE_LANGUAGES.map(language => [language.value, common[language.value]!])))

export const MAIL_MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,\'Liberation Mono\',monospace'

// Colours for the sent copy, on the light background mail is read on. The
// editor's own (theme-aware) colours are in composer.css
const TOKEN_STYLES: [classes: string[], style: string][] = [
  [['comment', 'quote', 'meta'], 'color:#6e7781;font-style:italic'],
  [['keyword', 'selector-tag', 'doctag', 'type', 'built_in', 'template-tag'], 'color:#cf222e'],
  [['string', 'regexp', 'char.escape', 'template-variable', 'link'], 'color:#0a3069'],
  [['number', 'literal', 'symbol', 'bullet', 'variable.constant'], 'color:#0550ae'],
  [['title', 'title.function', 'title.class', 'section', 'selector-id', 'selector-class'], 'color:#8250df'],
  [['attr', 'attribute', 'property', 'name', 'tag', 'variable', 'selector-attr', 'selector-pseudo', 'params'], 'color:#116329'],
  [['addition'], 'color:#116329;background-color:#dafbe1'],
  [['deletion'], 'color:#82071e;background-color:#ffebe9'],
  [['strong'], 'font-weight:700'],
  [['emphasis'], 'font-style:italic']
]

function tokenStyle(classes: string[]): string | undefined {
  // "hljs-title function_" is how highlight.js writes title.function
  const names = classes.filter(name => name.startsWith('hljs-')).map(name => name.slice(5))
  for (const name of names) {
    const found = TOKEN_STYLES.find(([list]) => list.includes(name))
    if (found) return found[1]
  }
  return undefined
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface HastNode {
  type: string
  value?: string
  properties?: { className?: unknown }
  children?: HastNode[]
}

function serialize(node: HastNode): string {
  if (node.type === 'text') return escape(node.value ?? '')
  const inner = (node.children ?? []).map(serialize).join('')
  if (node.type !== 'element') return inner
  const classes = Array.isArray(node.properties?.className) ? node.properties.className.map(String) : []
  const style = tokenStyle(classes)
  return style ? `<span style="${style}">${inner}</span>` : inner
}

/** Code as HTML whose colours are inline styles; plain escaped text when the language isn't one of ours */
export function highlightForMail(code: string, language?: string | null): string {
  const grammar = codeLanguage(language)
  if (grammar === 'plaintext') return escape(code)
  try {
    return serialize(lowlight.highlight(grammar, code) as HastNode)
  } catch {
    return escape(code)
  }
}
