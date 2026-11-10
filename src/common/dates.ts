export function costaRicaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(now);
}

export function costaRicaWeekday(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Costa_Rica', weekday: 'short' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

export function daysAfter(date: string, today = costaRicaToday()) {
  const start = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function startOfUtcDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** A membership covers a calendar day when it has started and has not ended before that day. */
export function isEnrolledOn(membership: { startedAt: Date; endedAt: Date | null }, date: Date) {
  const day = startOfUtcDay(date);
  const next = new Date(day.getTime() + 86_400_000);
  return membership.startedAt < next && (membership.endedAt == null || membership.endedAt >= day);
}
