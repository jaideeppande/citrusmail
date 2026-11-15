/**
 * Hands the browser a file to save: a Blob behind a temporary link. In the
 * desktop app this is the ordinary download, with its save dialog
 */
export function downloadFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked a moment later: some browsers start the download after the click returns
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** A file name from a group or address book name: “Book club” → “book-club” */
export function fileSlug(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'contacts'
}
