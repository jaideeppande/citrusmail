// CitrusMail for the desktop. The web app's own server (the Nuxt build in .output)
// runs inside this process on a local port, and the app's windows show it:
// the main one, and any number of others opened beside it (a message, the
// composer, the calendar on a second monitor). Mail passwords still live only
// in the sealed session cookie, now in this app's own browser profile, and
// settings land in the app's data folder
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Notification, screen, session, shell, systemPreferences, Tray } from 'electron'
import updater from 'electron-updater'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// The brand folder this app was built with (CITRUSMAIL_BRAND_DIR at build
// time): its name, its servers, its images. See "Desktop app" in the README
const brandDir = app.isPackaged
  ? join(process.resourcesPath, 'brand')
  : resolve(process.env.CITRUSMAIL_BRAND_DIR || join(here, '..', 'brand'))

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

// app.env: KEY=value lines, the same variables a hosted instance takes. Only
// NUXT_ settings are read, so a brand can't switch off the app's own guards
function loadBrandEnv() {
  let text
  try {
    text = readFileSync(join(brandDir, 'app.env'), 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(NUXT_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || match[1] === 'NUXT_APP_SECRET') continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadBrandEnv()
const brand = readJson(join(brandDir, 'desktop.json'))
const appName = brand.productName || process.env.NUXT_PUBLIC_BRAND_NAME || 'CitrusMail'
const DEFAULT_PORT = 51730
const desktopToken = randomBytes(32).toString('hex')

const isOurs = (url) => {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

// Sign in with Microsoft happens on Microsoft's own pages, in this window,
// so the cookie that ties the attempt together and the app's header both
// reach the callback. Anything else still opens in the browser
const SIGN_IN_HOSTS = ['login.microsoftonline.com', 'login.live.com', 'login.microsoft.com', 'account.live.com', 'device.login.microsoftonline.com']
const isSignIn = (url) => {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && SIGN_IN_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

// Before anything asks for userData: each brand keeps its own data folder
app.setName(appName)
if (!app.requestSingleInstanceLock()) app.quit()

// The port is kept between launches: the session cookie and the saved
// appearance belong to the origin, so a new port would sign you out
function loadConfig() {
  const file = join(app.getPath('userData'), 'desktop.json')
  let config = {}
  try {
    config = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // First launch: nothing saved yet
  }
  config.sessionPassword ||= randomBytes(32).toString('hex')
  return { config, save: () => writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 }) }
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port, '127.0.0.1')
  })
}

function anyPort() {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function startServer() {
  const data = app.getPath('userData')
  mkdirSync(data, { recursive: true })
  const { config, save } = loadConfig()
  let port = config.port ?? DEFAULT_PORT
  if (!(await isFree(port))) port = await anyPort()
  config.port = port
  save()

  // The server keeps per-account settings in ./.data, so this puts them here
  process.chdir(data)
  process.env.NITRO_HOST = '127.0.0.1'
  process.env.NITRO_PORT = String(port)
  process.env.NUXT_APP_SECRET = config.sessionPassword
  // Mail servers on this Mac or your network are fine here (Proton Mail Bridge)
  process.env.CITRUSMAIL_DESKTOP = '1'
  // Only this app's window knows this, so nothing else on the Mac can use the server
  process.env.CITRUSMAIL_DESKTOP_TOKEN = desktopToken
  process.env.NUXT_BRAND_DIR = brandDir

  const entry = app.isPackaged
    ? join(process.resourcesPath, 'output', 'server', 'index.mjs')
    : join(here, '..', '.output', 'server', 'index.mjs')
  await import(pathToFileURL(entry).href)

  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin)
      return origin
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error(`The mail server inside ${appName} did not start`)
}

let origin
let quitting = false
app.on('before-quit', () => (quitting = true))

/* Windows ------------------------------------------------------------ */

// Every open window: the main one first (`primary`), then any others. A
// 'main' window is the whole app; a 'popout' is one page of it on its own
const windows = new Map()
let primary
let nextId = 1

// Where windows were left, and the sets of windows saved under a name
const stateFile = () => join(app.getPath('userData'), 'windows.json')
let state
function loadState() {
  state = { bounds: {}, zoom: {}, workspaces: [], closeToTray: false, quickCompose: '', ...readJson(stateFile()) }
}
let saving
function saveState() {
  clearTimeout(saving)
  saving = setTimeout(() => {
    try {
      writeFileSync(stateFile(), JSON.stringify(state, null, 2), { mode: 0o600 })
    } catch {
      // A full disk shouldn't take the app down: the layout just isn't remembered
    }
  }, 400)
}

