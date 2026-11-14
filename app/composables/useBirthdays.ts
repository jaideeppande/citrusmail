// The birthdays coming up in the next thirty days, for the contacts sidebar
// and the Today panel
const _useBirthdays = () => {
  const { contacts } = useContacts()

  // Only the day matters, so the list is worked out again at midnight rather
  // than every minute
  const now = useNow({ interval: 60_000 })
  const day = computed(() => isoDate(now.value))

  const birthdays = computed(() => upcomingBirthdays(contacts.value, dateFromDay(day.value)))

  return { birthdays }
}

function dateFromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date)
}

export const useBirthdays = createAppComposable(_useBirthdays)
