export function startOfUtcDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** A membership covers a calendar day when it has started and has not ended before that day. */
export function isEnrolledOn(membership: { startedAt: Date; endedAt: Date | null }, date: Date) {
  const day = startOfUtcDay(date);
  const next = new Date(day.getTime() + 86_400_000);
  return membership.startedAt < next && (membership.endedAt == null || membership.endedAt >= day);
}