const DEFAULT_SIZE = { main: { width: 1440, height: 900 }, popout: { width: 1180, height: 820 } }

/**
 * A saved place, if it's still on a screen: a monitor that has since been
 * unplugged would otherwise leave the window where it can't be reached
 */
function placed(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return undefined
  const visible = screen.getAllDisplays().some(({ workArea }) => {
    const overlapX = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x)
    const overlapY = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y)
    return overlapX > 120 && overlapY > 80
  })
  return visible ? bounds : undefined
}

/** Only the app's own pages, by path: never somewhere a caller made up */
function pagePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.length > 2000) return undefined
  try {
    const url = new URL(value, origin)
    return url.origin === origin ? `${url.pathname}${url.search}` : undefined
  } catch {
    return undefined
  }
}

/** The page a window is on, without the mark that says what kind of window it is */
function pathOf(win) {
  try {
    const url = new URL(win.webContents.getURL())
    url.searchParams.delete('win')
    return url.origin === origin ? `${url.pathname}${url.search}` : '/mail/INBOX'
  } catch {
    return '/mail/INBOX'
  }
}

/** What a window remembers its place under: the main window, or a kind of page */
function stateKey(kind, path) {
  if (kind === 'main') return 'main'
  if (path.startsWith('/compose')) return 'compose'
  if (path.startsWith('/calendar')) return 'calendar'
  if (path.startsWith('/contacts')) return 'contacts'
  return /[?&]m=/.test(path) ? 'message' : 'popout'
}

function createWindow({ kind = 'main', path = '/mail/INBOX', bounds, maximized, size, key } = {}) {
  const id = nextId++
  const isPrimary = kind === 'main' && !primary
  const saveAs = key ?? (isPrimary ? 'main' : stateKey(kind, path))
  const saved = bounds ?? placed(state.bounds[saveAs])
  const fallback = { ...DEFAULT_SIZE[kind], ...size }
  // A second window of the same kind opens a little down and right of the first
  const taken = [...windows.values()].filter(entry => entry.key === saveAs).length
  const offset = taken && saved ? { x: saved.x + 28 * taken, y: saved.y + 28 * taken } : {}

  const win = new BrowserWindow({
    ...fallback,
    ...saved,
    ...offset,
    minWidth: kind === 'main' ? 1024 : 480,
    minHeight: kind === 'main' ? 640 : 360,
    title: appName,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1917' : '#f5f5f4',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Closed on a Mac, the window is only hidden and keeps checking for new
      // mail; throttled, those checks would slow to a crawl
      backgroundThrottling: false
    }
  })
  const entry = { id, win, kind, key: saveAs }
  windows.set(id, entry)
  if (isPrimary) primary = entry
  if (maximized ?? state.bounds[saveAs]?.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  if (state.zoom[saveAs]) win.webContents.once('did-finish-load', () => win.webContents.setZoomFactor(state.zoom[saveAs]))

  // Where it's put is remembered, monitor and all, for the next time
  const remember = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    state.bounds[saveAs] = { ...win.getNormalBounds(), maximized: win.isMaximized() }
    saveState()
  }
  win.on('resized', remember)
  win.on('moved', remember)
  win.on('maximize', remember)
  win.on('unmaximize', remember)

  // Links in messages open in the browser, never inside the app. The one
  // exception is the app's own server: an attachment link opens in a new tab
  // on the web, but a browser has neither the session cookie nor the secret
  // header, so here the app downloads it itself instead
  const external = url => /^(https?|mailto):/i.test(url) && shell.openExternal(url)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) win.webContents.downloadURL(url)
    else external(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isOurs(url) || isSignIn(url)) return
    event.preventDefault()
    external(url)
  })
  win.webContents.on('will-redirect', (event, url) => {
    if (!isOurs(url) && !isSignIn(url)) event.preventDefault()
  })
  // The message frame (about:srcdoc) can't be navigated anywhere either; the
  // panes of a split layout are the app's own pages and can
  win.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame || isOurs(event.url) || event.url === 'about:srcdoc') return
    event.preventDefault()
    external(event.url)
  })

  // On a Mac, closing the main window hides it, so new-mail notifications keep
  // coming; elsewhere it does the same when the app is set to stay in the
  // tray. Quitting (Cmd+Q, the Dock or the tray) really closes it. Any other
  // window just closes
  win.on('close', (event) => {
    remember()
    if (quitting || entry !== primary) return
    if (process.platform !== 'darwin' && !(state.closeToTray && tray)) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    windows.delete(id)
    if (primary === entry) primary = [...windows.values()].find(other => other.kind === 'main')
  })

  const url = new URL(path, origin)
  if (kind === 'popout') url.searchParams.set('win', 'popout')
  win.loadURL(url.href)
  return entry
}

