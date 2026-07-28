const ACCEPTED = "accepted forms: YYYY-MM-DD, YYYY-MM, YYYY-Www, <N>d|w|m";
const DAY = 86400000;
// Date.UTC remaps years 0-99 onto 1900-1999, so "0099-06-15" would silently
// become 1999-06-15 and the report would cover a range nobody asked for.
// Every absolute token is floored here instead.
const MIN_YEAR = 1000;

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

// ISO 8601 assigns a week to the year containing its Thursday, so every week
// calculation in this file — a date's week number, a year's week count, a
// week's starting Monday — derives from this one function. Keeping a single
// implementation is deliberate: the two that used to live here disagreed, and
// the one used for validation over-counted 22 of the years 1990-2040 by one
// week (it accepted "2016-W53", which does not exist).
function isoThursday(date) {
  const dayOfWeek = (date.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(date.getTime() + (3 - dayOfWeek) * DAY);
}

// Verified against Python's datetime.date.isocalendar() for every year from
// 1990 to 2040, including the week-53 years and the year-boundary dates
// (2016-01-03 -> 2015-W53, 2019-12-30 -> 2020-W01, 2021-01-01 -> 2020-W53).
function isoWeek(date) {
  const thursday = isoThursday(date);
  const year = thursday.getUTCFullYear();
  const firstThursday = isoThursday(utc(year, 0, 4));
  return { year, week: 1 + Math.round((thursday - firstThursday) / (7 * DAY)) };
}

function isoWeeksInYear(year) {
  // 28 December always falls in the last ISO week of its calendar year.
  return isoWeek(utc(year, 11, 28)).week;
}

function isoWeekStart(year, week) {
  const week1Monday = new Date(isoThursday(utc(year, 0, 4)).getTime() - 3 * DAY);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY);
}

export function parsePeriod(token, now = new Date()) {
  let match;

  if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token))) {
    const [year, month, day] = [+match[1], +match[2], +match[3]];
    if (month < 1 || month > 12) reject(token, `month ${month} is out of range`);
    if (year < MIN_YEAR) reject(token, `year ${match[1]} is before the earliest supported year ${MIN_YEAR}`);
    const at = utc(year, month - 1, day);
    // Date.UTC silently rolls 2026-06-31 forward to 2026-07-01, and remaps
    // two-digit years. Round-tripping every component catches both instead of
    // reporting on a range the user never asked for.
    if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) {
      reject(token, `${match[1]}-${match[2]} has no day ${day}`);
    }
    return { start: at, end: endOfDay(at) };
  }

  if ((match = /^(\d{4})-(\d{2})$/.exec(token))) {
    const [year, month] = [+match[1], +match[2]];
    if (month < 1 || month > 12) reject(token, `month ${month} is out of range`);
    if (year < MIN_YEAR) reject(token, `year ${match[1]} is before the earliest supported year ${MIN_YEAR}`);
    return { start: utc(year, month - 1, 1), end: endOfDay(utc(year, month, 0)) };
  }

  if ((match = /^(\d{4})-W(\d{2})$/.exec(token))) {
    const [year, week] = [+match[1], +match[2]];
    if (year < MIN_YEAR) reject(token, `year ${match[1]} is before the earliest supported year ${MIN_YEAR}`);
    const maxWeek = isoWeeksInYear(year);
    if (week < 1 || week > maxWeek) reject(token, `${year} has weeks 01 to ${maxWeek}`);
    const start = isoWeekStart(year, week);
    return { start, end: endOfDay(new Date(start.getTime() + 6 * 86400000)) };
  }

  if ((match = /^(\d+)([dwm])$/.exec(token))) {
    const count = +match[1];
    if (count < 1) reject(token, "a relative span must be at least 1");
    const days = { d: 1, w: 7, m: 30 }[match[2]] * count;
    return { start: new Date(now.getTime() - days * DAY), end: now };
  }

  reject(token, "unrecognised format");
}

export function bucketKey(date, granularity) {
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const day = utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const { year, week } = isoWeek(day);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function autoGranularity(start, end) {
  return (end - start) / DAY <= 90 ? "week" : "month";
}
