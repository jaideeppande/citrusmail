/** The unread count as a small round picture, for the Windows taskbar overlay */
export function badgeImage(count: number): string | undefined {
  try {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    const label = count > 99 ? '99+' : String(count)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ui-primary').trim() || '#0C7A57'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `600 ${label.length > 2 ? 14 : label.length > 1 ? 18 : 22}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, size / 2, size / 2 + 1)
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}