app.on('second-instance', (_event, argv) => {
  showWindow()
  handleArgs(argv)
})

// On a Mac the app stays open with no windows, and the Dock icon reopens one
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (primary) primary.win.show()
  else if (origin) createWindow()
})

/** Brings the main window back (it may be hidden behind a closed window) and in front */
function showWindow() {
  if (!origin) return undefined
  const { win } = primary ?? createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  app.focus({ steal: true })
  return win
}

/** The window an IPC message came from, if it is one of the app's own on the app's own page */
function entryOf(event) {
  const entry = [...windows.values()].find(item => item.win.webContents === event.sender)
  return entry && isOurs(event.sender.getURL()) ? entry : undefined
}

/** Something chosen outside the page (menu, tray, Dock, a mailto: link) for the page to carry out */
function command(payload, target) {
  const win = target ?? BrowserWindow.getFocusedWindow() ?? showWindow()
  const entry = [...windows.values()].find(item => item.win === win) ?? primary
  if (!entry) return
  const send = () => entry.win.webContents.send('citrusmail:command', payload)
  // A window still loading would miss it
  if (entry.win.webContents.isLoading()) entry.win.webContents.once('did-finish-load', () => setTimeout(send, 600))
  else send()
}

// New-mail banners come from this process, so they show with the app's own
// icon and name, work with the window closed, and clicking one brings the
// window back. Only the app's own page may ask for one
const text = (value, max) => (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, max)
ipcMain.handle('citrusmail:notify', (event, notice) => {
  if (!entryOf(event)) return false
  if (!Notification.isSupported()) return false
  const title = text(notice?.title, 120) || appName
  const body = text(notice?.body, 240)
  const open = notice?.open && typeof notice.open === 'object'
    ? { mailbox: text(notice.open.mailbox, 254), folder: text(notice.open.folder, 500), id: text(notice.open.id, 100) }
    : undefined
  // The app plays its own sound (Settings → Notifications), so the system stays quiet
  const banner = new Notification({ title, body, silent: true })
  banner.on('click', () => {
    const win = showWindow()
    if (open && win) win.webContents.send('citrusmail:open', open)
  })
  banner.show()
  return true
})

