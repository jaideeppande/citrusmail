// The message list's background AI, registered once at app start: the
// priority inbox, the scam check and suggested labels. Each gets the Inbox's
// new messages in batches and makes one request per batch. The newsletter
// advisor isn't here: it runs when the Subscriptions page opens, weekly
const _useAiMailWorkers = () => {
  const background = useAiBackground()
  const priority = useAiPriority()
  const scam = useAiScam()
  const labels = useAiLabels()

  background.register('priority', priority.classify)
  background.register('scam', scam.check)
  background.register('suggest-labels', labels.suggest)
}

export const useAiMailWorkers = createAppComposable(_useAiMailWorkers)
