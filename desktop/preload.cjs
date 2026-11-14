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
  onCommand: on('command')
})

const mark = () => document.documentElement?.classList.add('desktop', `desktop-${process.platform}`)
mark()
window.addEventListener('DOMContentLoaded', mark)