ipcMain.handle('citrusmail:window-open', (event, path, options) => {
  const target = pagePath(path)
  if (!entryOf(event) || !target) return false
  const number = (value, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined
  const width = number(options?.width, 480, 4000)
  const height = number(options?.height, 360, 3000)
  createWindow({ kind: options?.kind === 'main' ? 'main' : 'popout', path: target, size: width && height ? { width, height } : undefined })
  return true
})

ipcMain.on('citrusmail:window-close', (event) => {
  const entry = entryOf(event)
  // The main window is closed from its own buttons, never by a page
  if (entry && entry !== primary) entry.win.close()
})

ipcMain.handle('citrusmail:window-focus-main', (event, path) => {
  if (!entryOf(event)) return false
  const win = showWindow()
  const target = pagePath(path)
  if (win && target) command({ type: 'navigate', path: target }, win)
  return !!win
})

/* Workspaces ---------------------------------------------------------- */

const workspaceList = () => state.workspaces.map(({ id, name, windows: saved }) => ({ id, name, windows: saved.length }))

ipcMain.handle('citrusmail:workspace-list', event => entryOf(event) ? workspaceList() : [])

ipcMain.handle('citrusmail:workspace-save', (event, name) => {
  if (!entryOf(event)) return []
  const label = text(name, 40)
  if (!label) return workspaceList()
  const saved = [...windows.values()]
    .filter(({ win }) => !win.isDestroyed() && win.isVisible())
    // The main window first, so opening the workspace reuses it
    .sort((a, b) => Number(b === primary) - Number(a === primary))
    .map(({ win, kind }) => ({ kind, path: pathOf(win), bounds: win.getNormalBounds(), maximized: win.isMaximized() }))
  const existing = state.workspaces.find(item => item.name.toLowerCase() === label.toLowerCase())
  if (existing) Object.assign(existing, { name: label, windows: saved })
  else state.workspaces.push({ id: randomBytes(6).toString('hex'), name: label, windows: saved })
  state.workspaces = state.workspaces.slice(-20)
  saveState()
  return workspaceList()
})

ipcMain.handle('citrusmail:workspace-open', (event, id) => {
  const workspace = entryOf(event) && state.workspaces.find(item => item.id === id)
  if (!workspace) return false
  const others = [...windows.values()].filter(entry => entry !== primary)
  workspace.windows.forEach((saved, index) => {
    const bounds = placed(saved.bounds)
    const path = pagePath(saved.path) ?? '/mail/INBOX'
    // The first window of a workspace is the main one: it moves rather than reopens
    if (index === 0 && saved.kind === 'main' && primary) {
      const { win } = primary
      if (win.isMaximized()) win.unmaximize()
      if (bounds) win.setBounds(bounds)
      if (saved.maximized) win.maximize()
      win.show()
      command({ type: 'navigate', path }, win)
    } else {
      createWindow({ kind: saved.kind === 'main' ? 'main' : 'popout', path, bounds, maximized: !!saved.maximized, key: `workspace-${id}-${index}` })
    }
  })
  for (const { win } of others) win.close()
  return true
})

ipcMain.handle('citrusmail:workspace-remove', (event, id) => {
  if (!entryOf(event)) return []
  state.workspaces = state.workspaces.filter(item => item.id !== id)
  saveState()
  return workspaceList()
})

/* Zoom, badge and progress -------------------------------------------- */

ipcMain.handle('citrusmail:zoom-get', event => entryOf(event) ? event.sender.getZoomFactor() : 1)
ipcMain.handle('citrusmail:zoom-set', (event, factor) => {
  const entry = entryOf(event)
  if (!entry || !Number.isFinite(factor)) return 1
  const zoom = Math.min(2, Math.max(0.5, Math.round(factor * 100) / 100))
  event.sender.setZoomFactor(zoom)
  state.zoom[entry.key] = zoom
  saveState()
  return zoom
})

// The unread count: on the Dock on a Mac, as an overlay on the taskbar button
// on Windows (drawn by the page, which knows the accent color), and on the tray
let tray
let unread = 0
ipcMain.on('citrusmail:badge', (event, count, icon) => {
  if (!entryOf(event)) return
  unread = Number.isFinite(count) ? Math.max(0, Math.min(99999, Math.round(count))) : 0
  if (process.platform === 'darwin') {
    app.dock?.setBadge(unread ? String(unread) : '')
  } else if (process.platform === 'win32' && primary) {
    const image = unread && typeof icon === 'string' && icon.startsWith('data:image/png;base64,') && icon.length < 50_000
      ? nativeImage.createFromDataURL(icon)
      : null
    primary.win.setOverlayIcon(image && !image.isEmpty() ? image : null, unread ? `${unread} unread` : '')
  } else {
    app.setBadgeCount(unread)
  }
  tray?.setToolTip(unread ? `${appName}: ${unread} unread` : appName)
})

ipcMain.on('citrusmail:progress', (event, value) => {
  const entry = entryOf(event)
  if (entry) entry.win.setProgressBar(Number.isFinite(value) && value >= 0 ? Math.min(1, value) : -1)
})

/* The operating system ------------------------------------------------ */

const system = () => ({
  loginItem: app.getLoginItemSettings().openAtLogin,
  defaultMailto: app.isDefaultProtocolClient('mailto'),
  touchId: process.platform === 'darwin' && systemPreferences.canPromptTouchID(),
  tray: !!tray
})

ipcMain.handle('citrusmail:system-get', event => entryOf(event) ? system() : { loginItem: false, defaultMailto: false, touchId: false, tray: false })

ipcMain.handle('citrusmail:system-login-item', (event, on) => {
  if (!entryOf(event)) return false
  app.setLoginItemSettings({ openAtLogin: !!on })
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('citrusmail:system-mailto', (event, on) => {
  if (!entryOf(event)) return false
  if (on) app.setAsDefaultProtocolClient('mailto')
  else app.removeAsDefaultProtocolClient('mailto')
  return app.isDefaultProtocolClient('mailto')
})

ipcMain.on('citrusmail:system-close-to-tray', (event, on) => {
  if (!entryOf(event)) return
  state.closeToTray = !!on
  saveState()
})

// A new message from any app: a small window with only the composer in it
function quickCompose(mailto) {
  const cursor = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(cursor)
  const size = { width: 720, height: 680 }
  const bounds = placed(state.bounds.compose) ?? {
    ...size,
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + (workArea.height - size.height) / 3)
  }
  const path = mailto ? `/compose?mailto=${encodeURIComponent(mailto)}` : '/compose'
  const { win } = createWindow({ kind: 'popout', path, bounds, key: 'compose' })
  win.once('ready-to-show', () => {
    win.focus()
    app.focus({ steal: true })
  })
}

function setQuickCompose(accelerator) {
  if (state.quickCompose) globalShortcut.unregister(state.quickCompose)
  state.quickCompose = ''
  if (!accelerator) return true
  let ok = false
  try {
    ok = globalShortcut.register(accelerator, () => origin && quickCompose())
  } catch {
    // Not a shortcut Electron understands
  }
  if (ok) state.quickCompose = accelerator
  return ok
}

ipcMain.handle('citrusmail:system-quick-compose', (event, accelerator) => {
  if (!entryOf(event)) return false
  const ok = setQuickCompose(text(accelerator, 60))
  saveState()
  return ok
})

ipcMain.handle('citrusmail:system-touch-id', async (event, reason) => {
  if (!entryOf(event) || process.platform !== 'darwin' || !systemPreferences.canPromptTouchID()) return false
  try {
    await systemPreferences.promptTouchID(text(reason, 120) || `unlock ${appName}`)
    return true
  } catch {
    return false
  }
})

app.on('will-quit', () => globalShortcut.unregisterAll())

// A mailto: link clicked in another app, or "New message" from the taskbar's
// jump list, arrives as an argument (Windows, Linux) or an event (Mac)
let waiting = []
function handleArgs(argv) {
  const mailto = argv.find(arg => /^mailto:/i.test(arg))
  if (mailto) openMailto(mailto)
  else if (argv.includes('--compose')) origin ? quickCompose() : waiting.push('')
}
function openMailto(url) {
  if (!origin) return waiting.push(url)
  quickCompose(url.slice(0, 4000))
}
app.on('open-url', (event, url) => {
  if (!/^mailto:/i.test(url)) return
  event.preventDefault()
  openMailto(url)
})

/* Menu bar, tray, Dock and jump list ----------------------------------- */

function buildMenu() {
  const mac = process.platform === 'darwin'
  const go = (label, path, accelerator) => ({ label, accelerator, click: () => command({ type: 'navigate', path }) })
  const layout = (label, id) => ({ label, click: () => command({ type: 'layout', layout: id }) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Message', accelerator: 'CmdOrCtrl+N', click: () => command({ type: 'compose' }) },
        { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow({ kind: 'main', key: 'window' }) },
        { type: 'separator' },
        { label: 'Lock', accelerator: 'CmdOrCtrl+Shift+L', click: () => command({ type: 'lock' }) },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Search and Commands…', click: () => command({ type: 'palette' }) },
        { label: 'Focus Mode', click: () => command({ type: 'focus' }) },
        {
          label: 'Layout',
          submenu: [layout('One Pane', 'single'), layout('Side by Side', 'columns'), layout('Stacked', 'rows'), layout('One and Two', 'three'), layout('Four', 'grid')]
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Go',
      submenu: [
        // No accelerators: Ctrl+2 to 4 already switch mailboxes inside the app
        go('Inbox', '/mail/INBOX'),
        go('Calendar', '/calendar'),
        go('Contacts', '/contacts'),
        { type: 'separator' },
        go('Settings', '/settings', 'CmdOrCtrl+,')
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Keyboard Shortcuts', click: () => command({ type: 'shortcuts' }) }]
    }
  ]))
}

function iconFile() {
  const candidates = [join(brandDir, 'tray.png'), join(brandDir, 'icon.png'), join(process.resourcesPath ?? '', 'icon.png'), join(here, 'build', 'icon.png')]
  return candidates.find(file => existsSync(file))
}

function buildTray() {
  // A Mac has the Dock, with its badge and its own menu
  if (process.platform === 'darwin') {
    app.dock?.setMenu(Menu.buildFromTemplate([
      { label: 'New Message', click: () => command({ type: 'compose' }, showWindow()) },
      { label: 'New Window', click: () => createWindow({ kind: 'main', key: 'window' }) }
    ]))
    return
  }
  const file = iconFile()
  if (file) {
    try {
      tray = new Tray(nativeImage.createFromPath(file).resize({ width: 16, height: 16 }))
      tray.setToolTip(appName)
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: `Open ${appName}`, click: () => showWindow() },
        { label: 'New Message', click: () => quickCompose() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ]))
      tray.on('click', () => showWindow())
    } catch {
      // No tray on this desktop: the window's own buttons are all there is
      tray = undefined
    }
  }
  if (process.platform === 'win32') {
    app.setUserTasks([{ program: process.execPath, arguments: '--compose', iconPath: process.execPath, iconIndex: 0, title: 'New message', description: `Write a message in ${appName}` }])
  }
}

