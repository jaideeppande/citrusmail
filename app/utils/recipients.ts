// Who you write to, learned from what you send on this computer: it orders
// the suggestions under To and offers the people who usually go together

const MAX_PEOPLE = 400
const MAX_COMPANIONS = 12
// A message from a month ago counts half as much as one from today
const HALF_LIFE = 30 * 86_400_000

/** Higher for people written to often and lately */
export function recipientScore(stat: RecipientStat | undefined, now = Date.now()): number {
  if (!stat) return 0
  return stat.count * Math.pow(0.5, Math.max(0, now - stat.last) / HALF_LIFE)
}

/** The tally after one more message to these people */
export function recordRecipients(tally: RecipientTally, sent: Address[], now = Date.now()): RecipientTally {
  const people = new Map(sent.map(address => [address.address.toLowerCase(), address]))
  const next: RecipientTally = { ...tally }
  for (const [key, address] of people) {
    const before = next[key]
    const companions: Record<string, number> = { ...before?.with }
    for (const other of people.keys()) {
      if (other !== key) companions[other] = (companions[other] ?? 0) + 1
    }
    next[key] = {
      name: address.name || before?.name,
      count: (before?.count ?? 0) + 1,
      last: now,
      with: Object.fromEntries(Object.entries(companions).sort((a, b) => b[1] - a[1]).slice(0, MAX_COMPANIONS))
    }
  }
  const keys = Object.keys(next)
  if (keys.length <= MAX_PEOPLE) return next
  // The ones written to least and longest ago make room
  const kept = keys.sort((a, b) => recipientScore(next[b], now) - recipientScore(next[a], now)).slice(0, MAX_PEOPLE)
  return Object.fromEntries(kept.map(key => [key, next[key]!]))
}

/**
 * People who were usually on the same messages as the ones entered, best
 * first. Someone who came along once among many messages isn't offered
 */
export function alsoInclude(tally: RecipientTally, entered: Address[], exclude: string[] = [], limit = 3): Address[] {
  const present = new Set([...entered.map(address => address.address.toLowerCase()), ...exclude.map(address => address.toLowerCase())])
  const scores = new Map<string, number>()
  for (const address of entered) {
    const stat = tally[address.address.toLowerCase()]
    if (!stat) continue
    for (const [other, times] of Object.entries(stat.with)) {
      if (present.has(other)) continue
      // Together at least twice, and on at least a third of the messages
      if (times < 2 || times / stat.count < 1 / 3) continue
      scores.set(other, (scores.get(other) ?? 0) + times / stat.count)
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || recipientScore(tally[b[0]]) - recipientScore(tally[a[0]]))
    .slice(0, limit)
    .map(([address]) => ({ name: tally[address]?.name, address }))
}
