import { describe, expect, it } from "vitest";
import { priceNow } from "../src/price-now.js";
import type { EvalContext } from "../src/days.js";
import type { Tariff } from "../src/types.js";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

const weekdayPaidEvening: Tariff = {
  id: "test-A",
  name: "Centrum",
  rules: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 9, hourEnd: 18, pricePerHour: 35 },
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 18, hourEnd: 24, pricePerHour: 0 },
  ],
};

const allDayFree: Tariff = {
  id: "test-free",
  name: "Förort",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
};

describe("priceNow", () => {
  it("returns hourly rate inside paid window", () => {
    // 14:00 Stockholm Mon = 12:00Z (CEST = UTC+2)
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T12:00:00Z"), SE)).toBe(35);
  });

  it("returns 'free' when active rule is 0 kr/h", () => {
    // 20:00 Stockholm Mon = 18:00Z
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T18:00:00Z"), SE)).toBe("free");
  });

  it("returns 'free' on weekend (no rule applies)", () => {
    // 14:00 Stockholm Sun May 10 = 12:00Z
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-10T12:00:00Z"), SE)).toBe("free");
  });

  it("returns 'n/a' when tariff is null", () => {
    // 14:00 Stockholm Mon = 12:00Z
    expect(priceNow(null, new Date("2026-05-11T12:00:00Z"), SE)).toBe("n/a");
  });

  it("matches all-days rule any day", () => {
    // 03:00 Stockholm Sat May 9 = 01:00Z
    expect(priceNow(allDayFree, new Date("2026-05-09T01:00:00Z"), SE)).toBe("free");
  });

  it("returns first matching rule when multiple match", () => {
    const overlap: Tariff = {
      id: "overlap",
      name: "Test",
      rules: [
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 },
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 99 },
      ],
    };
    // 14:00 Stockholm Mon = 12:00Z
    expect(priceNow(overlap, new Date("2026-05-11T12:00:00Z"), SE)).toBe(20);
  });

  it("applies a preHelgdag rule via ctx", () => {
    const t: Tariff = {
      id: "taxa3",
      name: "Taxa 3",
      rules: [
        { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 20 },
        { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 15 },
      ],
    };
    expect(priceNow(t, new Date("2026-05-30T11:00:00Z"), SE)).toBe(15); // Sat 13:00 preHelgdag
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(20); // Wed 13:00 vardag
  });
});
