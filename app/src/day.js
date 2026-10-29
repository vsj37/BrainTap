// The game day is the calendar date in Berlin: a new slide appears at 00:00 Europe/Berlin (DST handled by Intl).
// Shared by the browser and the Worker so both agree on "today".
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

export const berlinDay = (ms = Date.now()) => fmt.format(ms); // 'YYYY-MM-DD'

// Milliseconds until the Berlin date changes.
export function msUntilBerlinMidnight(ms = Date.now()) {
  const d = berlinDay(ms);
  let lo = ms;
  let hi = ms + 26 * 36e5; // a Berlin day is 23-25 h
  while (hi - lo > 500) {
    const mid = (lo + hi) / 2;
    if (berlinDay(mid) === d) lo = mid; else hi = mid;
  }
  return Math.ceil(hi) - ms;
}
