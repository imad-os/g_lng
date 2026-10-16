// Local calendar day number (days since 1970-01-01 in the TV's time zone).
export function today() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
