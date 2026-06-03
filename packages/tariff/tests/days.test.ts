import { describe, expect, it } from "vitest";
import { dayOfWeekFor, hourOf, ruleAppliesAt } from "../src/days.js";
import type { EvalContext } from "../src/days.js";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

describe("dayOfWeekFor", () => {
  it("returns 0 for Sunday", () => {
    // 2026-05-10 Sunday; 10:00Z = 12:00 Stockholm (CEST +2)
    expect(dayOfWeekFor(new Date("2026-05-10T10:00:00Z"), SE)).toBe(0);
  });

  it("returns 1 for Monday", () => {
    // 2026-05-11 Monday; 10:00Z = 12:00 Stockholm
    expect(dayOfWeekFor(new Date("2026-05-11T10:00:00Z"), SE)).toBe(1);
  });

  it("returns 6 for Saturday", () => {
    // 2026-05-09 Saturday; 10:00Z = 12:00 Stockholm
    expect(dayOfWeekFor(new Date("2026-05-09T10:00:00Z"), SE)).toBe(6);
  });
});

describe("hourOf", () => {
  it("returns integer hour at top of hour", () => {
    // 06:00Z = 08:00 Stockholm (CEST +2)
    expect(hourOf(new Date("2026-05-07T06:00:00Z"), SE)).toBe(8);
  });

  it("returns decimal hour for half past", () => {
    // 06:30Z = 08:30 Stockholm
    expect(hourOf(new Date("2026-05-07T06:30:00Z"), SE)).toBe(8.5);
  });

  it("returns 0 at midnight", () => {
    // 22:00Z on May 6 = 00:00 Stockholm on May 7
    expect(hourOf(new Date("2026-05-06T22:00:00Z"), SE)).toBe(0);
  });
});

describe("ruleAppliesAt", () => {
  const rule = { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 8, hourEnd: 18, pricePerHour: 30 };

  it("matches inside window on weekday", () => {
    // 2026-05-11 Monday; 10:00Z = 12:00 Stockholm — inside Mon–Fri 8–18
    expect(ruleAppliesAt(rule, new Date("2026-05-11T10:00:00Z"), SE)).toBe(true);
  });

  it("does not match outside hour window", () => {
    // 2026-05-11 Monday; 17:00Z = 19:00 Stockholm — outside 8–18
    expect(ruleAppliesAt(rule, new Date("2026-05-11T17:00:00Z"), SE)).toBe(false);
  });

  it("does not match on weekend", () => {
    // 2026-05-09 Saturday; 10:00Z = 12:00 Stockholm — weekday 6 not in [1..5]
    expect(ruleAppliesAt(rule, new Date("2026-05-09T10:00:00Z"), SE)).toBe(false);
  });

  it("matches all-day rule when daysOfWeek is empty", () => {
    const allDays = { ...rule, daysOfWeek: [] };
    // Saturday 12:00 Stockholm — daysOfWeek=[] means any day; 12:00 inside 8–18
    expect(ruleAppliesAt(allDays, new Date("2026-05-09T10:00:00Z"), SE)).toBe(true);
  });

  it("hourEnd is exclusive", () => {
    // 2026-05-11 Monday; 16:00Z = 18:00 Stockholm — hourEnd 18 is exclusive
    expect(ruleAppliesAt(rule, new Date("2026-05-11T16:00:00Z"), SE)).toBe(false);
  });
});

describe("ruleAppliesAt with dayClasses + ctx", () => {
  const preHelgRule = {
    daysOfWeek: [],
    dayClasses: ["preHelgdag" as const],
    hourStart: 11,
    hourEnd: 17,
    pricePerHour: 15,
  };

  it("matches on a preHelgdag inside the window", () => {
    // 2026-05-30 is Saturday (preHelgdag — next day is Sunday), 13:00 Stockholm = 11:00Z
    expect(ruleAppliesAt(preHelgRule, new Date("2026-05-30T11:00:00Z"), SE)).toBe(true);
  });

  it("does not match on a plain weekday", () => {
    // 2026-05-27 Wednesday (vardag), 13:00 Stockholm = 11:00Z
    expect(ruleAppliesAt(preHelgRule, new Date("2026-05-27T11:00:00Z"), SE)).toBe(false);
  });

  it("a rule without dayClasses ignores day class (back-compat)", () => {
    const anyDay = { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 5 };
    expect(ruleAppliesAt(anyDay, new Date("2026-05-27T11:00:00Z"), SE)).toBe(true);
  });
});
