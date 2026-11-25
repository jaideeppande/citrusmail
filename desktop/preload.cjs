// Marks the page as running in the desktop app, so the layout can make room
// for the window buttons and give the window somewhere to be dragged by, and
// gives it the few things only the app's own process can do: system
// notifications, more windows and where they sit, the unread badge, and what
// the operating system offers (opening at sign-in, mailto: links, Touch ID)
const { contextBridge, ipcRenderer } = require('electron')

const call = channel => (...args) => ipcRenderer.invoke(`citrusmail:${channel}`, ...args)
const say = channel => (...args) => ipcRenderer.send(`citrusmail:${channel}`, ...args)
const on = channel => (handler) => {
  const listener = (_event, payload) => handler(payload)
  ipcRenderer.on(`citrusmail:${channel}`, listener)
  return () => ipcRenderer.removeListener(`citrusmail:${channel}`, listener)
}

contextBridge.exposeInMainWorld('citrusDesktop', {
  platform: process.platform,
  /** Shows a system notification. Clicking it brings the window back and opens `open` */
  notify: call('notify'),
  /** Called with the `open` of a clicked notification */
  onOpen: on('open'),

  panes: true,
  openWindow: call('window-open'),
  closeWindow: say('window-close'),
  focusMain: call('window-focus-main'),

  listWorkspaces: call('workspace-list'),
  saveWorkspace: call('workspace-save'),
  openWorkspace: call('workspace-open'),
  removeWorkspace: call('workspace-remove'),

  getZoom: call('zoom-get'),
  setZoom: call('zoom-set'),

  setBadge: say('badge'),
  setProgress: say('progress'),

  getSystem: call('system-get'),
  setLoginItem: call('system-login-item'),
  setDefaultMailto: call('system-mailto'),
  setCloseToTray: say('system-close-to-tray'),
  setQuickCompose: call('system-quick-compose'),
  promptTouchId: call('system-touch-id'),

  /** Called with what was chosen in the menu bar, tray, Dock or jump list */
  onCommand: on('command'),

  /** AI: this process never sees the key, only asks for writing */
  ai: {
    status: call('ai-status'),
    setKey: call('ai-key'),
    usage: call('ai-usage'),
    setLimit: call('ai-limit'),
    start: say('ai-start'),
    cancel: say('ai-cancel'),
    onEvent: on('ai-event')
  }
})

// What the page keeps in local storage (theme, the tour being done, layouts,
// drafts) belongs to its origin, and the origin has the local server's port in
// it. When that port has to change, the page would start from nothing. The app
// keeps a copy (main.mjs, prefs.json) that is put back here, before any of the
// page's own scripts read it. The list cache is left out: it's large and refetched
const mirrored = key => typeof key === 'string' && (key.startsWith('citrusmail-') || key === 'nuxt-color-mode') && key !== 'citrusmail-list-cache'
const VALUE_LIMIT = 2 * 1024 * 1024

function mirroredKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (mirrored(key)) keys.push(key)
  }
  return keys
}

function restorePrefs() {
  try {
    // Anything already here means this origin has been used: it is the truth
    if (window.top !== window || mirroredKeys().length) return
    const saved = ipcRenderer.sendSync('citrusmail:prefs-load')
    if (!saved) return
    for (const [key, value] of Object.entries(saved)) {
      if (mirrored(key) && typeof value === 'string') localStorage.setItem(key, value)
    }
  } catch {
    // Storage is off or the app didn't answer: the page starts as it would have
  }
}

let lastSaved = ''
function savePrefs(wait) {
  try {
    if (window.top !== window) return
    const snapshot = {}
    for (const key of mirroredKeys()) {
      const value = localStorage.getItem(key)
      if (value !== null && value.length <= VALUE_LIMIT) snapshot[key] = value
    }
    const text = JSON.stringify(snapshot)
    // Nothing kept yet (a page on its way to sign-in) never replaces a real copy
    if (text === lastSaved || text === '{}') return
    lastSaved = text
    if (wait) ipcRenderer.sendSync('citrusmail:prefs-save', snapshot)
    else ipcRenderer.send('citrusmail:prefs-save', snapshot)
  } catch {
    // The next round tries again
  }
}

restorePrefs()
setInterval(savePrefs, 5000)
// A change made just before closing is waited for, so it isn't lost with the window
window.addEventListener('pagehide', () => savePrefs(true))

const mark = () => document.documentElement?.classList.add('desktop', `desktop-${process.platform}`)
mark()
window.addEventListener('DOMContentLoaded', mark)
