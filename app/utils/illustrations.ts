// The app's small line illustrations, as data: `<Illustration name="…" />`
// draws them. One family on a 120×96 canvas: a soft disc behind, one object
// in 1.5px lines, one accent detail and one quiet idle motion each. Shapes are
// plain path data, so the pieces that repeat (the disc, the calendar leaf,
// a person) are written once and shared

export const ILLUSTRATIONS = [
  'inbox-zero', 'no-results', 'no-selection', 'empty-folder', 'offline', 'error', 'not-found', 'no-calendar',
  'no-contacts', 'no-events', 'all-read', 'snoozed', 'no-attachments', 'screen', 'later-empty', 'no-notifications',
  'no-drafts', 'no-subscriptions', 'locked', 'welcome'
] as const

export type IllustrationName = typeof ILLUSTRATIONS[number]

/**
 * How a shape is painted. `line`: a stroke in the dimmed text colour; `soft`:
 * the same with the raised-surface fill, so it covers what is behind it;
 * `wash`: that fill alone; `accent` and `accent-soft`: the same two in the
 * accent colour; `dot`: filled with the accent
 */
export type IllustrationTone = 'line' | 'soft' | 'wash' | 'accent' | 'accent-soft' | 'dot'

/** The idle motion of a part: it bobs, draws itself once, blinks, drifts sideways or sways */
export type IllustrationMotion = 'float' | 'draw' | 'blink' | 'drift' | 'sway'

export interface IllustrationShape {
  d: string
  tone: IllustrationTone
}

export interface IllustrationPart {
  shapes: IllustrationShape[]
  motion?: IllustrationMotion
}

export const ILLUSTRATION_WIDTH = 120
export const ILLUSTRATION_HEIGHT = 96

const shape = (tone: IllustrationTone) => (d: string): IllustrationShape => ({ d, tone })
const line = shape('line')
const soft = shape('soft')
const wash = shape('wash')
const accent = shape('accent')
const accentSoft = shape('accent-soft')
const dot = shape('dot')

const part = (shapes: IllustrationShape[], motion?: IllustrationMotion): IllustrationPart => ({ shapes, motion })

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/** A rectangle with rounded corners, from its top left */
function box(x: number, y: number, w: number, h: number, r = 4) {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
}

/* Shared pieces ------------------------------------------------------ */

/** The soft disc every illustration sits on */
const BACKDROP = part([wash(circle(60, 50, 38))])

/** A calendar leaf with its rings and six days */
const CALENDAR = [
  soft(box(36, 26, 48, 48, 6)),
  line('M36 40h48M49 21v10M71 21v10'),
  ...[50, 62].flatMap(y => [48, 60, 72].map(x => line(circle(x, y, 1.1))))
]

/** A cloud about 64 wide, from the left end of its flat base */
const cloud = (x: number, y: number) => `M${x} ${y}a12 12 0 0 1 2-23.8a18 18 0 0 1 34-3.2a14 14 0 0 1 6 27z`

/** A head and shoulders */
const person = (x: number, y: number, head: number, body: number) => [
  soft(`M${x - body} ${y}a${body} ${body} 0 0 1 ${body * 2} 0Z`),
  soft(circle(x, y - body - head - 3, head))
]

/* The set -------------------------------------------------------------- */

