// The contacts marked with a star. Kept on this computer, per mailbox: an
// address book has nowhere to put a favourite that every server agrees on
export function useContactFavourites() {
  const ids = useAccountPref<string[]>('contact-favourites', () => [])

  function isFavourite(id: string): boolean {
    return ids.value.includes(id)
  }

  function toggle(id: string) {
    ids.value = isFavourite(id) ? ids.value.filter(item => item !== id) : [...ids.value, id]
  }

  // A merge folds one contact into another, and the star goes with it
  function transfer(from: string[], to: string) {
    if (!from.some(isFavourite)) return
    ids.value = [...new Set([...ids.value.filter(id => !from.includes(id)), to])]
  }

  return { ids, isFavourite, toggle, transfer }
}
