const ACCEPTED = "accepted forms: YYYY-MM-DD, YYYY-MM, YYYY-Www, <N>d|w|m";

function utc(year, month, day) {
  return new Date(Date.UTC(year, month, day));
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
    const day = utc(+match[1], +match[2] - 1, +match[3]);
    return { start: day, end: day };
  }

  if ((match = /^(\d{4})-(\d{2})$/.exec(token))) {
    const start = utc(+match[1], +match[2] - 1, 1);
    const end = utc(+match[1], +match[2], 0);
    return { start, end };
  }

  if ((match = /^(\d{4})-W(\d{2})$/.exec(token))) {
    const start = isoWeekStart(+match[1], +match[2]);
    return { start, end: new Date(start.getTime() + 6 * 86400000) };
  }

  if ((match = /^(\d+)([dwm])$/.exec(token))) {
    const days = { d: 1, w: 7, m: 30 }[match[2]] * +match[1];
    return { start: new Date(now.getTime() - days * 86400000), end: now };
  }

  throw new RangeError(`cannot parse period "${token}" — ${ACCEPTED}`);
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
