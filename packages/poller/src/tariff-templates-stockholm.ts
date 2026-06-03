import type { Tariff } from "@cheap-park/tariff";

const REGISTRY = new Map<string, Tariff>();
export function getStockholmTariffs(): Tariff[] {
  return [...REGISTRY.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function resetStockholmRegistry(): void {
  REGISTRY.clear();
}

function buildTariff(id: string): Tariff | null {
  switch (id) {
    case "sthlm-avgiftsfri":
      return { id, name: "Avgiftsfri", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }] };
    case "sthlm-taxa-1":
      return { id, name: "Taxa 1", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }] };
    case "sthlm-taxa-2":
      return {
        id, name: "Taxa 2",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 21, pricePerHour: 31 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 9, hourEnd: 19, pricePerHour: 31 },
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 0, hourEnd: 7, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 21, hourEnd: 24, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 0, hourEnd: 9, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 19, hourEnd: 24, pricePerHour: 20 },
        ],
      };
    case "sthlm-taxa-3":
      return {
        id, name: "Taxa 3",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 15 },
        ],
      };
    case "sthlm-taxa-4":
      return {
        id, name: "Taxa 4",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 10 },
          { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 10 },
        ],
      };
    case "sthlm-taxa-5":
      return {
        id, name: "Taxa 5",
        rules: [{ daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 5 }],
      };
    default:
      return null;
  }
}

export function matchStockholmTariff(parkingRate: string): string | null {
  const s = parkingRate.trim().toLowerCase();
  let id: string | null = null;
  if (s.startsWith("avgiftsfri")) id = "sthlm-avgiftsfri";
  else {
    const m = s.match(/^taxa\s+(\d+)\s*:/);
    if (m) {
      const n = m[1];
      if (["1", "2", "3", "4", "5"].includes(n!)) id = `sthlm-taxa-${n}`;
    }
  }
  if (!id) return null;
  const t = buildTariff(id);
  if (!t) return null;
  REGISTRY.set(t.id, t);
  return t.id;
}
