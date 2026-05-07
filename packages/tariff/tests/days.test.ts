import { describe, expect, it } from "vitest";
import { dayOfWeekFor, hourOf, ruleAppliesAt } from "../src/days.js";

describe("dayOfWeekFor", () => {
  it("returns 0 for Sunday", () => {
    expect(dayOfWeekFor(new Date("2026-05-10T12:00:00"))).toBe(0);
  });

  it("returns 1 for Monday", () => {
    expect(dayOfWeekFor(new Date("2026-05-11T12:00:00"))).toBe(1);
  });

  it("returns 6 for Saturday", () => {
    expect(dayOfWeekFor(new Date("2026-05-09T12:00:00"))).toBe(6);
  });
});

describe("hourOf", () => {
  it("returns integer hour at top of hour", () => {
    expect(hourOf(new Date("2026-05-07T08:00:00"))).toBe(8);
  });

  it("returns decimal hour for half past", () => {
    expect(hourOf(new Date("2026-05-07T08:30:00"))).toBe(8.5);
  });

  it("returns 0 at midnight", () => {
    expect(hourOf(new Date("2026-05-07T00:00:00"))).toBe(0);
  });
});

describe("ruleAppliesAt", () => {
  const rule = { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 8, hourEnd: 18, pricePerHour: 30 };

  it("matches inside window on weekday", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T12:00:00"))).toBe(true);
  });

  it("does not match outside hour window", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T19:00:00"))).toBe(false);
  });

  it("does not match on weekend", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-09T12:00:00"))).toBe(false);
  });

  it("matches all-day rule when daysOfWeek is empty", () => {
    const allDays = { ...rule, daysOfWeek: [] };
    expect(ruleAppliesAt(allDays, new Date("2026-05-09T12:00:00"))).toBe(true);
  });

  it("hourEnd is exclusive", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T18:00:00"))).toBe(false);
  });
});
