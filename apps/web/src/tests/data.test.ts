import { describe, expect, it, vi } from "vitest";
import { loadSnapshot, tariffFor } from "../lib/data.js";

const geojson = {
  type: "FeatureCollection",
  generatedAt: "2026-05-30T04:00:00Z",
  cities: { goteborg: { source: "g", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] } },
  features: [{
    type: "Feature", geometry: { type: "Point", coordinates: [11.97, 57.7] },
    properties: { id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "T", provider: "P", tariffId: "t1", rulesText: "r", accessible: false, spaces: 5, maxParkingMinutes: 60 },
  }],
};
const tariffs = { tariffs: [{ id: "t1", name: "T1", rules: [] }] };

describe("loadSnapshot", () => {
  it("loads geojson + tariffs into a snapshot of ClientParking", async () => {
    const fetcher = vi.fn(async (url: string) =>
      new Response(JSON.stringify(String(url).includes("parkings.geojson") ? geojson : tariffs), { status: 200 }),
    ) as unknown as typeof fetch;
    const snap = await loadSnapshot({ basePath: "/data", fetcher });
    expect(snap.parkings).toHaveLength(1);
    expect(snap.parkings[0]!.ctx.timeZone).toBe("Europe/Stockholm");
    expect(snap.tariffs.get("t1")!.name).toBe("T1");
    expect(snap.centers.goteborg).toEqual([11.97, 57.71]);
  });

  it("tariffFor resolves null tariffId to null", () => {
    const p = { tariffId: null } as never;
    expect(tariffFor(p, new Map())).toBe(null);
  });

  it("throws when geojson fetch is not ok", async () => {
    const fetcher = vi.fn(async (url: string) =>
      new Response("x", { status: String(url).includes("geojson") ? 500 : 200 }),
    ) as unknown as typeof fetch;
    await expect(loadSnapshot({ basePath: "/data", fetcher })).rejects.toThrow();
  });
});
