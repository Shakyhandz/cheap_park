import { describe, expect, it, beforeEach } from "vitest";
import { matchStockholmTariff, resetStockholmRegistry, getStockholmTariffs } from "../src/tariff-templates-stockholm.js";
import { priceNow } from "@cheap-park/tariff";
import type { EvalContext } from "@cheap-park/tariff";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

describe("matchStockholmTariff", () => {
  beforeEach(() => resetStockholmRegistry());

  it("avgiftsfri → free tariff id", () => {
    expect(matchStockholmTariff("avgiftsfri")).toBe("sthlm-avgiftsfri");
  });

  it("taxa 1 → sthlm-taxa-1, 55 kr/h around the clock", () => {
    const id = matchStockholmTariff("taxa 1: 55 kr/tim alla dagar 00-24 Boende: ingen boendeparkering");
    expect(id).toBe("sthlm-taxa-1");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(55); // Wed 13:00
    expect(priceNow(t, new Date("2026-05-31T01:00:00Z"), SE)).toBe(55); // Sun 03:00
  });

  it("taxa 3 → 20 vardag 7-19, 15 preHelgdag 11-17, else free", () => {
    const id = matchStockholmTariff("taxa 3: 20 kr/tim vardagar 7-19, 15 kr/tim dag före helgdag 11-17, Boende: 1100 kr/månad eller 75 kr/dygn");
    expect(id).toBe("sthlm-taxa-3");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(20);   // Wed 13:00 vardag
    expect(priceNow(t, new Date("2026-05-30T11:00:00Z"), SE)).toBe(15);   // Sat 13:00 preHelgdag
    expect(priceNow(t, new Date("2026-05-31T11:00:00Z"), SE)).toBe("free"); // Sun
  });

  it("unknown pattern → null, nothing registered", () => {
    expect(matchStockholmTariff("taxa 99: weird")).toBe(null);
  });

  it("taxa 5 → 5 kr vardag 7-19", () => {
    const id = matchStockholmTariff("taxa 5: 5 kr/tim vardagar 7-19, Boende: 300 kr/månad eller 20 kr/dygn");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(5);
  });
});
