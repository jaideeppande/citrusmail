/** Where a clicked new-mail banner takes you */
interface DesktopOpen {
  mailbox: string
  folder: string
  /** Absent when the banner summed up several messages: the folder opens */
  id?: string
}

/** A set of windows saved under a name: what each shows and where it sits */
interface DesktopWorkspace {
  id: string
  name: string
  /** How many windows it opens */
  windows: number
}

/** Something chosen in the app's menu bar, tray, Dock or jump list, or a mailto: link clicked elsewhere */
type DesktopCommand
  = | { type: 'compose', mailto?: string }
    | { type: 'navigate', path: string }
    | { type: 'palette' }
    | { type: 'shortcuts' }
    | { type: 'layout', layout: string }
    | { type: 'focus' }
    | { type: 'find' }
    | { type: 'lock' }

/** What the operating system lets the app do, and whether each is on */
interface DesktopSystem {
  /** Opens when you sign in to the computer */
  loginItem: boolean
  /** mailto: links open here */
  defaultMailto: boolean
  /** Touch ID can unlock the app (Mac with a sensor) */
  touchId: boolean
  /** A tray icon is shown (Windows and Linux) */
  tray: boolean
}

/** What the desktop app's preload exposes to the page (desktop/preload.cjs) */
interface CitrusDesktop {
  platform: string
  notify: (notice: { title: string, body?: string, open?: DesktopOpen }) => Promise<boolean>
  onOpen: (handler: (open: DesktopOpen) => void) => () => void

  /** The page may show other pages of the app in frames (split layouts) */
  panes: boolean
  /** Opens `path` in a window of its own; 'popout' has no sidebar until asked */
  openWindow: (path: string, options?: { kind?: 'popout' | 'main', width?: number, height?: number }) => Promise<boolean>
  /** Closes the window that asks */
  closeWindow: () => void
  /** Brings the main window forward, on `path` when given */
  focusMain: (path?: string) => Promise<boolean>

  listWorkspaces: () => Promise<DesktopWorkspace[]>
  /** Saves every open window's place and page under `name`, replacing a workspace of that name */
  saveWorkspace: (name: string) => Promise<DesktopWorkspace[]>
  /** Closes the windows that are open and opens the workspace's */
  openWorkspace: (id: string) => Promise<boolean>
  removeWorkspace: (id: string) => Promise<DesktopWorkspace[]>

  /** This window's zoom: 1 is 100% */
  getZoom: () => Promise<number>
  setZoom: (factor: number) => Promise<number>

  /** Unread count on the Dock, taskbar and tray; `icon` is a small PNG data URL of the number (Windows) */
  setBadge: (count: number, icon?: string) => void
  /** Taskbar and Dock progress from 0 to 1; -1 clears it */
  setProgress: (value: number) => void

  getSystem: () => Promise<DesktopSystem>
  setLoginItem: (on: boolean) => Promise<boolean>
  setDefaultMailto: (on: boolean) => Promise<boolean>
  setCloseToTray: (on: boolean) => void
  /** An Electron accelerator such as 'CommandOrControl+Shift+M'; empty clears it. False when another app holds it */
  setQuickCompose: (accelerator: string) => Promise<boolean>
  promptTouchId: (reason: string) => Promise<boolean>

  onCommand: (handler: (command: DesktopCommand) => void) => () => void
}

interface Window {
  citrusDesktop?: CitrusDesktop
}
