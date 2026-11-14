// Split layouts: the window divided into up to four panes, each showing a
// page of the app. The first pane is the app itself; the others are frames
// of it, so each keeps its own place (a folder, the calendar, a contact)
// and they stay in step through the window bus like separate windows do.
// A frame of the app is only allowed inside the desktop app (the server
// forbids framing everywhere else), so layouts are a desktop feature

export type LayoutId = 'single' | 'columns' | 'rows' | 'three' | 'grid'

export interface LayoutDef {
  id: LayoutId
  label: string
  /** How many panes it has, the main one included */
  panes: number
  /** Cells of a 2 by 2 picture of it, for the picker: [column, row, column span, row span] */
  cells: [number, number, number, number][]
}

export const LAYOUTS: LayoutDef[] = [
  { id: 'single', label: 'One pane', panes: 1, cells: [[0, 0, 2, 2]] },
  { id: 'columns', label: 'Side by side', panes: 2, cells: [[0, 0, 1, 2], [1, 0, 1, 2]] },
  { id: 'rows', label: 'Stacked', panes: 2, cells: [[0, 0, 2, 1], [0, 1, 2, 1]] },
  { id: 'three', label: 'One and two', panes: 3, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]] },
  { id: 'grid', label: 'Four', panes: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]] }
]

interface PaneState {
  layout: LayoutId
  /** What each extra pane shows, as a path; index 0 is pane 1 */
  paths: string[]
  /** Where the dividers sit, as a share of the window: columns, then rows */
  split: [number, number]
}

/** What a new pane opens on: the pages people put beside their mail */
const defaultPaths = () => [`/calendar/week/${todayDate().toString()}`, '/contacts', '/mail/INBOX']

const _usePanes = () => {
  const { isMain } = useWindowChrome()
  const state = useLocalPref<PaneState>('panes', { layout: 'single', paths: [], split: [0.5, 0.5] })

  /** Frames of the app can be shown here at all */
  const available = computed(() => isMain && !!desktop()?.panes)
  const layout = computed(() => LAYOUTS.find(item => item.id === state.value.layout) ?? LAYOUTS[0]!)
  const active = computed(() => available.value && layout.value.panes > 1)

  /** The extra panes on screen, with the path each starts on */
  const extras = computed(() => active.value
    ? Array.from({ length: layout.value.panes - 1 }, (_, index) => ({ index: index + 1, path: state.value.paths[index] ?? defaultPaths()[index % 3]! }))
    : [])

  function setLayout(id: LayoutId) {
    state.value = { ...state.value, layout: id }
  }

  function setPath(index: number, path: string) {
    const paths = [...state.value.paths]
    paths[index - 1] = path
    state.value = { ...state.value, paths }
  }

  function setSplit(axis: 0 | 1, share: number) {
    const split: [number, number] = [...state.value.split]
    split[axis] = Math.min(0.8, Math.max(0.2, share))
    state.value = { ...state.value, split }
  }

  /** Closes one pane: the layout drops to the next smaller one and the rest close ranks */
  function close(index: number) {
    const paths = extras.value.map(pane => pane.path).filter((_, i) => i !== index - 1)
    const smaller: Record<LayoutId, LayoutId> = { single: 'single', columns: 'single', rows: 'single', three: 'columns', grid: 'three' }
    state.value = { ...state.value, layout: smaller[state.value.layout], paths }
  }

  // A pane says where it has navigated to, so the layout comes back as it was
  // left; and asks to be closed or popped out from its own header
  onWindowEvent((event) => {
    if (!isMain) return
    if (event.type === 'pane:route') setPath(event.index, event.path)
    else if (event.type === 'pane:close') close(event.index)
    else if (event.type === 'pane:popout') {
      openPopout(event.path)
      close(event.index)
    }
  })

  defineAppShortcuts({
    // Steps through the layouts, back to one pane after the last
    'window.layout': () => {
      if (!available.value) return
      const index = LAYOUTS.findIndex(item => item.id === state.value.layout)
      setLayout(LAYOUTS[(index + 1) % LAYOUTS.length]!.id)
    }
  })

  return { available, active, layout, extras, split: computed(() => state.value.split), setLayout, setPath, setSplit, close }
}

export const usePanes = createAppComposable(_usePanes)
