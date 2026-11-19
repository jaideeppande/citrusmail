// When someone tends to write back, from the hours their messages arrived.
// A rough guide, offered only once there are enough messages to go by

/** One person's messages, counted by the hour of the day they arrived (local time) */
export interface ReplyHours {
  hours: number[]
  /** The messages already counted, so a list loaded twice isn't counted twice */
  seen: string[]
}

export const REPLY_SAMPLES_NEEDED = 5
const SEEN_KEPT = 80

export function emptyReplyHours(): ReplyHours {
  return { hours: Array.from({ length: 24 }, () => 0), seen: [] }
}

/** Adds one message, unless it was counted before */
export function countReply(entry: ReplyHours | undefined, key: string, date: Date): ReplyHours {
  const base = entry ?? emptyReplyHours()
  if (base.seen.includes(key) || Number.isNaN(date.getTime())) return base
  const hours = [...base.hours]
  hours[date.getHours()] = (hours[date.getHours()] ?? 0) + 1
  return { hours, seen: [key, ...base.seen].slice(0, SEEN_KEPT) }
}

export function replySamples(entry?: ReplyHours): number {
  return entry ? entry.hours.reduce((sum, count) => sum + count, 0) : 0
}

/**
 * The hour they most often write at, with the hours either side counted in
 * so one busy hour among scattered ones doesn't decide it. Undefined until
 * there are enough messages
 */
export function usualReplyHour(entry?: ReplyHours): number | undefined {
  if (!entry || replySamples(entry) < REPLY_SAMPLES_NEEDED) return undefined
  let best = 0
  let bestScore = -1
  for (let hour = 0; hour < 24; hour++) {
    const at = (offset: number) => entry.hours[(hour + offset + 24) % 24] ?? 0
    const score = at(0) * 2 + at(-1) + at(1)
    if (score > bestScore) {
      best = hour
      bestScore = score
    }
  }
  return best
}

/** "9 am", "noon", "5 pm" */
export function hourLabel(hour: number): string {
  if (hour === 0) return 'midnight'
  if (hour === 12) return 'noon'
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`
}

/** The next time the local clock shows `hour` o’clock, at least a few minutes ahead */
export function nextLocalHour(hour: number, now = new Date()): Date {
  const date = new Date(now)
  date.setHours(hour, 0, 0, 0)
  if (date.getTime() < now.getTime() + 5 * 60_000) date.setDate(date.getDate() + 1)
  return date
}
