export function isoDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  )
  const year = parts.year
  const month = parts.month
  const day = parts.day
  if (!year || !month || !day) {
    throw new Error(`Unable to format date in time zone ${timeZone}`)
  }
  return `${year}-${month}-${day}`
}
