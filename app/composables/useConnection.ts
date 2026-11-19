// Whether the app can reach anything: the network (the browser knows) and
// the app's own server (only a request can tell). Nothing is polled while all
// is well. Once a request fails to get any answer at all, one quick check
// runs, and only while that check keeps failing does it repeat, until the
// server answers again

/** How long to wait between checks while the server is down */
const RETRY = 10_000
/** A check that takes longer than this counts as no answer */
const TIMEOUT = 6_000

const _useConnection = () => {
  const online = useOnline()
  const serverUp = ref(true)
  const checking = ref(false)

  let inFlight: Promise<boolean> | undefined

  /**
   * Asks the server whether it is there. The session endpoint is public and
   * tiny, and the plain `fetch` keeps the check out of the app's own fetch
   * hooks, which report failures here and would otherwise loop
   */
  function check(): Promise<boolean> {
    inFlight ??= (async () => {
      checking.value = true
      try {
        await fetch('/api/_auth/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(TIMEOUT) })
        // Any answer, even an error status, means the server is running
        serverUp.value = true
      } catch {
        serverUp.value = false
      } finally {
        checking.value = false
        inFlight = undefined
      }
      return serverUp.value
    })()
    return inFlight
  }

  const probe = useIntervalFn(check, RETRY, { immediate: false })
  watch(serverUp, up => up ? probe.pause() : probe.resume())

  // Back on the network: see straight away whether the server is too
  watch(online, (now) => {
    if (now && !serverUp.value) check()
  })

  /**
   * Call when a request got no answer at all (not an error status: the
   * server answered those). Offline, the browser already said so
   */
  function reportFailure() {
    if (!import.meta.client || !online.value || checking.value) return
    check()
  }

  /** Checks now, from the Retry button */
  function retry() {
    return check()
  }

  return { online, serverUp: readonly(serverUp), checking: readonly(checking), retry, reportFailure }
}

export const useConnection = createAppComposable(_useConnection)
