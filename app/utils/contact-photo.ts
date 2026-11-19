/** The side of a contact photo, in pixels: sharp on a retina screen at any size the app shows it */
export const PHOTO_SIZE = 256

/**
 * A picture file as a small square JPEG data URL: the centre of the image,
 * scaled down. The same treatment your own picture gets in Settings, so a
 * few hundred of them fit comfortably in this computer's storage
 */
export async function toContactPhoto(source: Blob): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = PHOTO_SIZE
  const context = canvas.getContext('2d')!
  // JPEG has no transparency: a cut-out portrait gets white behind it, not black
  context.fillStyle = '#fff'
  context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.86)
}
