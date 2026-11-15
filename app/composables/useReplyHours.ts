// When the people you write to usually write back, learnt from the mail
// already loaded here. Kept on this computer, per mailbox, by address
export function useReplyHours() {
  const { account } = useShell()
  const tally = useAccountPref<Record<string, ReplyHours>>('reply-hours', () => ({}))

  /** Counts messages in a list that was just loaded. Your own messages are left out */
  function noteIncoming(messages: MessageSummary[]) {
    const self = account.value?.email.toLowerCase()
    let next: Record<string, ReplyHours> | undefined
    for (const message of messages) {
      const address = message.from?.address?.toLowerCase()
      if (!address || address === self) continue
      const current = (next ?? tally.value)[address]
      const counted = countReply(current, message.messageId || `${message.folder}/${message.id}`, new Date(message.date))
      if (counted === current) continue
      next ??= { ...tally.value }
      next[address] = counted
    }
    if (next) tally.value = next
  }

  /** The hour someone usually writes at, once there are enough messages to say */
  function usualHour(address: string): { hour: number, samples: number } | undefined {
    const entry = tally.value[address.toLowerCase()]
    const hour = usualReplyHour(entry)
    return hour === undefined ? undefined : { hour, samples: replySamples(entry) }
  }

  return { noteIncoming, usualHour }
}
