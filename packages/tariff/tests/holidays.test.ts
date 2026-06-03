import { describe, expect, it } from "vitest";
import { isHoliday, dayClassOf } from "../src/holidays.js";

const SE = { timeZone: "Europe/Stockholm", calendar: "SE" as const };

describe("isHoliday (SE)", () => {
  it("fixed holidays", () => {
    expect(isHoliday({ year: 2026, month: 1, day: 1 }, "SE")).toBe(true);   // nyårsdagen
    expect(isHoliday({ year: 2026, month: 6, day: 6 }, "SE")).toBe(true);   // nationaldagen
    expect(isHoliday({ year: 2026, month: 12, day: 25 }, "SE")).toBe(true); // juldagen
  });

  it("easter-derived holidays for 2026 (Easter Sunday = April 5)", () => {
    expect(isHoliday({ year: 2026, month: 4, day: 3 }, "SE")).toBe(true);  // långfredag
    expect(isHoliday({ year: 2026, month: 4, day: 5 }, "SE")).toBe(true);  // påskdagen
    expect(isHoliday({ year: 2026, month: 4, day: 6 }, "SE")).toBe(true);  // annandag påsk
    expect(isHoliday({ year: 2026, month: 5, day: 14 }, "SE")).toBe(true); // Kristi himmelsfärd (+39)
    expect(isHoliday({ year: 2026, month: 5, day: 24 }, "SE")).toBe(true); // pingstdagen (+49)
  });

  it("moving-Saturday holidays for 2026", () => {
    expect(isHoliday({ year: 2026, month: 6, day: 20 }, "SE")).toBe(true);  // midsommardagen (Sat 20 Jun)
    expect(isHoliday({ year: 2026, month: 10, day: 31 }, "SE")).toBe(true); // alla helgons dag (Sat 31 Oct)
  });

  it("a plain weekday is not a holiday", () => {
    expect(isHoliday({ year: 2026, month: 5, day: 27 }, "SE")).toBe(false); // Wednesday
  });
});

describe("dayClassOf (SE) — strict priority", () => {
  it("Sunday is helgdag", () => {
    expect(dayClassOf(new Date("2026-05-31T10:00:00Z"), SE)).toBe("helgdag"); // Sunday
  });
  it("a red day on a weekday is helgdag", () => {
    expect(dayClassOf(new Date("2026-06-06T10:00:00Z"), SE)).toBe("helgdag"); // nationaldagen (Sat) — red wins
  });
  it("Saturday before an ordinary Sunday is preHelgdag", () => {
    expect(dayClassOf(new Date("2026-05-30T10:00:00Z"), SE)).toBe("preHelgdag"); // Sat 30 May
  });
  it("Dec 31 before New Year's Day is preHelgdag", () => {
    expect(dayClassOf(new Date("2026-12-31T10:00:00Z"), SE)).toBe("preHelgdag");
  });
  it("an ordinary weekday is vardag", () => {
    expect(dayClassOf(new Date("2026-05-27T10:00:00Z"), SE)).toBe("vardag"); // Wednesday
  });
});
