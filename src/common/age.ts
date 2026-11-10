export function ageInYears(birthDate: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const month = now.getUTCMonth() - birthDate.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

export function isMinor(birthDate: Date | null | undefined, now = new Date()) {
  return birthDate != null && ageInYears(birthDate, now) < 18;
}
