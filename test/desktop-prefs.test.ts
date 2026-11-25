import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// desktop/preload.cjs keeps a copy of what the page stores (theme, the tour
// being done, drafts) with the app, and puts it back when the page comes up on
// an origin with nothing in it: the local server's port had to change. Run
// here against a stand-in for the page and for the app's process
const source = readFileSync(join(__dirname, '..', 'desktop', 'preload.cjs'), 'utf8')

function page(stored: Record<string, string>, kept: Record<string, string> | null) {
  const items = new Map(Object.entries(stored))
  const localStorage = {
    get length() { return items.size },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value)
  }
  const sent: { channel: string, snapshot: Record<string, string> }[] = []
  const handlers: Record<string, () => void> = {}
  const ticks: (() => void)[] = []
  const window = { addEventListener: (name: string, handler: () => void) => (handlers[name] = handler) } as Record<string, unknown>
  window.top = window
  const electron = {
    contextBridge: { exposeInMainWorld: () => {} },
    ipcRenderer: {
      invoke: () => {},
      on: () => {},
      send: (channel: string, snapshot: Record<string, string>) => sent.push({ channel, snapshot }),
      sendSync: (channel: string, snapshot: Record<string, string>) => channel === 'citrusmail:prefs-load' ? kept : (sent.push({ channel, snapshot }), true)
    }
  }
  const document = { documentElement: { classList: { add: () => {} } } }
  new Function('require', 'window', 'document', 'localStorage', 'process', 'setInterval', source)(
    () => electron, window, document, localStorage, { platform: 'win32' }, (handler: () => void) => ticks.push(handler)
  )
  return { items, sent, tick: () => ticks.forEach(run => run()), close: () => handlers.pagehide?.() }
}

describe('what the desktop windows remember', () => {
  const kept = { 'nuxt-color-mode': 'light', 'citrusmail-tour': '{"done":true}', 'something-else': 'x' }

  it('comes back on an origin with nothing in it', () => {
    const { items } = page({}, kept)
    expect(items.get('nuxt-color-mode')).toBe('light')
    expect(items.get('citrusmail-tour')).toBe('{"done":true}')
    expect(items.has('something-else')).toBe(false)
  })

  it('never replaces what an origin already has', () => {
    const { items } = page({ 'nuxt-color-mode': 'dark' }, kept)
    expect(items.get('nuxt-color-mode')).toBe('dark')
    expect(items.has('citrusmail-tour')).toBe(false)
  })

  it('is copied to the app when it changes, and once more as the window closes', () => {
    const { items, sent, tick, close } = page({ 'nuxt-color-mode': 'dark', 'citrusmail-list-cache': 'big', 'other': 'x' }, null)
    tick()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.snapshot).toEqual({ 'nuxt-color-mode': 'dark' })
    tick()
    expect(sent).toHaveLength(1)
    items.set('nuxt-color-mode', 'light')
    close()
    expect(sent).toHaveLength(2)
    expect(sent[1]!.snapshot).toEqual({ 'nuxt-color-mode': 'light' })
  })

  it('does not copy a page that has kept nothing over a real copy', () => {
    const { sent, tick } = page({}, null)
    tick()
    expect(sent).toHaveLength(0)
  })
})
