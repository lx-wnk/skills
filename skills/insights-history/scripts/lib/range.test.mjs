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

test("parsePeriod accepts an ISO week", () => {
  const { start, end } = parsePeriod("2026-W26", NOW);
  assert.equal(Math.round((end - start) / 86400000), 6);
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

test("bucketKey groups by ISO week and calendar month", () => {
  assert.equal(bucketKey(new Date("2026-06-23T00:00:00Z"), "week"), "2026-W26");
  assert.equal(bucketKey(new Date("2026-06-23T00:00:00Z"), "month"), "2026-06");
});

test("autoGranularity switches at 90 days", () => {
  assert.equal(autoGranularity(new Date("2026-01-01"), new Date("2026-03-01")), "week");
  assert.equal(autoGranularity(new Date("2026-01-01"), new Date("2026-12-01")), "month");
});