function lockDownSession() {
  const ses = session.defaultSession
  // The only permissions the app uses: copying text (hover-to-copy addresses)
  // and new-mail banners
  const allowed = new Set(['clipboard-sanitized-write', 'notifications'])
  ses.setPermissionRequestHandler((contents, permission, callback) => callback(allowed.has(permission) && isOurs(contents.getURL())))
  ses.setPermissionCheckHandler((contents, permission) => allowed.has(permission) && !!contents && isOurs(contents.getURL()))
  // The secret header only ever goes to the app's own server, never to an
  // image host a message points at
  ses.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, 'x-citrusmail-desktop': desktopToken } })
  })
  // Split layouts show the app's own pages in frames beside each other. The
  // server forbids any framing, which is right on the web, where another
  // site could wrap the app; here the only page there is to do the framing
  // is the app itself, so its own origin (and nothing else) is let through
  ses.webRequest.onHeadersReceived({ urls: [`${origin}/*`] }, (details, callback) => {
    const headers = {}
    for (const [name, values] of Object.entries(details.responseHeaders ?? {})) {
      const key = name.toLowerCase()
      if (key === 'x-frame-options') headers[name] = ['SAMEORIGIN']
      else if (key === 'content-security-policy') headers[name] = values.map(value => value.replace(/frame-ancestors\s+'none'/i, 'frame-ancestors \'self\''))
      else headers[name] = values
    }
    callback({ responseHeaders: headers })
  })
  // Downloads land in the Downloads folder (a new name if taken) and the
  // Finder shows the file when it's done. No save dialog to click through
  ses.on('will-download', (_event, item) => {
    const dir = app.getPath('downloads')
    const name = item.getFilename() || 'attachment'
    const [stem, ext] = name.match(/^(.*?)(\.[^.]*)?$/).slice(1)
    let path = join(dir, name)
    for (let n = 2; existsSync(path); n++) path = join(dir, `${stem} ${n}${ext || ''}`)
    item.setSavePath(path)
    item.once('done', (_e, state) => {
      if (state === 'completed') shell.showItemInFolder(path)
    })
  })
}

