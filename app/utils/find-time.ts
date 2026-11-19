import { calZoneDay, calZoneDayShift, calZoneName, calZoneRange } from './zone-labels'

// Find a time: the free slots marked on the grid, written out as the few
// lines one pastes into a message. Nothing here is saved as an event

/** A stretch of time offered to someone */
export interface FreeSlot {
  start: Date
  end: Date
}

/** In the order they happen, with the ones that touch or overlap run together */
export function mergeFreeSlots(slots: FreeSlot[]): FreeSlot[] {
  const sorted = slots
    .filter(slot => slot.end > slot.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: FreeSlot[] = []
  for (const slot of sorted) {
    const last = merged.at(-1)
    if (last && slot.start <= last.end) {
      if (slot.end > last.end) {
        last.end = slot.end
      }
    } else {
      merged.push({ start: slot.start, end: slot.end })
    }
  }

  return merged
}

/** The slot a moment falls inside, the one a second click on it takes away */
export function freeSlotAt(slots: FreeSlot[], moment: Date): FreeSlot | undefined {
  return slots.find(slot => moment >= slot.start && moment < slot.end)
}

/** What is left of the slots once a stretch is cut out of them */
export function cutFreeSlots(slots: FreeSlot[], cut: FreeSlot): FreeSlot[] {
  return slots.flatMap((slot) => {
    if (cut.end <= slot.start || cut.start >= slot.end) {
      return [slot]
    }

    return [
      ...(cut.start > slot.start ? [{ start: slot.start, end: cut.start }] : []),
      ...(cut.end < slot.end ? [{ start: cut.end, end: slot.end }] : [])
    ]
  })
}

/**
 * One slot as a line of text, in the writer's zone: “Tue 17 Nov, 10:00 – 10:30
 * (GMT)”. With a second zone the same span follows as it reads there, with its
 * own day when that is another one: “… · 05:00 – 05:30 (GMT-5)”
 */
export function freeSlotLine(slot: FreeSlot, zone: string, second?: string): string {
  const line = `${calZoneDay(slot.start, zone)}, ${calZoneRange(slot.start, slot.end, zone)} (${calZoneName(slot.start, zone)})`
  if (!second || second === zone) {
    return line
  }

  const day = calZoneDayShift(slot.start, zone, second) ? `${calZoneDay(slot.start, second)}, ` : ''

  return `${line} · ${day}${calZoneRange(slot.start, slot.end, second)} (${calZoneName(slot.start, second)})`
}

export function freeSlotLines(slots: FreeSlot[], zone: string, second?: string): string[] {
  return mergeFreeSlots(slots).map(slot => freeSlotLine(slot, zone, second))
}

function intro(count: number): string {
  return count === 1 ? 'Here is a time that works for me:' : 'Here are some times that work for me:'
}

/** The slots as plain text, for the clipboard */
export function freeSlotsText(slots: FreeSlot[], zone: string, second?: string): string {
  const lines = freeSlotLines(slots, zone, second)

  return [intro(lines.length), ...lines.map(line => `• ${line}`)].join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The same as a short list, for the body of a new message */
export function freeSlotsHtml(slots: FreeSlot[], zone: string, second?: string): string {
  const lines = freeSlotLines(slots, zone, second)

  return `<p>${intro(lines.length)}</p><ul>${lines.map(line => `<li><p>${escapeHtml(line)}</p></li>`).join('')}</ul><p></p>`
}

/** “3 slots marked”, for the bar and for a screen reader */
export function freeSlotCount(count: number): string {
  return count === 1 ? '1 slot marked' : `${count} slots marked`
}
