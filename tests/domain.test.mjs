import test from "node:test";
import assert from "node:assert/strict";
import { isDate, isTimeZone, parseMoney, formatMoney, moneyInput, dateInZone, activityInstant, nextActivity } from "../lib/domain.ts";

test("calendar dates reject rollovers and accept leap years", () => {
  assert.equal(isDate("2028-02-29"), true);
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "garbage", "1899-12-31"]) assert.equal(isDate(date), false);
});
test("money uses exact minor units across zero, two and three decimal currencies", () => {
  assert.equal(parseMoney("0.29", "USD"), 29);
  assert.equal(parseMoney("123.45", "EUR"), 12345);
  assert.equal(parseMoney("1200", "JPY"), 1200);
  assert.equal(parseMoney("1.234", "BHD"), 1234);
  assert.equal(parseMoney("0", "USD"), 0);
  assert.equal(moneyInput(29, "USD"), "0.29");
  assert.equal(moneyInput(1234, "BHD"), "1.234");
  assert.equal(formatMoney(1200, "JPY"), "¥1,200");
});
test("amounts reject silent rounding, negatives, exponent notation and unsafe values", () => {
  for (const amount of ["1.234", "-5", "1e3", "NaN", "1,200", "", "Infinity", "1000000000000"]) assert.equal(parseMoney(amount, "USD"), null);
  assert.equal(parseMoney("1.1", "JPY"), null);
  assert.equal(parseMoney("1.2345", "BHD"), null);
  assert.throws(() => parseMoney("10", "ZZZ"));
});
test("Today follows destination time even across the international date line", () => {
  const now = new Date("2026-09-27T05:00:00Z");
  assert.equal(dateInZone("America/Los_Angeles", now), "2026-09-26");
  assert.equal(dateInZone("Pacific/Kiritimati", now), "2026-09-27");
  assert.equal(isTimeZone("Asia/Kolkata"), true);
  assert.equal(isTimeZone("Mars/Olympus"), false);
});
test("local plans resolve fractional offsets, date boundaries and daylight saving", () => {
  const resolve = (date, time, time_zone) => activityInstant({ date, time, time_zone });
  assert.equal(resolve("2026-09-27", "10:00", "Asia/Kolkata"), Date.parse("2026-09-27T04:30:00Z"));
  assert.equal(resolve("2026-09-27", "00:00", "Pacific/Kiritimati"), Date.parse("2026-09-26T10:00:00Z"));
  assert.equal(resolve("2026-03-08", "02:30", "America/Los_Angeles"), null);
  assert.equal(resolve("2026-09-27", null, "UTC"), null);
});
test("Up next orders real instants across zones and ignores past and flexible plans", () => {
  const activities = [
    { id: "later", date: "2026-09-27", time: "10:00", time_zone: "America/Los_Angeles" },
    { id: "first", date: "2026-09-27", time: "19:00", time_zone: "Asia/Tokyo" },
    { id: "past", date: "2026-09-27", time: "08:00", time_zone: "UTC" },
    { id: "flexible", date: "2026-09-27", time: null, time_zone: "UTC" },
  ];
  assert.equal(nextActivity(activities, new Date("2026-09-27T09:00:00Z"))?.id, "first");
  assert.equal(nextActivity(activities, new Date("2026-10-01T00:00:00Z")), undefined);
});
