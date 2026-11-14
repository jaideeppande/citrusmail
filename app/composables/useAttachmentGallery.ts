// The attachment gallery: every file on the messages loaded in the open
// folder, on one page. One for the whole window, opened from the list's
// header, the palette or anywhere else
const _useAttachmentGallery = () => {
  const route = useRoute()
  const isOpen = ref(false)

  function open() {
    isOpen.value = true
  }

  useCommands(() => route.path.startsWith('/mail')
    ? [{ id: 'attachments', label: 'Attachments', items: [{ label: 'Attachments in this folder', icon: 'i-lucide-paperclip', onSelect: open }] }]
    : [])

  return { isOpen, open }
}

export const useAttachmentGallery = createAppComposable(_useAttachmentGallery)
