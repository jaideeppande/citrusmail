// Settings → AI: saving, choosing and removing provider keys. In the desktop
// app they go to the app itself, which keeps them in the system keychain;
// in a browser, to the server as before
export function useAiKeys() {
  const { status: serverStatus } = useAi()
  const client = useAiClient()
  const toast = useToast()
  const saving = ref<AiProvider>()
  const onDesktop = !!client.bridge
  /** Shown once, the first time a key is saved here: what will now run on its own */
  const noticeOpen = ref(false)
  const noticeShown = useLocalPref('ai-notice-shown', false)

  const status = computed<AiStatus | DesktopAiStatus>(() => onDesktop ? client.status.value ?? { providers: [], secure: false } : serverStatus.value)

  async function put(body: { provider: AiProvider, key?: string, model?: string, use?: boolean }, done: string) {
    saving.value = body.provider
    const first = !status.value.active
    try {
      if (onDesktop) {
        client.status.value = await client.bridge!.setKey(body)
        // Other windows read the keys again
        tellWindows({ type: 'settings:changed' })
      } else {
        serverStatus.value = await $fetch<AiStatus>('/api/ai/keys', { method: 'PUT', body })
      }
      toast.add({ title: done, icon: 'i-lucide-check' })
      announce(done)
      if (onDesktop && first && body.key && !noticeShown.value) {
        noticeShown.value = true
        noticeOpen.value = true
      }
      return true
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message ?? (error as Error).message?.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      toast.add({ title: 'Couldn’t save', description, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    } finally {
      saving.value = undefined
    }
  }

  const label = (provider: AiProvider) => status.value.providers.find(item => item.provider === provider)?.label ?? provider

  return {
    status,
    saving,
    onDesktop,
    noticeOpen,
    saveKey: (provider: AiProvider, key: string, model: string) => put({ provider, key: key || undefined, model, use: !status.value.active }, `${label(provider)} key saved`),
    use: (provider: AiProvider) => put({ provider, use: true }, `AI features now use ${label(provider)}`),
    remove: (provider: AiProvider) => put({ provider, key: '' }, `${label(provider)} key removed`)
  }
}
