const ACCEPTED = "accepted forms: YYYY-MM-DD, YYYY-MM, YYYY-Www, <N>d|w|m";

function utc(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

// End of the given day, so ranges are genuinely inclusive at both ends and
// consumers can compare with <= without adding a day's worth of milliseconds.
function endOfDay(date) {
  return new Date(date.getTime() + 86399999);
}

function reject(token, why) {
  throw new RangeError(`cannot parse period "${token}" — ${why}; ${ACCEPTED}`);
}

function isoWeeksInYear(year) {
  const dec28 = utc(year, 11, 28);
  const dayOfWeek = (dec28.getUTCDay() + 6) % 7;
  const thursday = new Date(dec28.getTime() + (3 - dayOfWeek) * 86400000);
  const jan1 = utc(thursday.getUTCFullYear(), 0, 1);
  return 1 + Math.round((thursday - jan1) / (7 * 86400000));
}

function isoWeekStart(year, week) {
  const jan4 = utc(year, 0, 4);
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - dayOfWeek * 86400000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
}

export function parsePeriod(token, now = new Date()) {
  let match;

  if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token))) {
    const [year, month, day] = [+match[1], +match[2], +match[3]];
    if (month < 1 || month > 12) reject(token, `month ${month} is out of range`);
    const at = utc(year, month - 1, day);
    // Date.UTC silently rolls 2026-06-31 forward to 2026-07-01. Round-tripping
    // catches that instead of reporting on a range the user never asked for.
    if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) {
      reject(token, `${year}-${match[2]} has no day ${day}`);
    }
    return { start: at, end: endOfDay(at) };
  }

  if ((match = /^(\d{4})-(\d{2})$/.exec(token))) {
    const [year, month] = [+match[1], +match[2]];
    if (month < 1 || month > 12) reject(token, `month ${month} is out of range`);
    return { start: utc(year, month - 1, 1), end: endOfDay(utc(year, month, 0)) };
  }

  if ((match = /^(\d{4})-W(\d{2})$/.exec(token))) {
    const [year, week] = [+match[1], +match[2]];
    const maxWeek = isoWeeksInYear(year);
    if (week < 1 || week > maxWeek) reject(token, `${year} has weeks 01 to ${maxWeek}`);
    const start = isoWeekStart(year, week);
    return { start, end: endOfDay(new Date(start.getTime() + 6 * 86400000)) };
  }

  if ((match = /^(\d+)([dwm])$/.exec(token))) {
    const count = +match[1];
    if (count < 1) reject(token, "a relative span must be at least 1");
    const days = { d: 1, w: 7, m: 30 }[match[2]] * count;
    return { start: new Date(now.getTime() - days * 86400000), end: now };
  }

  reject(token, "unrecognised format");
}

export function bucketKey(date, granularity) {
  const year = date.getUTCFullYear();
  if (granularity === "month") {
    return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const target = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayOfWeek + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const offset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - offset + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function autoGranularity(start, end) {
  return (end - start) / 86400000 <= 90 ? "week" : "month";
}