// Updates: the app looks at the release feed (`publish` in
// electron-builder.config.cjs) on launch and every few hours, downloads a
// newer version quietly, and asks once it is ready. Only a signed build can
// update itself on a Mac, so an ad-hoc build just logs and carries on
const { autoUpdater } = updater
const CHECK_EVERY = 4 * 60 * 60 * 1000
let updateAsked = false

function startUpdates() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('error', error => console.warn('Update check failed:', String(error?.message ?? error).split('\n')[0]))
  autoUpdater.on('update-downloaded', async ({ version }) => {
    if (updateAsked) return
    updateAsked = true
    const { response } = await dialog.showMessageBox(primary?.win ?? undefined, {
      type: 'info',
      message: `${appName} ${version} is ready`,
      detail: 'Restart to finish installing it. Otherwise it installs the next time you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) {
      quitting = true
      autoUpdater.quitAndInstall()
    }
  })
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  // A moment after launch, so the window comes first
  setTimeout(check, 15_000)
  setInterval(check, CHECK_EVERY)
}

app.on('web-contents-created', (_event, contents) => {
  // No <webview>, ever
  contents.on('will-attach-webview', event => event.preventDefault())
})

app.whenReady().then(async () => {
  loadState()
  origin = await startServer()
  lockDownSession()
  buildMenu()
  buildTray()
  createWindow()
  if (state.quickCompose) setQuickCompose(state.quickCompose)
  // What the app was opened with, and anything that arrived while it started
  handleArgs(process.argv.slice(1))
  for (const url of waiting.splice(0)) url ? openMailto(url) : quickCompose()
  startUpdates()
})
