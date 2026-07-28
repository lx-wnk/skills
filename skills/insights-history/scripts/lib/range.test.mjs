import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePeriod, bucketKey, autoGranularity } from "./range.mjs";

const NOW = new Date("2026-07-27T12:00:00.000Z");

test("parsePeriod accepts a calendar day", () => {
  const { start, end } = parsePeriod("2026-06-01", NOW);
  assert.equal(start.toISOString().slice(0, 10), "2026-06-01");
  assert.equal(end.toISOString().slice(0, 10), "2026-06-01");
});

test("parsePeriod accepts a calendar month", () => {
  const { start, end } = parsePeriod("2026-06", NOW);
  assert.equal(start.toISOString().slice(0, 10), "2026-06-01");
  assert.equal(end.toISOString().slice(0, 10), "2026-06-30");
});

test("parsePeriod returns an inclusive end for every absolute token", () => {
  assert.equal(parsePeriod("2026-06-15", NOW).end.toISOString(), "2026-06-15T23:59:59.999Z");
  assert.equal(parsePeriod("2026-06", NOW).end.toISOString(), "2026-06-30T23:59:59.999Z");
  assert.equal(parsePeriod("2026-W26", NOW).end.toISOString(), "2026-06-28T23:59:59.999Z");
});

test("parsePeriod accepts an ISO week and pins it to the right Monday", () => {
  const { start, end } = parsePeriod("2026-W26", NOW);
  assert.equal(start.toISOString().slice(0, 10), "2026-06-22");
  assert.equal(end.toISOString().slice(0, 10), "2026-06-28");
});

test("parsePeriod accepts a relative span", () => {
  const { start, end } = parsePeriod("90d", NOW);
  assert.equal(Math.round((end - start) / 86400000), 90);
});

test("parsePeriod rejects an unparsable token by naming the accepted forms", () => {
  assert.throws(
    () => parsePeriod("2026-6-1", NOW),
    (error) => {
      assert.ok(error instanceof RangeError);
      assert.match(error.message, /YYYY-MM-DD/);
      return true;
    },
  );
});

test("parsePeriod rejects tokens that match the shape but not the calendar", () => {
  const tokens = [
    "2026-13",
    "2026-13-01",
    "2026-06-31",
    "2026-02-30",
    "2026-W60",
    "2026-W00",
    "0d",
    // Date.UTC remaps years 0-99 onto 1900-1999. Accepting these would report
    // on 1999 or 1900 while echoing the year the user typed.
    "0099-06-15",
    "0099-06",
    "0099-W26",
    "0000-01-01",
  ];
  for (const token of tokens) {
    assert.throws(() => parsePeriod(token, NOW), RangeError, `expected "${token}" to be rejected`);
  }
});

test("parsePeriod knows which years have an ISO week 53", () => {
  // 2026 genuinely has 53 ISO weeks; 2027 has 52. Checked against Python's
  // datetime.date.isocalendar(). A second, divergent week implementation used
  // to accept week 53 in 52-week years and silently return a Monday in the
  // following year.
  assert.equal(parsePeriod("2026-W53", NOW).start.toISOString().slice(0, 10), "2026-12-28");
  assert.throws(() => parsePeriod("2027-W53", NOW), RangeError);
});

test("bucketKey matches ISO week numbering across year boundaries", () => {
  // Expectations from Python's datetime.date.isocalendar().
  const cases = [
    ["2026-06-23", "2026-W26"],
    ["2024-12-30", "2025-W01"],
    ["2025-12-29", "2026-W01"],
    ["2021-01-01", "2020-W53"],
    ["2016-01-03", "2015-W53"],
    ["2016-12-31", "2016-W52"],
    ["2019-12-30", "2020-W01"],
  ];
  for (const [date, expected] of cases) {
    assert.equal(bucketKey(new Date(`${date}T00:00:00Z`), "week"), expected, date);
  }
});

test("bucketKey groups by ISO week and calendar month", () => {
  assert.equal(bucketKey(new Date("2026-06-23T00:00:00Z"), "week"), "2026-W26");
  assert.equal(bucketKey(new Date("2026-06-23T00:00:00Z"), "month"), "2026-06");
});

test("autoGranularity switches exactly at 90 days", () => {
  const day = 86400000;
  const base = new Date("2026-01-01T00:00:00Z");
  assert.equal(autoGranularity(base, new Date(base.getTime() + 90 * day)), "week");
  assert.equal(autoGranularity(base, new Date(base.getTime() + 91 * day)), "month");
});