export const ILLUSTRATION_PARTS: Record<IllustrationName, IllustrationPart[]> = {
  // The sun coming up over an empty tray
  'inbox-zero': [
    BACKDROP,
    part([
      accent(circle(60, 33, 9)),
      line('M60 16v4M48 21l2.8 2.8M72 21l-2.8 2.8M43 33h4M73 33h4')
    ], 'float'),
    part([
      soft('M32 58l7-14h42l7 14v12a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4z'),
      line('M32 58h15l3 6h20l3-6h15')
    ])
  ],

  // A magnifier that found nothing under it
  'no-results': [
    BACKDROP,
    part([line('M24 36h14M24 46h9M24 56h14M84 36h12M88 46h8')]),
    part([
      soft(circle(58, 46, 17)),
      line('M70.5 58.5L84 72'),
      accent('M51 46h14')
    ], 'float')
  ],

  // A page, and the pointer that hasn't picked one yet
  'no-selection': [
    BACKDROP,
    part([
      soft(box(38, 18, 44, 60, 5)),
      line('M46 32h18M46 42h28M46 52h22M46 62h14')
    ]),
    part([accentSoft('M72 56l4.5 17 3.8-6.6 7.4-1.4z')], 'float')
  ],

  'empty-folder': [
    BACKDROP,
    part([
      line('M30 44V32a4 4 0 0 1 4-4h13l6 6h33a4 4 0 0 1 4 4v6'),
      soft('M26 44h68l-5 27a4 4 0 0 1-4 3.2H35a4 4 0 0 1-4-3.2z')
    ]),
    part([accent('M60 11v8M56 15h8')], 'blink')
  ],

  // A cloud with a line through it
  'offline': [
    BACKDROP,
    part([
      soft(cloud(37, 70)),
      accent('M44 78l32-48')
    ], 'drift')
  ],

  // A plug pulled out of its socket
  'error': [
    BACKDROP,
    part([
      line('M12 64c9 0 7-14 16-14M92 50c9 0 7 14 16 14'),
      soft(box(28, 40, 18, 20, 5)),
      line('M46 45h8M46 55h8'),
      soft(box(72, 38, 20, 24, 5))
    ]),
    part([accent('M63 40v-6M58.5 42.5l-3.5-4.5M67.5 42.5l3.5-4.5')], 'blink')
  ],

  // A signpost pointing both ways
  'not-found': [
    BACKDROP,
    part([line('M60 21v57M47 78h26')]),
    part([
      soft('M60 26h20l6 6-6 6H60z'),
      soft('M60 46H42l-6 6 6 6h18z')
    ], 'sway'),
    part([accent(circle(60, 17, 3))])
  ],

  // A calendar leaf, struck off
  'no-calendar': [
    BACKDROP,
    part(CALENDAR, 'float'),
    part([accentSoft(`${circle(84, 72, 9)}M79.5 76.5l9-9`)])
  ],

  'no-contacts': [
    BACKDROP,
    part([
      ...person(78, 72, 6.5, 13),
      ...person(52, 72, 8.5, 18)
    ]),
    part([accent('M93 22v10M88 27h10')], 'blink')
  ],

  // A calendar leaf with one free day ringed
  'no-events': [
    BACKDROP,
    part(CALENDAR),
    part([accent(circle(60, 50, 5))], 'blink')
  ],

  // A letter in its envelope, ticked
  'all-read': [
    BACKDROP,
    part([soft(box(44, 20, 32, 34, 3))]),
    part([accent('M53 33l5 5 9-10')], 'draw'),
    part([
      soft(box(36, 46, 48, 30, 4)),
      line('M38 49.5l19.2 13a5 5 0 0 0 5.6 0l19.2-13')
    ])
  ],

  // A clock under a moon
  'snoozed': [
    BACKDROP,
    part([
      soft(circle(56, 52, 22)),
      line('M56 39v13l8 5M41 71l-4 6M71 71l4 6')
    ]),
    part([accent('M92 15.5a9 9 0 1 0 6.5 12.5a7.5 7.5 0 0 1-6.5-12.5z')], 'float')
  ],

  // A page with a paperclip and nothing under it
  'no-attachments': [
    BACKDROP,
    part([
      soft(box(38, 26, 46, 54, 5)),
      line('M48 58h26M48 66h26M48 74h14')
    ]),
    part([accent('M50 22v22a7 7 0 0 0 14 0V20a4.5 4.5 0 0 0-9 0v22a2.2 2.2 0 0 0 4.4 0V26')], 'sway')
  ],

  // Someone new, waiting behind a shield
  'screen': [
    BACKDROP,
    part([
      soft('M60 16l24 8v22c0 14-9 25-24 32-15-7-24-18-24-32V24z'),
      line(`${circle(60, 40, 7)}M47 62a13 13 0 0 1 26 0`)
    ]),
    part([dot(circle(89, 19, 3.5))], 'blink')
  ],

  // Cards set aside, with a clock on them
  'later-empty': [
    BACKDROP,
    part([
      line('M42 34v-4a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v4'),
      soft(box(34, 34, 52, 36, 5)),
      line('M44 46h22M44 56h14')
    ]),
    part([
      accentSoft(circle(84, 68, 11)),
      line('M84 62v6.5l4 2.5')
    ], 'float')
  ],

  'no-notifications': [
    BACKDROP,
    part([
      line('M60 27v5'),
      soft('M42 64l4-7V46a14 14 0 0 1 28 0v11l4 7z'),
      accent('M55 69a5 5 0 0 0 10 0')
    ], 'sway')
  ],

  // A page with one line started
  'no-drafts': [
    BACKDROP,
    part([
      soft(box(34, 22, 44, 58, 5)),
      line('M43 36h20M43 46h26')
    ]),
    part([accent('M43 61c4-6 7 6 11 0s7 6 11 0')], 'draw'),
    part([
      soft('M67 69l2.5-8L89 41.5l5.5 5.5L75 66.5z'),
      line('M85.5 45l5.5 5.5')
    ])
  ],

  // A newsletter
  'no-subscriptions': [
    BACKDROP,
    part([
      soft(box(30, 26, 60, 48, 5)),
      accent(box(38, 34, 20, 16, 2)),
      line('M64 36h18M64 44h18M38 58h44M38 66h30')
    ], 'float')
  ],

  'locked': [
    BACKDROP,
    part([
      line('M48 46V36a12 12 0 0 1 24 0v10'),
      soft(box(40, 46, 40, 30, 6)),
      accent(`${circle(60, 57.5, 3.2)}M60 60.7v6`)
    ], 'float')
  ],

  // A paper plane on its way in
  'welcome': [
    BACKDROP,
    part([line(`M30 22v6M27 25h6${circle(98, 62, 1.5)}`)]),
    part([line('M20 76c10 2 20-2 28-12')], 'draw'),
    part([accentSoft('M96 24L46 42l18 8 8 18zM64 50l32-26')])
  ]
}
