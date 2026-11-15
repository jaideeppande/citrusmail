// Every API call carries the viewer's timezone (the calendar converts server
// times into it) and a lapsed session sends the viewer back to sign in
export default defineNuxtPlugin(() => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // A request that got no answer at all tells the offline bar to start checking
  const connection = useConnection()

  globalThis.$fetch = $fetch.create({
    onRequestError() {
      connection.reportFailure()
    },
    onRequest({ options }) {
      options.headers = new Headers(options.headers)
      options.headers.set('x-timezone', timezone)
    },
    onResponseError({ request, response }) {
      const url = typeof request === 'string' ? request : request.url

      if (response.status === 401 && !url.includes('/api/session') && !url.includes('/api/_auth')) {
        navigateTo('/login')
      }
    }
  }) as typeof $fetch
})
